from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Integer, Numeric, String, Text, true
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        # Last line of defence against overselling, even if application logic is bypassed.
        CheckConstraint("stock_quantity >= 0", name="ck_products_stock_non_negative"),
        CheckConstraint("unit_price >= 0", name="ck_products_price_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0)
    reorder_level: Mapped[int] = mapped_column(Integer, default=10)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())

    @property
    def is_low_stock(self) -> bool:
        return self.stock_quantity <= self.reorder_level
