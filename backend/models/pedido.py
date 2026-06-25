from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class Pedido(Base):
    __tablename__ = "pedidos"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    pagamento = Column(String(50), nullable=False)
    troco = Column(Float)
    status = Column(String(50), default="pendente")
    pagamento_confirmado = Column(Boolean, default=False)
    arquivado = Column(Boolean, default=False)
    numero_dia = Column(Integer)
    data_pedido = Column(DateTime(timezone=True), server_default=func.now())

    usuario = relationship("Usuario", back_populates="pedidos")
    itens = relationship("ItemPedido", back_populates="pedido", cascade="all, delete-orphan")
