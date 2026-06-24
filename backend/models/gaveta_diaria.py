from sqlalchemy import Column, Integer, Float, Date, DateTime, JSON
from sqlalchemy.sql import func

from database import Base


class GavetaDiaria(Base):
    """Histórico arquivado ao fechar o dia — como uma gaveta de pedidos."""

    __tablename__ = "gavetas_diarias"

    id = Column(Integer, primary_key=True, index=True)
    data_referencia = Column(Date, nullable=False)
    fechado_em = Column(DateTime(timezone=True), server_default=func.now())
    qtd_pedidos = Column(Integer, default=0)
    total_vendas = Column(Float, default=0.0)
    pedidos_snapshot = Column(JSON, nullable=False)
