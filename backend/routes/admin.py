from fastapi import APIRouter, Depends, HTTPException, Header, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from zoneinfo import ZoneInfo

from database import get_db
from models import Pedido, Endereco, ItemPedido, GavetaDiaria
from config import settings
from services.mercadopago import estornar_pagamento, mensagem_erro_mp
import httpx
from services.whatsapp import formatar_mensagem_motoboy, gerar_link_whatsapp

router = APIRouter(prefix="/admin", tags=["admin"])
TZ_BR = ZoneInfo("America/Sao_Paulo")


def verificar_admin(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Não autorizado")

    token = authorization.split(" ")[1]
    if token != settings.ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Acesso negado")


def serializar_pedido(pedido: Pedido, db: Session) -> dict:
    endereco = db.query(Endereco).filter(Endereco.usuario_id == pedido.usuario_id).first()
    itens = []
    for item in pedido.itens:
        itens.append({
            "produto_id": item.produto_id,
            "nome": item.produto.nome if item.produto else "Produto",
            "preco": item.produto.preco if item.produto else 0,
            "quantidade": item.quantidade,
        })

    return {
        "id": pedido.id,
        "numero_dia": pedido.numero_dia,
        "pagamento": pedido.pagamento,
        "troco": pedido.troco,
        "tipo_entrega": pedido.tipo_entrega or "entrega",
        "taxa_entrega": pedido.taxa_entrega or 0,
        "local_retirada": pedido.local_retirada,
        "status": pedido.status,
        "pagamento_confirmado": bool(pedido.pagamento_confirmado),
        "observacao": pedido.observacao,
        "data_pedido": pedido.data_pedido.isoformat() if pedido.data_pedido else None,
        "usuario": {
            "id": pedido.usuario.id,
            "nome": pedido.usuario.nome,
            "telefone": pedido.usuario.telefone,
        },
        "endereco": {
            "rua": endereco.rua if endereco else "",
            "numero": endereco.numero if endereco else "",
            "bairro": endereco.bairro if endereco else "",
            "referencia": endereco.referencia if endereco else "",
            "latitude": endereco.latitude if endereco else None,
            "longitude": endereco.longitude if endereco else None,
        },
        "itens": itens,
    }


def _total_pedido(dados: dict) -> float:
    itens_total = sum(i["preco"] * i["quantidade"] for i in dados.get("itens", []))
    return itens_total + (dados.get("taxa_entrega") or 0)


def _serializar_gaveta(gaveta: GavetaDiaria, resumo: bool = False) -> dict:
    base = {
        "id": gaveta.id,
        "data_referencia": gaveta.data_referencia.isoformat(),
        "fechado_em": gaveta.fechado_em.isoformat() if gaveta.fechado_em else None,
        "qtd_pedidos": gaveta.qtd_pedidos,
        "total_vendas": gaveta.total_vendas,
    }
    if not resumo:
        base["pedidos"] = gaveta.pedidos_snapshot
    return base


@router.get("/pedidos")
def listar_pedidos(
    db: Session = Depends(get_db),
    _: None = Depends(verificar_admin),
):
    pedidos = (
        db.query(Pedido)
        .filter(Pedido.arquivado == False)
        .options(joinedload(Pedido.usuario), joinedload(Pedido.itens).joinedload(ItemPedido.produto))
        .order_by(Pedido.data_pedido.desc())
        .all()
    )
    return [serializar_pedido(p, db) for p in pedidos]


class StatusUpdate(BaseModel):
    status: str


@router.patch("/pedidos/{pedido_id}/status")
def atualizar_status(
    pedido_id: int,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(verificar_admin),
):
    pedido = db.query(Pedido).filter(Pedido.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    status_validos = ["pendente", "aceito", "preparando", "entrega", "finalizado"]
    if body.status not in status_validos:
        raise HTTPException(status_code=400, detail="Status inválido")

    pedido.status = body.status
    db.commit()
    db.refresh(pedido)

    return serializar_pedido(pedido, db)


@router.post("/pedidos/{pedido_id}/cancelar")
def cancelar_pedido(
    pedido_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(verificar_admin),
):
    """Recusa pedido e estorna Pix online se já foi pago."""
    pedido = db.query(Pedido).filter(Pedido.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    if pedido.status in ("finalizado", "cancelado"):
        raise HTTPException(status_code=400, detail="Este pedido não pode ser cancelado")

    estornado = False
    if (
        pedido.pagamento == "mercadopago"
        and pedido.pagamento_confirmado
        and pedido.mp_payment_id
        and not pedido.mp_payment_id.startswith("SIM-")
        and not settings.MERCADOPAGO_SANDBOX
    ):
        try:
            estornar_pagamento(pedido.mp_payment_id)
            estornado = True
        except httpx.HTTPStatusError as exc:
            detail = mensagem_erro_mp(exc)
            raise HTTPException(
                status_code=502,
                detail=f"Não foi possível estornar no Mercado Pago: {detail}",
            ) from exc

    pedido.status = "cancelado"
    if estornado:
        pedido.pagamento_confirmado = False
    db.commit()
    db.refresh(pedido)

    dados = serializar_pedido(pedido, db)
    dados["estornado"] = estornado
    return dados


@router.patch("/pedidos/{pedido_id}/pagamento")
def confirmar_pagamento(
    pedido_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(verificar_admin),
):
    pedido = db.query(Pedido).filter(Pedido.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    if pedido.status not in ("entrega", "finalizado"):
        raise HTTPException(
            status_code=400,
            detail="Pagamento só pode ser confirmado quando o pedido está em entrega ou finalizado",
        )

    pedido.pagamento_confirmado = True
    db.commit()
    db.refresh(pedido)

    return serializar_pedido(pedido, db)


@router.get("/pedidos/{pedido_id}/whatsapp")
def link_whatsapp_motoboy(
    pedido_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(verificar_admin),
):
    pedido = (
        db.query(Pedido)
        .options(joinedload(Pedido.usuario), joinedload(Pedido.itens).joinedload(ItemPedido.produto))
        .filter(Pedido.id == pedido_id)
        .first()
    )
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    dados = serializar_pedido(pedido, db)
    mensagem = formatar_mensagem_motoboy(dados)
    return {"url": gerar_link_whatsapp(mensagem)}


@router.post("/fechar-dia")
def fechar_dia(
    forcar: bool = Query(False, description="Arquivar mesmo com pedidos em aberto"),
    db: Session = Depends(get_db),
    _: None = Depends(verificar_admin),
):
    pedidos_ativos = (
        db.query(Pedido)
        .filter(Pedido.arquivado == False)
        .options(joinedload(Pedido.usuario), joinedload(Pedido.itens).joinedload(ItemPedido.produto))
        .order_by(Pedido.data_pedido.asc())
        .all()
    )

    if not pedidos_ativos:
        raise HTTPException(status_code=400, detail="Nenhum pedido ativo para arquivar")

    abertos = [p for p in pedidos_ativos if p.status != "finalizado"]
    if abertos and not forcar:
        raise HTTPException(
            status_code=409,
            detail={
                "mensagem": f"Existem {len(abertos)} pedido(s) ainda em aberto. Finalize ou confirme para arquivar mesmo assim.",
                "abertos": len(abertos),
            },
        )

    snapshots = [serializar_pedido(p, db) for p in pedidos_ativos]
    total_vendas = sum(_total_pedido(s) for s in snapshots)
    hoje = datetime.now(TZ_BR).date()

    gaveta = GavetaDiaria(
        data_referencia=hoje,
        qtd_pedidos=len(snapshots),
        total_vendas=total_vendas,
        pedidos_snapshot=snapshots,
    )
    db.add(gaveta)

    for pedido in pedidos_ativos:
        pedido.arquivado = True

    db.commit()
    db.refresh(gaveta)

    return {
        "mensagem": "Dia fechado com sucesso. Pedidos guardados na gaveta.",
        "gaveta": _serializar_gaveta(gaveta, resumo=True),
    }


@router.get("/gavetas")
def listar_gavetas(
    db: Session = Depends(get_db),
    _: None = Depends(verificar_admin),
):
    gavetas = db.query(GavetaDiaria).order_by(GavetaDiaria.fechado_em.desc()).all()
    return [_serializar_gaveta(g, resumo=True) for g in gavetas]


@router.get("/gavetas/{gaveta_id}")
def detalhe_gaveta(
    gaveta_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(verificar_admin),
):
    gaveta = db.query(GavetaDiaria).filter(GavetaDiaria.id == gaveta_id).first()
    if not gaveta:
        raise HTTPException(status_code=404, detail="Gaveta não encontrada")
    return _serializar_gaveta(gaveta, resumo=False)
