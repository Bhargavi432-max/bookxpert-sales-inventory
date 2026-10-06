from collections.abc import Generator
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, pool_recycle=3600)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    """Naive UTC timestamp; every DATETIME column in the database is stored in UTC."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_db() -> Generator[Session, None, None]:
    """One session per request. Any unhandled error rolls back the open transaction."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
