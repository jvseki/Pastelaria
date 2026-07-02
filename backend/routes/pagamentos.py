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
    buscar_pagamento,
    criar_preferencia,
    mercadopago_habilitado,
    obter_url_checkout,
)
from services.pedido_service import criar_pedido_no_banco, serializar_pedido_criado

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pagamentos", tags=["pagamentos"])


@router.get("/config")
def config_mercadopago():
    return {
        "habilitado": mercadopago_habilitado(),
        "public_key": settings.MERCADOPAGO_PUBLIC_KEY if mercadopago_habilitado() else "",
        "sandbox": settings.MERCADOPAGO_SANDBOX,
    }


@router.post("/checkout")
def iniciar_checkout_mercadopago(
    body: PedidoRequest,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not mercadopago_habilitado():
        raise HTTPException(status_code=503, detail="Mercado Pago não configurado na API")

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

    mp_itens = []
    for item in itens_resposta:
        mp_itens.append({
            "title": item["nome"][:256],
            "quantity": item["quantidade"],
            "unit_price": float(item["preco"]),
            "currency_id": "BRL",
        })

    if pedido.taxa_entrega and pedido.taxa_entrega > 0:
        mp_itens.append({
            "title": "Taxa de entrega",
            "quantity": 1,
            "unit_price": float(pedido.taxa_entrega),
            "currency_id": "BRL",
        })

    try:
        preference = criar_preferencia(
            pedido_id=pedido.id,
            itens=mp_itens,
            payer_email=usuario.email_google,
        )
    except httpx.HTTPStatusError as exc:
        db.rollback()
        detail = exc.response.text
        logger.error("Erro MP preferencia: %s", detail)
        raise HTTPException(status_code=502, detail="Erro ao criar pagamento no Mercado Pago") from exc

    pedido.mp_preference_id = preference.get("id")
    db.commit()
    db.refresh(pedido)

    dados = serializar_pedido_criado(pedido, usuario, itens_resposta, endereco)
    dados["checkout_url"] = obter_url_checkout(preference)
    return dados


@router.post("/webhook")
async def webhook_mercadopago(request: Request, db: Session = Depends(get_db)):
    if not mercadopago_habilitado():
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
    status_mp = payment.get("status")

    if not ref:
        return {"ok": True}

    pedido = db.query(Pedido).filter(Pedido.id == int(ref)).first()
    if not pedido:
        return {"ok": True}

    pedido.mp_payment_id = str(payment.get("id") or payment_id)

    if status_mp == "approved":
        pedido.pagamento_confirmado = True
        pedido.status = "pendente"
    elif status_mp in ("rejected", "cancelled", "refunded"):
        pedido.status = "cancelado"

    db.commit()
    return {"ok": True}
