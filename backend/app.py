from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from config import settings
from database import engine, Base, SessionLocal
from models import Produto
from routes import auth, usuarios, produtos, pedidos, admin, pagamentos, loja


def _cors_origins() -> list[str]:
    origins = {settings.FRONTEND_URL.rstrip("/")}
    if settings.APP_ENV == "development":
        origins.update({"http://localhost:5500", "http://127.0.0.1:5500"})
    return [o for o in origins if o]


app = FastAPI(
    title="Pastéis Nakachi API",
    description="API do sistema de delivery da Pastelaria",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(produtos.router)
app.include_router(pedidos.router)
app.include_router(admin.router)
app.include_router(pagamentos.router)
app.include_router(loja.router)


@app.on_event("startup")
def startup():
    try:
        Base.metadata.create_all(bind=engine)
        _migrate_db()
        _backfill_numero_dia()
    except Exception as exc:
        msg = str(exc)
        if "UnicodeDecodeError" in type(exc).__name__ or "UnicodeDecodeError" in msg:
            raise RuntimeError(
                "Não foi possível conectar ao PostgreSQL. Verifique se o serviço está "
                "rodando, se o banco 'pastelaria' existe e se a senha no .env está correta. "
                "Para testar sem PostgreSQL, use: DATABASE_URL=sqlite:///./pastelaria.db"
            ) from exc
        raise


def _migrate_db():
    inspector = inspect(engine)
    if "pedidos" not in inspector.get_table_names():
        return
    colunas = {c["name"] for c in inspector.get_columns("pedidos")}
    with engine.connect() as conn:
        if "pagamento_confirmado" not in colunas:
            conn.execute(
                text("ALTER TABLE pedidos ADD COLUMN pagamento_confirmado BOOLEAN DEFAULT FALSE")
            )
        if "arquivado" not in colunas:
            conn.execute(text("ALTER TABLE pedidos ADD COLUMN arquivado BOOLEAN DEFAULT FALSE"))
        if "numero_dia" not in colunas:
            conn.execute(text("ALTER TABLE pedidos ADD COLUMN numero_dia INTEGER"))
        if "observacao" not in colunas:
            conn.execute(text("ALTER TABLE pedidos ADD COLUMN observacao VARCHAR(2000)"))
        if "tipo_entrega" not in colunas:
            conn.execute(text("ALTER TABLE pedidos ADD COLUMN tipo_entrega VARCHAR(20) DEFAULT 'entrega'"))
        if "taxa_entrega" not in colunas:
            conn.execute(text("ALTER TABLE pedidos ADD COLUMN taxa_entrega FLOAT DEFAULT 0"))
        if "local_retirada" not in colunas:
            conn.execute(text("ALTER TABLE pedidos ADD COLUMN local_retirada VARCHAR(500)"))
        if "mp_preference_id" not in colunas:
            conn.execute(text("ALTER TABLE pedidos ADD COLUMN mp_preference_id VARCHAR(100)"))
        if "mp_payment_id" not in colunas:
            conn.execute(text("ALTER TABLE pedidos ADD COLUMN mp_payment_id VARCHAR(100)"))
        conn.commit()


def _backfill_numero_dia():
    from services.numeracao_pedidos import sincronizar_numeros_dia

    db = SessionLocal()
    try:
        sincronizar_numeros_dia(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "Pastéis Nakachi API", "status": "online"}


if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app:app", host="0.0.0.0", port=port)
