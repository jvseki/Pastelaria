from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from config import settings

_connect_args = {}
_db_url = settings.DATABASE_URL

if _db_url.startswith("sqlite"):
    _connect_args["check_same_thread"] = False
elif "supabase.co" in _db_url and "sslmode=" not in _db_url:
    sep = "&" if "?" in _db_url else "?"
    _db_url = f"{_db_url}{sep}sslmode=require"

engine = create_engine(
    _db_url,
    connect_args=_connect_args,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
