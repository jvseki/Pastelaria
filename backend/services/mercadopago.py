"""Integração Mercado Pago — Pix (simulador sandbox + API em produção)."""

from __future__ import annotations

import httpx

from config import settings

MP_API = "https://api.mercadopago.com"


def mercadopago_habilitado() -> bool:
    if settings.MERCADOPAGO_SANDBOX:
        return True
    return bool(settings.MERCADOPAGO_ACCESS_TOKEN.strip())


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.MERCADOPAGO_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }


def _api_base_url() -> str:
    return settings.API_PUBLIC_URL.rstrip("/") or settings.FRONTEND_URL.rstrip("/")


def gerar_pix_simulado(*, pedido_id: int, valor: float) -> dict:
    """Pix fictício para testes locais — não chama a API do MP."""
    valor_fmt = f"{valor:.2f}".replace(".", "")
    copia_cola = (
        f"00020126580014br.gov.bcb.pix0136pastelaria-sandbox-p{pedido_id}"
        f"52040000530398654{valor_fmt}5802BR5925PASTELARIA DELIVERY6009SAO PAULO"
        f"62070503***6304{pedido_id % 10000:04d}"
    )
    return {
        "simulado": True,
        "copia_cola": copia_cola,
        "valor": valor,
        "pedido_id": pedido_id,
    }


def criar_pagamento_pix(
    *,
    pedido_id: int,
    valor: float,
    payer_email: str | None,
    descricao: str,
) -> dict:
    """Cria cobrança Pix real via API do Mercado Pago."""
    body: dict = {
        "transaction_amount": round(valor, 2),
        "description": descricao[:256],
        "payment_method_id": "pix",
        "payer": {"email": payer_email or "comprador@pastelaria.com"},
        "external_reference": str(pedido_id),
        "notification_url": f"{_api_base_url()}/pagamentos/webhook",
    }

    with httpx.Client(timeout=30.0) as client:
        response = client.post(f"{MP_API}/v1/payments", headers=_headers(), json=body)
        response.raise_for_status()
        return response.json()


def extrair_dados_pix(payment: dict) -> dict:
    """Extrai QR e copia-e-cola de um pagamento Pix do MP."""
    tx = (payment.get("point_of_interaction") or {}).get("transaction_data") or {}
    return {
        "simulado": False,
        "copia_cola": tx.get("qr_code") or "",
        "qr_code_base64": tx.get("qr_code_base64") or "",
        "valor": payment.get("transaction_amount"),
        "pedido_id": int(payment.get("external_reference") or 0),
        "payment_id": str(payment.get("id") or ""),
        "status": payment.get("status"),
    }


def buscar_pagamento(payment_id: str) -> dict:
    with httpx.Client(timeout=30.0) as client:
        response = client.get(f"{MP_API}/v1/payments/{payment_id}", headers=_headers())
        response.raise_for_status()
        return response.json()


def buscar_pagamentos_por_pedido(pedido_id: int) -> list[dict]:
    with httpx.Client(timeout=30.0) as client:
        response = client.get(
            f"{MP_API}/v1/payments/search",
            headers=_headers(),
            params={
                "sort": "date_created",
                "criteria": "desc",
                "external_reference": str(pedido_id),
            },
        )
        response.raise_for_status()
        data = response.json()
        return data.get("results") or []


def aplicar_status_pagamento(pedido, payment: dict) -> str:
    """Atualiza pedido conforme status do MP. Retorna o status MP."""
    status_mp = payment.get("status") or ""
    pedido.mp_payment_id = str(payment.get("id") or pedido.mp_payment_id or "")

    if status_mp == "approved":
        pedido.pagamento_confirmado = True
        pedido.status = "pendente"
    elif status_mp in ("rejected", "cancelled", "refunded"):
        pedido.status = "cancelado"

    return status_mp


def confirmar_pix_simulado(pedido) -> None:
    """Marca pagamento sandbox como aprovado."""
    pedido.pagamento_confirmado = True
    pedido.status = "pendente"
    pedido.mp_payment_id = pedido.mp_payment_id or f"SIM-{pedido.id}"
