from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from config import settings
from database import get_db
from models import Pedido, ItemPedido, Produto, Endereco
from routes.usuarios import get_current_user
from models import Usuario
from services.mercadopago import estornar_pagamento, mensagem_erro_mp
from services.pedido_service import criar_pedido_no_banco, serializar_pedido_criado
import httpx

router = APIRouter(prefix="/pedidos", tags=["pedidos"])


class ItemPedidoRequest(BaseModel):
    produto_id: int
    quantidade: int


class PedidoRequest(BaseModel):
    pagamento: str
    troco: Optional[float] = None
    tipo_entrega: str = "entrega"
    taxa_entrega: float = 0
    local_retirada: Optional[str] = None
    observacao: Optional[str] = None
    cpf: Optional[str] = None
    itens: list[ItemPedidoRequest]


def serializar_pedido(pedido: Pedido, db: Session) -> dict:
    endereco = db.query(Endereco).filter(Endereco.usuario_id == pedido.usuario_id).first()
    itens_resposta = []

    for item in pedido.itens:
        produto = item.produto
        itens_resposta.append({
            "produto_id": item.produto_id,
            "nome": produto.nome if produto else "Produto",
            "preco": produto.preco if produto else 0,
            "quantidade": item.quantidade,
        })

    return {
        "id": pedido.id,
        "numero_dia": pedido.numero_dia,
        "pagamento": pedido.pagamento,
        "troco": pedido.troco,
        "tipo_entrega": pedido.tipo_entrega,
        "taxa_entrega": pedido.taxa_entrega,
        "local_retirada": pedido.local_retirada,
        "status": pedido.status,
        "pagamento_confirmado": bool(pedido.pagamento_confirmado),
        "mp_preference_id": pedido.mp_preference_id or None,
        "mp_payment_id": pedido.mp_payment_id or None,
        "data_pedido": pedido.data_pedido.isoformat() if pedido.data_pedido else None,
        "endereco": {
            "rua": endereco.rua if endereco else "",
            "numero": endereco.numero if endereco else "",
            "bairro": endereco.bairro if endereco else "",
            "referencia": endereco.referencia if endereco else "",
            "latitude": endereco.latitude if endereco else None,
            "longitude": endereco.longitude if endereco else None,
        },
        "itens": itens_resposta,
    }


@router.get("/me")
def listar_meus_pedidos(
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pedidos = (
        db.query(Pedido)
        .filter(Pedido.usuario_id == usuario.id)
        .options(joinedload(Pedido.itens).joinedload(ItemPedido.produto))
        .order_by(Pedido.data_pedido.desc())
        .all()
    )
    return [serializar_pedido(pedido, db) for pedido in pedidos]


def _cliente_pode_cancelar(pedido: Pedido) -> bool:
    if pedido.status == "cancelado":
        return False
    if pedido.status == "aguardando_pagamento" and not pedido.pagamento_confirmado:
        return True
    if pedido.status == "pendente":
        return True
    return False


@router.post("/{pedido_id}/desistir")
def desistir_pedido(
    pedido_id: int,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cliente cancela pedido antes do preparo (com estorno se Pix online já pago)."""
    pedido = (
        db.query(Pedido)
        .filter(Pedido.id == pedido_id, Pedido.usuario_id == usuario.id)
        .first()
    )
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if not _cliente_pode_cancelar(pedido):
        raise HTTPException(
            status_code=400,
            detail="Este pedido já está em preparo ou finalizado e não pode ser cancelado pelo app",
        )

    estornado = False
    if (
        pedido.pagamento == "mercadopago"
        and pedido.pagamento_confirmado
        and pedido.mp_payment_id
        and not str(pedido.mp_payment_id).startswith("SIM-")
        and not settings.MERCADOPAGO_SANDBOX
    ):
        try:
            estornar_pagamento(str(pedido.mp_payment_id))
            estornado = True
            pedido.pagamento_confirmado = False
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Não foi possível estornar o Pix: {mensagem_erro_mp(exc)}",
            ) from exc

    pedido.status = "cancelado"
    db.commit()
    db.refresh(pedido)

    dados = serializar_pedido(pedido, db)
    dados["estornado"] = estornado
    return dados


@router.post("/desistir-nao-pagos")
def desistir_pedidos_nao_pagos(
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancela todos os pedidos Pix não pagos do cliente."""
    pedidos = (
        db.query(Pedido)
        .filter(
            Pedido.usuario_id == usuario.id,
            Pedido.pagamento == "mercadopago",
            Pedido.status == "aguardando_pagamento",
            Pedido.pagamento_confirmado == False,  # noqa: E712
        )
        .all()
    )
    for pedido in pedidos:
        pedido.status = "cancelado"
    db.commit()
    return {"quantidade": len(pedidos)}


@router.post("")
def criar_pedido(
    body: PedidoRequest,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pedido, itens_resposta, endereco = criar_pedido_no_banco(
        db,
        usuario,
        pagamento=body.pagamento,
        troco=body.troco,
        tipo_entrega=body.tipo_entrega,
        taxa_entrega=body.taxa_entrega,
        local_retirada=body.local_retirada,
        observacao=body.observacao,
        itens_req=body.itens,
        status="pendente",
    )
    db.commit()
    db.refresh(pedido)
    return serializar_pedido_criado(pedido, usuario, itens_resposta, endereco)
