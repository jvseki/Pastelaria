from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import Pedido, ItemPedido, Produto, Endereco
from routes.usuarios import get_current_user
from models import Usuario
from services.numeracao_pedidos import proximo_numero_dia

router = APIRouter(prefix="/pedidos", tags=["pedidos"])


class ItemPedidoRequest(BaseModel):
    produto_id: int
    quantidade: int


class PedidoRequest(BaseModel):
    pagamento: str
    troco: Optional[float] = None
    observacao: Optional[str] = None
    itens: list[ItemPedidoRequest]


@router.post("")
def criar_pedido(
    body: PedidoRequest,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.itens:
        raise HTTPException(status_code=400, detail="Pedido sem itens")

    endereco = db.query(Endereco).filter(Endereco.usuario_id == usuario.id).first()
    if not endereco:
        raise HTTPException(status_code=400, detail="Cadastre seu endereço antes de pedir")

    pedido = Pedido(
        usuario_id=usuario.id,
        pagamento=body.pagamento,
        troco=body.troco,
        observacao=body.observacao,
        status="pendente",
        numero_dia=proximo_numero_dia(db),
    )
    db.add(pedido)
    db.flush()

    itens_resposta = []
    for item in body.itens:
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

    db.commit()
    db.refresh(pedido)

    return {
        "id": pedido.id,
        "numero_dia": pedido.numero_dia,
        "pagamento": pedido.pagamento,
        "troco": pedido.troco,
        "status": pedido.status,
        "pagamento_confirmado": bool(pedido.pagamento_confirmado),
        "data_pedido": pedido.data_pedido.isoformat() if pedido.data_pedido else None,
        "usuario": {
            "id": usuario.id,
            "nome": usuario.nome,
            "telefone": usuario.telefone,
        },
        "endereco": {
            "rua": endereco.rua,
            "numero": endereco.numero,
            "bairro": endereco.bairro,
            "referencia": endereco.referencia,
            "latitude": endereco.latitude,
            "longitude": endereco.longitude,
        },
        "itens": itens_resposta,
    }
