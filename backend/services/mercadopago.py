"""Integração Mercado Pago — Pix (simulador sandbox + API em produção)."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

import httpx

from config import settings

MP_API = "https://api.mercadopago.com"


def mercadopago_habilitado() -> bool:
    if settings.MERCADOPAGO_SANDBOX:
        return True
    return bool(settings.MERCADOPAGO_ACCESS_TOKEN.strip())


def cartao_online_habilitado() -> bool:
    if not settings.MERCADOPAGO_PUBLIC_KEY.strip():
        return False
    return bool(settings.MERCADOPAGO_ACCESS_TOKEN.strip())


def cartao_simulador_habilitado() -> bool:
    """Cartão de teste no site — sem credenciais MP (só com SANDBOX=true)."""
    return settings.MERCADOPAGO_SANDBOX and not cartao_online_habilitado()


def cartao_checkout_disponivel() -> bool:
    return cartao_online_habilitado() or cartao_simulador_habilitado()


def normalizar_cpf(cpf: str | None) -> str:
    return re.sub(r"\D", "", cpf or "")


def validar_cpf(cpf: str | None) -> str:
    digits = normalizar_cpf(cpf)
    if len(digits) != 11:
        raise ValueError("Informe um CPF válido com 11 dígitos")
    return digits


def _split_nome(nome: str | None) -> tuple[str, str]:
    partes = (nome or "Cliente").strip().split(maxsplit=1)
    primeiro = partes[0][:50] if partes else "Cliente"
    sobrenome = (partes[1] if len(partes) > 1 else "Cliente")[:50]
    return primeiro, sobrenome


def _headers(*, idempotency_key: str | None = None) -> dict:
    headers = {
        "Authorization": f"Bearer {settings.MERCADOPAGO_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    if idempotency_key:
        headers["X-Idempotency-Key"] = idempotency_key
    return headers


def _api_base_url() -> str:
    return settings.API_PUBLIC_URL.rstrip("/") or settings.FRONTEND_URL.rstrip("/")


def mensagem_erro_mp(exc: httpx.HTTPStatusError) -> str:
    try:
        data = exc.response.json()
        causes = data.get("cause") or []
        descricoes = [c.get("description") for c in causes if isinstance(c, dict) and c.get("description")]
        if descricoes:
            return "; ".join(descricoes)
        if data.get("message"):
            return str(data["message"])
    except Exception:
        pass
    if exc.response.status_code == 401:
        return "Access Token do Mercado Pago inválido ou expirado"
    return "Erro ao gerar Pix no Mercado Pago"


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
    payer_nome: str | None,
    payer_cpf: str | None,
    descricao: str,
    idempotency_suffix: str | None = None,
) -> dict:
    """Cria cobrança Pix real via API do Mercado Pago."""
    cpf = validar_cpf(payer_cpf)
    primeiro_nome, sobrenome = _split_nome(payer_nome)
    expira = datetime.now(timezone.utc) + timedelta(minutes=30)

    body: dict = {
        "transaction_amount": round(valor, 2),
        "description": descricao[:256],
        "payment_method_id": "pix",
        "date_of_expiration": expira.strftime("%Y-%m-%dT%H:%M:%S.000-03:00"),
        "payer": {
            "email": payer_email or "comprador@pastelaria.com",
            "first_name": primeiro_nome,
            "last_name": sobrenome,
            "identification": {
                "type": "CPF",
                "number": cpf,
            },
        },
        "external_reference": str(pedido_id),
        "notification_url": f"{_api_base_url()}/pagamentos/webhook",
    }

    with httpx.Client(timeout=30.0) as client:
        idem = f"pastelaria-pix-{pedido_id}"
        if idempotency_suffix:
            idem = f"{idem}-{idempotency_suffix}"
        response = client.post(
            f"{MP_API}/v1/payments",
            headers=_headers(idempotency_key=idem),
            json=body,
        )
        response.raise_for_status()
        return response.json()


def criar_pagamento_cartao(
    *,
    pedido_id: int,
    valor: float,
    token: str,
    payment_method_id: str,
    installments: int,
    issuer_id: str | None,
    payer_email: str | None,
    payer_nome: str | None,
    payer_cpf: str | None,
    descricao: str,
    idempotency_suffix: str | None = None,
) -> dict:
    """Cria cobrança com cartão via token do Brick."""
    cpf = validar_cpf(payer_cpf)
    primeiro_nome, sobrenome = _split_nome(payer_nome)

    body: dict = {
        "transaction_amount": round(valor, 2),
        "token": token,
        "description": descricao[:256],
        "installments": max(1, int(installments or 1)),
        "payment_method_id": payment_method_id,
        "payer": {
            "email": payer_email or "comprador@pastelaria.com",
            "first_name": primeiro_nome,
            "last_name": sobrenome,
            "identification": {
                "type": "CPF",
                "number": cpf,
            },
        },
        "external_reference": str(pedido_id),
        "notification_url": f"{_api_base_url()}/pagamentos/webhook",
    }
    if issuer_id:
        body["issuer_id"] = str(issuer_id)

    with httpx.Client(timeout=30.0) as client:
        idem = f"pastelaria-card-{pedido_id}"
        if idempotency_suffix:
            idem = f"{idem}-{idempotency_suffix}"
        response = client.post(
            f"{MP_API}/v1/payments",
            headers=_headers(idempotency_key=idem),
            json=body,
        )
        response.raise_for_status()
        return response.json()


def resumo_pagamento_cartao(payment: dict) -> dict:
    return {
        "payment_id": str(payment.get("id") or ""),
        "status": payment.get("status"),
        "status_detail": payment.get("status_detail"),
        "pedido_id": int(payment.get("external_reference") or 0),
    }


def extrair_dados_pix(payment: dict) -> dict:
    """Extrai QR e copia-e-cola de um pagamento Pix do MP."""
    tx = (payment.get("point_of_interaction") or {}).get("transaction_data") or {}
    copia_cola = tx.get("qr_code") or ""
    if not copia_cola:
        raise ValueError("Mercado Pago não retornou o código Pix")
    return {
        "simulado": False,
        "copia_cola": copia_cola,
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


def confirmar_cartao_simulado(pedido) -> None:
    """Marca pagamento com cartão simulado como aprovado."""
    pedido.pagamento_confirmado = True
    pedido.status = "pendente"
    pedido.mp_payment_id = pedido.mp_payment_id or f"SIM-CARD-{pedido.id}"


def estornar_pagamento(payment_id: str) -> dict:
    """Estorna pagamento Pix aprovado no Mercado Pago."""
    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            f"{MP_API}/v1/payments/{payment_id}/refunds",
            headers=_headers(idempotency_key=f"pastelaria-refund-{payment_id}"),
        )
        response.raise_for_status()
        return response.json()


def obter_pix_de_pagamento_existente(payment: dict) -> dict | None:
    """Retorna dados Pix se o pagamento ainda estiver pendente."""
    status = payment.get("status")
    if status not in ("pending", "in_process", "authorized"):
        return None
    dados = extrair_dados_pix(payment)
    return dados if dados.get("copia_cola") else None

