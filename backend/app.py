from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from config import settings
from database import engine, Base, SessionLocal
from models import Produto
from routes import auth, usuarios, produtos, pedidos, admin

app = FastAPI(
    title="Pastelaria Delivery API",
    description="API do sistema de delivery da Pastelaria",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5500", "http://127.0.0.1:5500", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(produtos.router)
app.include_router(pedidos.router)
app.include_router(admin.router)


@app.on_event("startup")
def startup():
    try:
        Base.metadata.create_all(bind=engine)
        _migrate_db()
        _seed_produtos()
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
                text("ALTER TABLE pedidos ADD COLUMN pagamento_confirmado BOOLEAN DEFAULT 0")
            )
        if "arquivado" not in colunas:
            conn.execute(text("ALTER TABLE pedidos ADD COLUMN arquivado BOOLEAN DEFAULT 0"))
        conn.commit()


CATALOGO_PRODUTOS = [
    {
        "nome": "Pastel de Queijo",
        "descricao": "Massa fina e crocante com queijo derretido",
        "preco": 8.0,
        "imagem": "images/produtos/pastel-queijo.svg",
        "categoria": "Salgados",
    },
    {
        "nome": "Pastel de Carne",
        "descricao": "Carne moída temperada na massa dourada",
        "preco": 9.0,
        "imagem": "images/produtos/pastel-carne.svg",
        "categoria": "Salgados",
    },
    {
        "nome": "Pastel de Frango",
        "descricao": "Frango desfiado com catupiry cremoso",
        "preco": 9.5,
        "imagem": "images/produtos/pastel-frango.svg",
        "categoria": "Salgados",
    },
    {
        "nome": "Pastel de Palmito",
        "descricao": "Palmito refogado com queijo gratinado",
        "preco": 10.0,
        "imagem": "images/produtos/pastel-palmito.svg",
        "categoria": "Salgados",
    },
    {
        "nome": "Pastel de Nutella",
        "descricao": "Pastel doce recheado com Nutella",
        "preco": 12.0,
        "imagem": "images/produtos/pastel-nutella.svg",
        "categoria": "Doces",
    },
    {
        "nome": "Pastel de Doce de Leite",
        "descricao": "Doce de leite cremoso na massa quente",
        "preco": 11.0,
        "imagem": "images/produtos/pastel-doce-leite.svg",
        "categoria": "Doces",
    },
    {
        "nome": "Coca-Cola Lata",
        "descricao": "Refrigerante Coca-Cola 350ml gelada",
        "preco": 6.0,
        "imagem": "images/produtos/coca-cola.svg",
        "categoria": "Bebidas",
    },
    {
        "nome": "Agua Mineral",
        "descricao": "Agua mineral sem gas 500ml",
        "preco": 4.0,
        "imagem": "images/produtos/agua.svg",
        "categoria": "Bebidas",
    },
    {
        "nome": "Suco Natural",
        "descricao": "Suco de laranja natural 500ml",
        "preco": 8.0,
        "imagem": "images/produtos/suco.svg",
        "categoria": "Bebidas",
    },
    {
        "nome": "Caldo de Cana",
        "descricao": "Caldo de cana fresco 400ml",
        "preco": 7.0,
        "imagem": "images/produtos/caldo-cana.svg",
        "categoria": "Bebidas",
    },
    {
        "nome": "Combo Familia",
        "descricao": "5 pasteis salgados + 2 refrigerantes",
        "preco": 45.0,
        "imagem": "images/produtos/combo.svg",
        "categoria": "Combos",
    },
]


def _seed_produtos():
    db = SessionLocal()
    try:
        for item in CATALOGO_PRODUTOS:
            existente = db.query(Produto).filter(Produto.nome == item["nome"]).first()
            if not existente and item["nome"] == "Combo Familia":
                existente = db.query(Produto).filter(Produto.nome == "Combo Família").first()
            if existente:
                existente.nome = item["nome"]
                existente.descricao = item["descricao"]
                existente.preco = item["preco"]
                existente.imagem = item["imagem"]
                existente.categoria = item["categoria"]
                existente.ativo = True
            else:
                db.add(Produto(**item))
        db.commit()
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "Pastelaria Delivery API", "status": "online"}
