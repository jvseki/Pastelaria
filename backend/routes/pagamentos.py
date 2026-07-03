import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import Pedido, Usuario
from routes.pedidos import PedidoRequest
from routes.usuarios import get_current_user
from services.mercadopago import (
    aplicar_status_pagamento,
    buscar_pagamento,
    buscar_pagamentos_por_pedido,
    confirmar_pix_simulado,
    criar_pagamento_pix,
    extrair_dados_pix,
    gerar_pix_simulado,
    mensagem_erro_mp,
    mercadopago_habilitado,
    validar_cpf,
)
from services.pedido_service import criar_pedido_no_banco, serializar_pedido_criado

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pagamentos", tags=["pagamentos"])


@router.get("/config")
def config_mercadopago():
    return {
        "habilitado": mercadopago_habilitado(),
        "sandbox": settings.MERCADOPAGO_SANDBOX,
        "modo": "simulador_pix" if settings.MERCADOPAGO_SANDBOX else "pix_mercadopago",
    }


@router.post("/checkout")
def iniciar_pagamento_pix(
    body: PedidoRequest,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cria pedido e retorna dados do Pix (simulado ou real)."""
    if not mercadopago_habilitado():
        raise HTTPException(status_code=503, detail="Pix online não configurado na API")

    pedido, itens_resposta, endereco = criar_pedido_no_banco(
        db,
        usuario,
        pagamento="mercadopago",
        troco=None,
        tipo_entrega=body.tipo_entrega,
        taxa_entrega=body.taxa_entrega,
        local_retirada=body.local_retirada,
        observacao=body.observacao,
        itens_req=body.itens,
        status="aguardando_pagamento",
    )

    valor = sum(float(i["preco"]) * i["quantidade"] for i in itens_resposta) + float(pedido.taxa_entrega or 0)
    if valor <= 0:
        db.rollback()
        raise HTTPException(status_code=400, detail="Valor do pedido inválido para pagamento")

    try:
        if settings.MERCADOPAGO_SANDBOX:
            pix = gerar_pix_simulado(pedido_id=pedido.id, valor=valor)
            pedido.mp_payment_id = f"SIM-{pedido.id}"
        else:
            if not settings.MERCADOPAGO_ACCESS_TOKEN.strip():
                db.rollback()
                raise HTTPException(status_code=503, detail="Access Token do Mercado Pago não configurado")
            try:
                cpf = validar_cpf(body.cpf)
            except ValueError as exc:
                db.rollback()
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            payment = criar_pagamento_pix(
                pedido_id=pedido.id,
                valor=valor,
                payer_email=usuario.email_google,
                payer_nome=usuario.nome,
                payer_cpf=cpf,
                descricao=f"Pedido #{pedido.numero_dia or pedido.id} — Pastelaria",
            )
            pedido.mp_payment_id = str(payment.get("id") or "")
            pix = extrair_dados_pix(payment)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        db.rollback()
        detail = mensagem_erro_mp(exc)
        logger.error("Erro MP Pix: %s", exc.response.text)
        raise HTTPException(status_code=502, detail=detail) from exc

    db.commit()
    db.refresh(pedido)

    dados = serializar_pedido_criado(pedido, usuario, itens_resposta, endereco)
    dados["pix"] = pix
    return dados


@router.post("/simular/{pedido_id}")
def simular_pagamento_pix(
    pedido_id: int,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sandbox: confirma pagamento Pix fictício."""
    if not settings.MERCADOPAGO_SANDBOX:
        raise HTTPException(status_code=404, detail="Disponível apenas em sandbox")

    pedido = db.query(Pedido).filter(Pedido.id == pedido_id, Pedido.usuario_id == usuario.id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if pedido.pagamento != "mercadopago":
        raise HTTPException(status_code=400, detail="Pedido não é Pix online")
    if pedido.pagamento_confirmado:
        return {
            "sincronizado": True,
            "status_mp": "approved",
            "pedido_status": pedido.status,
            "pagamento_confirmado": True,
        }

    confirmar_pix_simulado(pedido)
    db.commit()
    db.refresh(pedido)

    return {
        "sincronizado": True,
        "status_mp": "approved",
        "pedido_status": pedido.status,
        "pagamento_confirmado": True,
    }


def _sincronizar_pedido_com_mp(pedido: Pedido, db: Session) -> dict:
    pagamentos = buscar_pagamentos_por_pedido(pedido.id)
    if not pagamentos:
        return {"sincronizado": False, "status_mp": None, "pedido_status": pedido.status}

    pagamentos.sort(key=lambda p: p.get("date_created") or "", reverse=True)
    aprovado = next((p for p in pagamentos if p.get("status") == "approved"), None)
    payment = aprovado or pagamentos[0]
    status_mp = aplicar_status_pagamento(pedido, payment)
    db.commit()
    db.refresh(pedido)

    return {
        "sincronizado": True,
        "status_mp": status_mp,
        "pedido_status": pedido.status,
        "pagamento_confirmado": bool(pedido.pagamento_confirmado),
    }


@router.post("/confirmar/{pedido_id}")
def confirmar_pagamento_retorno(
    pedido_id: int,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Consulta o MP e atualiza o pedido (produção / webhook fallback)."""
    if not mercadopago_habilitado():
        raise HTTPException(status_code=503, detail="Pix online não configurado")

    pedido = db.query(Pedido).filter(Pedido.id == pedido_id, Pedido.usuario_id == usuario.id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if pedido.pagamento != "mercadopago":
        raise HTTPException(status_code=400, detail="Pedido não é Pix online")

    if pedido.pagamento_confirmado:
        return {
            "sincronizado": True,
            "status_mp": "approved",
            "pedido_status": pedido.status,
            "pagamento_confirmado": True,
        }

    if settings.MERCADOPAGO_SANDBOX:
        return {
            "sincronizado": False,
            "status_mp": None,
            "pedido_status": pedido.status,
            "pagamento_confirmado": False,
        }

    try:
        return _sincronizar_pedido_com_mp(pedido, db)
    except httpx.HTTPStatusError as exc:
        logger.error("Erro ao sincronizar MP pedido %s: %s", pedido_id, exc.response.text)
        raise HTTPException(status_code=502, detail="Erro ao consultar pagamento no Mercado Pago") from exc


@router.post("/webhook")
@router.get("/webhook")
async def webhook_mercadopago(request: Request, db: Session = Depends(get_db)):
    if not mercadopago_habilitado() or settings.MERCADOPAGO_SANDBOX:
        return {"ok": True}

    payload = {}
    try:
        payload = await request.json()
    except Exception:
        pass

    payment_id = request.query_params.get("data.id") or request.query_params.get("id")
    topic = request.query_params.get("type") or request.query_params.get("topic")

    if not payment_id and payload:
        data = payload.get("data") or {}
        payment_id = data.get("id")
        topic = payload.get("type") or topic

    if topic and topic != "payment":
        return {"ok": True}
    if not payment_id:
        return {"ok": True}

    try:
        payment = buscar_pagamento(str(payment_id))
    except Exception as exc:
        logger.warning("Webhook MP: falha ao buscar pagamento %s: %s", payment_id, exc)
        return {"ok": True}

    ref = payment.get("external_reference")
    if not ref:
        return {"ok": True}

    pedido = db.query(Pedido).filter(Pedido.id == int(ref)).first()
    if not pedido:
        return {"ok": True}

    aplicar_status_pagamento(pedido, payment)
    db.commit()
    return {"ok": True}
