from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from database import get_db
from models import Pedido, ItemPedido, Produto, Endereco
from routes.usuarios import get_current_user
from models import Usuario
from services.pedido_service import criar_pedido_no_banco, serializar_pedido_criado

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
