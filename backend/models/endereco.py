from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship

from database import Base


class Endereco(Base):
    __tablename__ = "enderecos"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    rua = Column(String(200), nullable=False)
    numero = Column(String(20), nullable=False)
    bairro = Column(String(100), nullable=False)
    referencia = Column(Text)
    latitude = Column(Float)
    longitude = Column(Float)

    usuario = relationship("Usuario", back_populates="enderecos")
