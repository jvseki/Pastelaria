from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(200), nullable=False)
    email_google = Column(String(200), unique=True, nullable=False)
    telefone = Column(String(20))

    enderecos = relationship("Endereco", back_populates="usuario")
    pedidos = relationship("Pedido", back_populates="usuario")
