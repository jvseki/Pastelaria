"""Carga explícita e não destrutiva, somente em catálogo vazio e DEMO_MODE=true."""
from config import settings
from database import Base, engine, SessionLocal
from models import Produto

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
        "descricao": "5 pasteis salgados + 2 bebidas — voce escolhe os sabores!",
        "preco": 45.0,
        "imagem": "images/produtos/combo.svg",
        "categoria": "Combos",
    },
    {"nome": "Raspadinha de cana com morango", "descricao": "Cana, gelo e morango. Porção demonstrativa de 400 ml.", "preco": 12, "imagem": "images/produtos/caldo-cana.svg", "categoria": "Raspadinhas de cana"},
    {"nome": "Raspadinha de cana com maracujá", "descricao": "Cana, gelo e maracujá. Porção demonstrativa de 400 ml.", "preco": 12, "imagem": "images/produtos/suco.svg", "categoria": "Raspadinhas de cana"},
    {"nome": "Raspadinha de cana com limão", "descricao": "Cana, gelo e limão. Porção demonstrativa de 400 ml.", "preco": 10, "imagem": "images/produtos/caldo-cana.svg", "categoria": "Raspadinhas de cana"},
]


def seed_demo(db):
    if not settings.DEMO_MODE:
        raise ValueError("Defina DEMO_MODE=true somente no ambiente de demonstração.")
    if db.query(Produto).first():
        raise ValueError("Catálogo já contém produtos. Nenhum cadastro foi alterado.")
    db.add_all([Produto(**item) for item in CATALOGO_PRODUTOS])
    db.commit()
    return len(CATALOGO_PRODUTOS)


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        print(f"{seed_demo(db)} produtos demonstrativos cadastrados.")
