from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, utcnow
from app.models.customer import Customer
from app.models.enums import ApprovalStatus, OrderStatus, enum_column
from app.models.mixins import TimestampMixin
from app.models.product import Product
from app.models.user import User


class SalesOrder(TimestampMixin, Base):
    __tablename__ = "sales_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Assigned right after the insert, from the generated id (SO-2026-000042).
    order_number: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[OrderStatus] = mapped_column(enum_column(OrderStatus), index=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    notes: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)

    customer: Mapped[Customer] = relationship()
    created_by: Mapped[User] = relationship()
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.id"
    )
    approval: Mapped["OrderApproval | None"] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_order_items_quantity_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    # Price is copied at order time so later price changes never rewrite history.
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    order: Mapped[SalesOrder] = relationship(back_populates="items")
    product: Mapped[Product] = relationship()


class OrderApproval(Base):
    __tablename__ = "order_approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id", ondelete="CASCADE"), unique=True)
    status: Mapped[ApprovalStatus] = mapped_column(enum_column(ApprovalStatus), index=True)
    # Threshold in force when the order was raised, kept for audit.
    threshold_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    requested_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, server_default=func.now())
    decided_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime)
    decision_comment: Mapped[str | None] = mapped_column(Text)

    order: Mapped[SalesOrder] = relationship(back_populates="approval")
    requested_by: Mapped[User] = relationship(foreign_keys=[requested_by_id])
    decided_by: Mapped[User | None] = relationship(foreign_keys=[decided_by_id])
