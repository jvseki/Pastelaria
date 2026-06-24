from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Produto

router = APIRouter(prefix="/produtos", tags=["produtos"])


@router.get("")
def listar_produtos(db: Session = Depends(get_db)):
    produtos = db.query(Produto).filter(Produto.ativo == True).all()
    return [
        {
            "id": p.id,
            "nome": p.nome,
            "descricao": p.descricao,
            "preco": p.preco,
            "imagem": p.imagem,
            "categoria": p.categoria,
            "ativo": p.ativo,
        }
        for p in produtos
    ]
