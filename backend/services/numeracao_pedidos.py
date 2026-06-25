from sqlalchemy.orm import Session

from models import Pedido


def proximo_numero_dia(db: Session) -> int:
    """Numero sequencial do dia; reinicia apos fechar a gaveta (arquivar pedidos)."""
    ultimo = (
        db.query(Pedido.numero_dia)
        .filter(Pedido.arquivado == False, Pedido.numero_dia.isnot(None))
        .order_by(Pedido.numero_dia.desc())
        .first()
    )
    return (ultimo[0] if ultimo else 0) + 1


def sincronizar_numeros_dia(db: Session) -> None:
    """Garante numeracao 1, 2, 3... nos pedidos ativos (util apos migracao)."""
    ativos = (
        db.query(Pedido)
        .filter(Pedido.arquivado == False)
        .order_by(Pedido.data_pedido.asc(), Pedido.id.asc())
        .all()
    )
    for i, pedido in enumerate(ativos, start=1):
        pedido.numero_dia = i
    db.commit()
