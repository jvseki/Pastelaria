from sqlalchemy import Column, Integer, String, Float, Boolean, Text

from database import Base


class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(200), nullable=False)
    descricao = Column(Text)
    preco = Column(Float, nullable=False)
    imagem = Column(String(500))
    categoria = Column(String(100), nullable=False)
    ativo = Column(Boolean, default=True)
