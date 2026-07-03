"""Criação de pedidos reutilizável (entrega e Mercado Pago)."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import Pedido, ItemPedido, Produto, Endereco, Usuario
from services.numeracao_pedidos import proximo_numero_dia


def criar_pedido_no_banco(
    db: Session,
    usuario: Usuario,
    *,
    pagamento: str,
    troco: float | None,
    tipo_entrega: str,
    taxa_entrega: float,
    local_retirada: str | None,
    observacao: str | None,
    itens_req: list,
    status: str = "pendente",
) -> tuple[Pedido, list[dict], Endereco | None]:
    if not itens_req:
        raise HTTPException(status_code=400, detail="Pedido sem itens")

    tipo = tipo_entrega if tipo_entrega in ("entrega", "retirada") else "entrega"
    taxa = max(taxa_entrega or 0, 0) if tipo == "entrega" else 0
    endereco = db.query(Endereco).filter(Endereco.usuario_id == usuario.id).first()

    if tipo == "entrega" and not endereco:
        raise HTTPException(status_code=400, detail="Cadastre seu endereço antes de pedir")

    pedido = Pedido(
        usuario_id=usuario.id,
        pagamento=pagamento,
        troco=troco,
        tipo_entrega=tipo,
        taxa_entrega=taxa,
        local_retirada=local_retirada if tipo == "retirada" else None,
        observacao=observacao,
        status=status,
        pagamento_confirmado=False,
        numero_dia=proximo_numero_dia(db),
    )
    db.add(pedido)
    db.flush()

    itens_resposta = []
    for item in itens_req:
        produto = db.query(Produto).filter(Produto.id == item.produto_id).first()
        if not produto:
            raise HTTPException(status_code=404, detail=f"Produto {item.produto_id} não encontrado")

        db.add(ItemPedido(pedido_id=pedido.id, produto_id=item.produto_id, quantidade=item.quantidade))
        itens_resposta.append({
            "produto_id": produto.id,
            "nome": produto.nome,
            "preco": produto.preco,
            "quantidade": item.quantidade,
        })

    return pedido, itens_resposta, endereco


def serializar_pedido_criado(pedido: Pedido, usuario: Usuario, itens_resposta: list, endereco) -> dict:
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
        "usuario": {
            "id": usuario.id,
            "nome": usuario.nome,
            "telefone": usuario.telefone,
        },
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
