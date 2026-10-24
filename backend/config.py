from pydantic_settings import BaseSettings
from pydantic import Field, model_validator
from secrets import token_urlsafe
from typing import Literal


class Settings(BaseSettings):
    APP_ENV: Literal["development", "production"] = "development"
    DATABASE_URL: str = "sqlite:///./pastelaria.db"
    SECRET_KEY: str = Field(default_factory=lambda: token_urlsafe(48), min_length=32)
    GOOGLE_CLIENT_ID: str = ""
    ADMIN_EMAIL: str = ""
    MOTOBOY_WHATSAPP: str = ""
    DEMO_MODE: bool = False
    TAXA_ENTREGA: float = Field(default=5, ge=0, le=1000, allow_inf_nan=False)
    LOJA_NOME: str = "Pastéis Nakachi"
    LOJA_CONTATO: str = ""
    LOJA_ENDERECO: str = ""
    LOJA_HORARIOS: str = ""
    LOJA_LOGO: str = ""
    LOJA_BANNER: str = ""
    LOJA_BANNER_RASPADINHAS: str = ""
    GOOGLE_MAPS_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:5500"
    API_PUBLIC_URL: str = ""
    MERCADOPAGO_ACCESS_TOKEN: str = ""
    MERCADOPAGO_PUBLIC_KEY: str = ""
    MERCADOPAGO_SANDBOX: bool = False
    ALGORITHM: Literal["HS256"] = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12

    @model_validator(mode="after")
    def validar_producao(self):
        if self.SECRET_KEY in {"altere-esta-chave-secreta-em-producao", "gere-uma-chave-longa-e-aleatoria"}:
            raise ValueError("Gere uma SECRET_KEY aleatória; valores de exemplo não são aceitos.")
        if self.APP_ENV == "production":
            if "SECRET_KEY" not in self.model_fields_set:
                raise ValueError("SECRET_KEY persistente é obrigatória em produção.")
            if self.DEMO_MODE or self.MERCADOPAGO_SANDBOX:
                raise ValueError("Demonstração e Pix simulado são proibidos em produção.")
            if not self.FRONTEND_URL.startswith("https://"):
                raise ValueError("FRONTEND_URL deve usar HTTPS em produção.")
        return self

    class Config:
        env_file = ".env"
        extra = "ignore"
        hide_input_in_errors = True


settings = Settings()
