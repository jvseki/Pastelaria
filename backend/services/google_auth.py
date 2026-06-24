from google.oauth2 import id_token
from google.auth.transport import requests
from jose import jwt
from datetime import datetime, timedelta, timezone

from config import settings

PLACEHOLDER_CLIENT_IDS = {
    "",
    "seu-google-client-id.apps.googleusercontent.com",
    "SEU_GOOGLE_CLIENT_ID",
}


def is_google_configured() -> bool:
    return settings.GOOGLE_CLIENT_ID not in PLACEHOLDER_CLIENT_IDS


def verify_google_token(credential: str) -> dict:
    if not is_google_configured():
        raise ValueError("Google OAuth não configurado no servidor")

    idinfo = id_token.verify_oauth2_token(
        credential, requests.Request(), settings.GOOGLE_CLIENT_ID
    )

    if not idinfo.get("email"):
        raise ValueError("E-mail não encontrado no token Google")

    if not idinfo.get("email_verified", False):
        raise ValueError("E-mail Google não verificado")

    return idinfo


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
