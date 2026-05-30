"""
Configuración y gestión de la conexión a la base de datos SQLite.
Usa SQLAlchemy con el patrón de session por solicitud.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
from typing import Generator

from config import DATABASE_URL
from database.modelos_sql import Base
from utils.logger import get_logger

logger = get_logger(__name__)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # necesario para SQLite
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def crear_tablas() -> None:
    """Crea todas las tablas si no existen."""
    Base.metadata.create_all(bind=engine)
    logger.info("Tablas de base de datos inicializadas.")


@contextmanager
def get_db() -> Generator[Session, None, None]:
    """Context manager que proporciona una sesión de BD y la cierra al salir."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_db_dependency() -> Generator[Session, None, None]:
    """Generador para inyección de dependencias en FastAPI."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
