from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import Usuario, Endereco
from services.google_auth import decode_token
from services.maps import geocodificar_endereco
from config import settings

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


class EnderecoRequest(BaseModel):
    nome: str
    telefone: str
    rua: str
    numero: str
    bairro: str
    referencia: Optional[str] = None


def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> Usuario:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Não autenticado")

    token = authorization.split(" ")[1]
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")

    usuario = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return usuario


@router.post("/endereco")
def salvar_endereco(
    body: EnderecoRequest,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    usuario.nome = body.nome
    usuario.telefone = body.telefone

    lat, lng = geocodificar_endereco(body.rua, body.numero, body.bairro, settings.GOOGLE_MAPS_API_KEY)

    endereco = db.query(Endereco).filter(Endereco.usuario_id == usuario.id).first()
    if endereco:
        endereco.rua = body.rua
        endereco.numero = body.numero
        endereco.bairro = body.bairro
        endereco.referencia = body.referencia
        endereco.latitude = lat
        endereco.longitude = lng
    else:
        endereco = Endereco(
            usuario_id=usuario.id,
            rua=body.rua,
            numero=body.numero,
            bairro=body.bairro,
            referencia=body.referencia,
            latitude=lat,
            longitude=lng,
        )
        db.add(endereco)

    db.commit()
    db.refresh(endereco)

    return {
        "cadastrado": True,
        "id": endereco.id,
        "rua": endereco.rua,
        "numero": endereco.numero,
        "bairro": endereco.bairro,
        "referencia": endereco.referencia,
        "latitude": endereco.latitude,
        "longitude": endereco.longitude,
        "usuario": {
            "id": usuario.id,
            "nome": usuario.nome,
            "email_google": usuario.email_google,
            "telefone": usuario.telefone,
        },
    }


@router.get("/endereco")
def get_endereco(usuario: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    endereco = db.query(Endereco).filter(Endereco.usuario_id == usuario.id).first()
    if not endereco:
        return {"cadastrado": False}

    return {
        "cadastrado": True,
        "id": endereco.id,
        "rua": endereco.rua,
        "numero": endereco.numero,
        "bairro": endereco.bairro,
        "referencia": endereco.referencia,
        "latitude": endereco.latitude,
        "longitude": endereco.longitude,
    }
