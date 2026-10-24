"""Informações públicas: somente os campos explicitamente permitidos."""
from fastapi import APIRouter
from config import settings

router = APIRouter(prefix="/loja", tags=["loja"])


@router.get("")
def informacoes_loja():
    return {
        "nome": settings.LOJA_NOME,
        "contato": settings.LOJA_CONTATO,
        "endereco": settings.LOJA_ENDERECO,
        "horarios": settings.LOJA_HORARIOS,
        "logo": settings.LOJA_LOGO,
        "banner": settings.LOJA_BANNER,
        "banner_raspadinhas": settings.LOJA_BANNER_RASPADINHAS,
        "demonstracao": settings.DEMO_MODE,
        "taxa_entrega": settings.TAXA_ENTREGA,
    }
