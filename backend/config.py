from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/pastelaria"
    SECRET_KEY: str = "altere-esta-chave-secreta-em-producao"
    GOOGLE_CLIENT_ID: str = ""
    ADMIN_TOKEN: str = "admin-token-secreto"
    MOTOBOY_WHATSAPP: str = "5518997640335"
    GOOGLE_MAPS_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:5500"
    API_PUBLIC_URL: str = ""
    MERCADOPAGO_ACCESS_TOKEN: str = ""
    MERCADOPAGO_SANDBOX: bool = True
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 60

    class Config:
        env_file = ".env"


settings = Settings()
