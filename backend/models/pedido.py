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
    tipo_entrega = Column(String(20), default="entrega")
    taxa_entrega = Column(Float, default=0)
    local_retirada = Column(String(500))
    observacao = Column(String(2000))
    mp_preference_id = Column(String(100))
    mp_payment_id = Column(String(100))
    data_pedido = Column(DateTime(timezone=True), server_default=func.now())

    usuario = relationship("Usuario", back_populates="pedidos")
    itens = relationship("ItemPedido", back_populates="pedido", cascade="all, delete-orphan")
