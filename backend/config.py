from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/pastelaria"
    SECRET_KEY: str = "altere-esta-chave-secreta-em-producao"
    GOOGLE_CLIENT_ID: str = ""
    ADMIN_TOKEN: str = "admin-token-secreto"
    MOTOBOY_WHATSAPP: str = "5518997640335"
    PIX_CHAVE: str = "jv.s.m2006@hotmail.com"
    GOOGLE_MAPS_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:5500"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    class Config:
        env_file = ".env"


settings = Settings()
