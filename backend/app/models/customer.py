from sqlalchemy import Boolean, String, Text, true
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(20))
    address: Mapped[str | None] = mapped_column(Text)
    gstin: Mapped[str | None] = mapped_column(String(15))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
