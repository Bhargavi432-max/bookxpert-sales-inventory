from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, utcnow
from app.models.enums import InventoryTxnType, enum_column
from app.models.order import SalesOrder
from app.models.product import Product
from app.models.user import User


class InventoryTransaction(Base):
    """Append-only stock ledger: every change to products.stock_quantity writes one row."""

    __tablename__ = "inventory_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    txn_type: Mapped[InventoryTxnType] = mapped_column(enum_column(InventoryTxnType), index=True)
    quantity_change: Mapped[int] = mapped_column(Integer)
    balance_after: Mapped[int] = mapped_column(Integer)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("sales_orders.id"), index=True)
    note: Mapped[str | None] = mapped_column(String(255))
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, server_default=func.now(), index=True
    )

    product: Mapped[Product] = relationship()
    order: Mapped[SalesOrder | None] = relationship()
    created_by: Mapped[User | None] = relationship()

    @property
    def order_number(self) -> str | None:
        return self.order.order_number if self.order else None
