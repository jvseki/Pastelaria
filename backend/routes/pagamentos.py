import logging
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from config import settings
from database import get_db
from models import Pedido, Usuario, ItemPedido, Endereco
from routes.pedidos import PedidoRequest
from routes.usuarios import get_current_user
from services.mercadopago import (
    aplicar_status_pagamento,
    buscar_pagamento,
    buscar_pagamentos_por_pedido,
    cartao_online_habilitado,
    cartao_simulador_habilitado,
    confirmar_pix_simulado,
    confirmar_cartao_simulado,
    criar_pagamento_cartao,
    criar_pagamento_pix,
    criar_preferencia_checkout,
    buscar_preferencia,
    url_checkout_preferencia,
    extrair_dados_pix,
    gerar_pix_simulado,
    mensagem_erro_mp,
    mercadopago_habilitado,
    mensagem_recusa_cartao,
    aviso_credenciais_mp,
    obter_pix_de_pagamento_existente,
    resumo_pagamento_cartao,
    validar_cpf,
)
from services.pedido_service import criar_pedido_no_banco, serializar_pedido_criado

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pagamentos", tags=["pagamentos"])


class RetomarPixRequest(BaseModel):
    cpf: str | None = None


class CheckoutCartaoRequest(PedidoRequest):
    token: str
    payment_method_id: str
    installments: int = 1
    issuer_id: str | None = None


class CheckoutProRequest(PedidoRequest):
    modo: str  # credito | debito


def _itens_resposta(pedido: Pedido) -> list[dict]:
    itens = []
    for item in pedido.itens:
        produto = item.produto
        itens.append({
            "produto_id": item.produto_id,
            "nome": produto.nome if produto else "Produto",
            "preco": produto.preco if produto else 0,
            "quantidade": item.quantidade,
        })
    return itens


def _valor_pedido(pedido: Pedido, itens_resposta: list[dict]) -> float:
    return sum(float(i["preco"]) * i["quantidade"] for i in itens_resposta) + float(pedido.taxa_entrega or 0)


def _gerar_pix_pedido(
    *,
    pedido: Pedido,
    usuario: Usuario,
    cpf: str | None,
    itens_resposta: list[dict],
) -> dict:
    valor = _valor_pedido(pedido, itens_resposta)
    if valor <= 0:
        raise ValueError("Valor do pedido inválido para pagamento")

    if settings.MERCADOPAGO_SANDBOX:
        pedido.mp_payment_id = pedido.mp_payment_id or f"SIM-{pedido.id}"
        return gerar_pix_simulado(pedido_id=pedido.id, valor=valor)

    if not settings.MERCADOPAGO_ACCESS_TOKEN.strip():
        raise ValueError("Access Token do Mercado Pago não configurado")

    payment_id = (pedido.mp_payment_id or "").strip()
    if payment_id and not payment_id.startswith("SIM-"):
        try:
            payment = buscar_pagamento(payment_id)
            pix = obter_pix_de_pagamento_existente(payment)
            if pix:
                return pix
        except httpx.HTTPStatusError:
            logger.info("Pagamento MP %s indisponível para retomada; gerando novo Pix", payment_id)

    cpf_validado = validar_cpf(cpf)
    payment = criar_pagamento_pix(
        pedido_id=pedido.id,
        valor=valor,
        payer_email=usuario.email_google,
        payer_nome=usuario.nome,
        payer_cpf=cpf_validado,
        descricao=f"Pedido #{pedido.numero_dia or pedido.id} — Pastelaria",
        idempotency_suffix=str(int(time.time())),
    )
    pedido.mp_payment_id = str(payment.get("id") or "")
    return extrair_dados_pix(payment)


