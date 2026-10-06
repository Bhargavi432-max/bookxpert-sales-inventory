from sqlalchemy import Boolean, String, true
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import UserRole, enum_column
from app.models.mixins import TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(enum_column(UserRole), default=UserRole.SALES)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
