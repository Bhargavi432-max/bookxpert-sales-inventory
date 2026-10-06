from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import InventoryTxnType
from app.schemas.common import Money, ORMModel, TrimmedStr, UTCDateTime
from app.schemas.user import UserBrief

Sku = Annotated[TrimmedStr, Field(min_length=2, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")]
Name = Annotated[TrimmedStr, Field(min_length=2, max_length=200)]
Description = Annotated[TrimmedStr, Field(max_length=1000)]
Price = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
ReorderLevel = Annotated[int, Field(ge=0, le=100_000)]


class ProductBrief(ORMModel):
    id: int
    sku: str
    name: str


class ProductOut(ProductBrief):
    description: str | None
    unit_price: Money
    stock_quantity: int
    reorder_level: int
    is_low_stock: bool
    is_active: bool
    created_at: UTCDateTime
    updated_at: UTCDateTime


class ProductCreate(BaseModel):
    sku: Sku
    name: Name
    description: Description | None = None
    unit_price: Price
    reorder_level: ReorderLevel = 10
    initial_stock: Annotated[int, Field(ge=0, le=1_000_000)] = 0

    @field_validator("sku")
    @classmethod
    def normalise_sku(cls, value: str) -> str:
        return value.upper()


class ProductUpdate(BaseModel):
    """Stock is deliberately absent: it only changes through stock adjustments or sales."""

    name: Name | None = None
    description: Description | None = None
    unit_price: Price | None = None
    reorder_level: ReorderLevel | None = None
    is_active: bool | None = None


class StockAdjustmentCreate(BaseModel):
    txn_type: Literal[InventoryTxnType.RESTOCK, InventoryTxnType.ADJUSTMENT]
    quantity_change: Annotated[int, Field(ge=-100_000, le=100_000)]
    note: Annotated[TrimmedStr, Field(min_length=3, max_length=255)]

    @model_validator(mode="after")
    def check_quantity(self):
        if self.quantity_change == 0:
            raise ValueError("Quantity change cannot be zero")
        if self.txn_type == InventoryTxnType.RESTOCK and self.quantity_change < 0:
            raise ValueError("A restock must add stock; use an adjustment to remove stock")
        return self


class InventoryTransactionOut(ORMModel):
    id: int
    product: ProductBrief
    txn_type: InventoryTxnType
    quantity_change: int
    balance_after: int
    order_id: int | None
    order_number: str | None
    note: str | None
    created_by: UserBrief | None
    created_at: UTCDateTime