@router.get("/config")
def config_mercadopago():
    sandbox = settings.MERCADOPAGO_SANDBOX
    return {
        "habilitado": mercadopago_habilitado(),
        "sandbox": sandbox,
        "modo": "simulador_pix" if sandbox else "pix_mercadopago",
        "cartao_habilitado": cartao_online_habilitado(),
        "aviso_credenciais": aviso_credenciais_mp(),
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
        pix = _gerar_pix_pedido(
            pedido=pedido,
            usuario=usuario,
            cpf=body.cpf,
            itens_resposta=itens_resposta,
        )
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


@router.post("/checkout-cartao")
def iniciar_pagamento_cartao(
    body: CheckoutCartaoRequest,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cria pedido e processa pagamento com cartão (Mercado Pago Brick)."""
    if not cartao_online_habilitado():
        raise HTTPException(
            status_code=503,
            detail="Pagamento com cartão online não configurado. Defina MERCADOPAGO_PUBLIC_KEY e ACCESS_TOKEN no Render.",
        )

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
        cpf_validado = validar_cpf(body.cpf)
        payment = criar_pagamento_cartao(
            pedido_id=pedido.id,
            valor=valor,
            token=body.token,
            payment_method_id=body.payment_method_id,
            installments=body.installments,
            issuer_id=body.issuer_id,
            payer_email=usuario.email_google,
            payer_nome=usuario.nome,
            payer_cpf=cpf_validado,
            descricao=f"Pedido #{pedido.numero_dia or pedido.id} — Pastelaria",
            idempotency_suffix=str(int(time.time())),
        )
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        db.rollback()
        detail = mensagem_erro_mp(exc)
        logger.error("Erro MP cartão: %s", exc.response.text)
        raise HTTPException(status_code=502, detail=detail) from exc

    status_mp = aplicar_status_pagamento(pedido, payment)
    if status_mp in ("rejected", "cancelled"):
        pedido.status = "cancelado"
        db.commit()
        detail = mensagem_recusa_cartao(payment)
        logger.warning("Cartão recusado pedido %s: %s", pedido.id, payment.get("status_detail"))
        raise HTTPException(status_code=402, detail=detail)

    db.commit()
    db.refresh(pedido)

    dados = serializar_pedido_criado(pedido, usuario, itens_resposta, endereco)
    dados["cartao"] = resumo_pagamento_cartao(payment)
    return dados


@router.post("/checkout-pro")
def iniciar_checkout_pro(
    body: CheckoutProRequest,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cria pedido e redireciona para Checkout Pro (crédito ou débito no site do MP)."""
    modo = (body.modo or "").strip().lower()
    if modo not in ("credito", "debito"):
        raise HTTPException(status_code=400, detail="Modo inválido. Use credito ou debito.")

    if not cartao_online_habilitado():
        raise HTTPException(
            status_code=503,
            detail="Pagamento com cartão não configurado. Defina MERCADOPAGO_ACCESS_TOKEN no Render.",
        )

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
        preference = criar_preferencia_checkout(
            pedido_id=pedido.id,
            valor=valor,
            titulo=f"Pedido #{pedido.numero_dia or pedido.id} — Pastelaria",
            payer_email=usuario.email_google,
            modo=modo,
        )
    except httpx.HTTPStatusError as exc:
        db.rollback()
        detail = mensagem_erro_mp(exc)
        logger.error("Erro MP Checkout Pro: %s", exc.response.text)
        raise HTTPException(status_code=502, detail=detail) from exc

    checkout_url = url_checkout_preferencia(preference)
    if not checkout_url:
        db.rollback()
        raise HTTPException(status_code=502, detail="Mercado Pago não retornou o link de pagamento")

    pedido.mp_preference_id = str(preference.get("id") or "")
    db.commit()
    db.refresh(pedido)

    dados = serializar_pedido_criado(pedido, usuario, itens_resposta, endereco)
    dados["checkout_url"] = checkout_url
    dados["modo_cartao"] = modo
    return dados


@router.post("/retomar-checkout-pro/{pedido_id}")
def retomar_checkout_pro(
    pedido_id: int,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retoma pagamento Checkout Pro pendente."""
    if not cartao_online_habilitado():
        raise HTTPException(status_code=503, detail="Checkout Pro não configurado")

    pedido = (
        db.query(Pedido)
        .filter(Pedido.id == pedido_id, Pedido.usuario_id == usuario.id)
        .options(joinedload(Pedido.itens).joinedload(ItemPedido.produto))
        .first()
    )
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if pedido.pagamento != "mercadopago":
        raise HTTPException(status_code=400, detail="Pedido não é pagamento online")
    if pedido.pagamento_confirmado:
        raise HTTPException(status_code=400, detail="Este pedido já foi pago")
    if pedido.status != "aguardando_pagamento":
        raise HTTPException(status_code=400, detail="Este pedido não está aguardando pagamento")

    pref_id = (pedido.mp_preference_id or "").strip()
    if not pref_id:
        raise HTTPException(
            status_code=400,
            detail="Este pedido é pagamento Pix. Use Finalizar pagamento Pix em Meus pedidos.",
        )

    checkout_url = ""
    if pref_id:
        try:
            preference = buscar_preferencia(pref_id)
            checkout_url = url_checkout_preferencia(preference)
        except httpx.HTTPStatusError:
            checkout_url = ""

    if not checkout_url:
        raise HTTPException(
            status_code=400,
            detail="Link de pagamento expirado. Faça um novo pedido na tela de pagamento.",
        )

    itens_resposta = _itens_resposta(pedido)
    endereco_db = db.query(Endereco).filter(Endereco.usuario_id == usuario.id).first()
    dados = serializar_pedido_criado(pedido, usuario, itens_resposta, endereco_db)
    dados["checkout_url"] = checkout_url
    return dados


@router.post("/checkout-cartao-simulado")
def iniciar_pagamento_cartao_simulado(
    body: PedidoRequest,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sandbox sem credenciais MP: confirma cartão fictício na hora (igual ao Pix simulado)."""
    if not cartao_simulador_habilitado():
        raise HTTPException(status_code=404, detail="Simulador de cartão indisponível")

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

    confirmar_cartao_simulado(pedido)
    db.commit()
    db.refresh(pedido)

    dados = serializar_pedido_criado(pedido, usuario, itens_resposta, endereco)
    dados["cartao"] = {
        "simulado": True,
        "status": "approved",
        "payment_id": pedido.mp_payment_id,
        "pedido_id": pedido.id,
    }
    return dados


@router.get("/pendentes")
def contar_pagamentos_pendentes(
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quantidade = (
        db.query(Pedido)
        .filter(
            Pedido.usuario_id == usuario.id,
            Pedido.pagamento == "mercadopago",
            Pedido.status == "aguardando_pagamento",
            Pedido.pagamento_confirmado == False,  # noqa: E712
        )
        .count()
    )
    return {"quantidade": quantidade}


@router.post("/retomar/{pedido_id}")
def retomar_pagamento_pix(
    pedido_id: int,
    body: RetomarPixRequest,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retoma Pix de pedido com pagamento não finalizado."""
    if not mercadopago_habilitado():
        raise HTTPException(status_code=503, detail="Pix online não configurado na API")

    pedido = (
        db.query(Pedido)
        .filter(Pedido.id == pedido_id, Pedido.usuario_id == usuario.id)
        .options(joinedload(Pedido.itens).joinedload(ItemPedido.produto))
        .first()
    )
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if pedido.pagamento != "mercadopago":
        raise HTTPException(status_code=400, detail="Pedido não é pagamento online")
    if pedido.pagamento_confirmado:
        raise HTTPException(status_code=400, detail="Este pedido já foi pago")
    if pedido.status != "aguardando_pagamento":
        raise HTTPException(status_code=400, detail="Este pedido não está aguardando pagamento")
    if pedido.mp_preference_id and not (pedido.mp_payment_id or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Este pedido é pagamento com cartão. Retome pelo botão no Mercado Pago em Meus pedidos.",
        )

    itens_resposta = _itens_resposta(pedido)

    try:
        pix = _gerar_pix_pedido(
            pedido=pedido,
            usuario=usuario,
            cpf=body.cpf,
            itens_resposta=itens_resposta,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        detail = mensagem_erro_mp(exc)
        logger.error("Erro MP retomar Pix pedido %s: %s", pedido_id, exc.response.text)
        raise HTTPException(status_code=502, detail=detail) from exc

    db.commit()
    db.refresh(pedido)

    endereco_db = db.query(Endereco).filter(Endereco.usuario_id == usuario.id).first()
    dados = serializar_pedido_criado(pedido, usuario, itens_resposta, endereco_db)
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
        raise HTTPException(status_code=400, detail="Pedido não é pagamento online")
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
        raise HTTPException(status_code=400, detail="Pedido não é pagamento online")

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
