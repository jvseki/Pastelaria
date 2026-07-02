"""Integração Mercado Pago Checkout Pro."""

from __future__ import annotations

import httpx

from config import settings

MP_API = "https://api.mercadopago.com"


def mercadopago_habilitado() -> bool:
    return bool(settings.MERCADOPAGO_ACCESS_TOKEN.strip())


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.MERCADOPAGO_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }


def criar_preferencia(
    *,
    pedido_id: int,
    itens: list[dict],
    payer_email: str | None = None,
) -> dict:
    """Cria preferência Checkout Pro e retorna resposta da API."""
    frontend = settings.FRONTEND_URL.rstrip("/")
    api_base = settings.API_PUBLIC_URL.rstrip("/") or settings.FRONTEND_URL.rstrip("/")

    body: dict = {
        "items": itens,
        "external_reference": str(pedido_id),
        "back_urls": {
            "success": f"{frontend}/pedido.html?mp=success&pedido_id={pedido_id}",
            "failure": f"{frontend}/pagamento.html?mp=failure",
            "pending": f"{frontend}/pedido.html?mp=pending&pedido_id={pedido_id}",
        },
        "auto_return": "approved",
        "notification_url": f"{api_base}/pagamentos/webhook",
        "statement_descriptor": "PASTELARIA",
    }

    if payer_email:
        body["payer"] = {"email": payer_email}

    with httpx.Client(timeout=30.0) as client:
        response = client.post(f"{MP_API}/checkout/preferences", headers=_headers(), json=body)
        response.raise_for_status()
        return response.json()


def obter_url_checkout(preference: dict) -> str:
    """Retorna URL de checkout (sandbox ou produção)."""
    if settings.MERCADOPAGO_SANDBOX:
        url = preference.get("sandbox_init_point") or preference.get("init_point")
    else:
        url = preference.get("init_point") or preference.get("sandbox_init_point")
    if not url:
        raise ValueError("Mercado Pago não retornou URL de checkout")
    return url


def buscar_pagamento(payment_id: str) -> dict:
    with httpx.Client(timeout=30.0) as client:
        response = client.get(f"{MP_API}/v1/payments/{payment_id}", headers=_headers())
        response.raise_for_status()
        return response.json()
