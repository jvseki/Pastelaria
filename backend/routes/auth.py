from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import Usuario
from services.google_auth import verify_google_token, create_access_token, is_google_configured
from routes.usuarios import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class GoogleLoginRequest(BaseModel):
    credential: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: dict


class AuthConfigResponse(BaseModel):
    google_client_id: str | None
    google_enabled: bool


@router.get("/config", response_model=AuthConfigResponse)
def auth_config():
    client_id = settings.GOOGLE_CLIENT_ID if is_google_configured() else None
    return AuthConfigResponse(
        google_client_id=client_id,
        google_enabled=is_google_configured(),
    )


@router.get("/me")
def get_me(usuario: Usuario = Depends(get_current_user)):
    return {
        "id": usuario.id,
        "nome": usuario.nome,
        "email_google": usuario.email_google,
        "telefone": usuario.telefone,
    }


@router.post("/google", response_model=LoginResponse)
def login_google(body: GoogleLoginRequest, db: Session = Depends(get_db)):
    try:
        idinfo = verify_google_token(body.credential)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=401, detail="Token Google inválido ou expirado")

    email = idinfo.get("email")
    nome = idinfo.get("name", "Usuário")

    usuario = db.query(Usuario).filter(Usuario.email_google == email).first()
    if not usuario:
        usuario = Usuario(nome=nome, email_google=email)
        db.add(usuario)
        db.commit()
        db.refresh(usuario)
    elif usuario.nome != nome:
        usuario.nome = nome
        db.commit()

    token = create_access_token({"sub": str(usuario.id), "email": email})

    return LoginResponse(
        access_token=token,
        usuario={
            "id": usuario.id,
            "nome": usuario.nome,
            "email_google": usuario.email_google,
            "telefone": usuario.telefone,
        },
    )
