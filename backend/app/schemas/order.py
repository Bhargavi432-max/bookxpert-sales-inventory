from typing import Annotated

from pydantic import BaseModel, Field

from app.models.enums import ApprovalStatus, OrderStatus
from app.schemas.common import Money, ORMModel, TrimmedStr, UTCDateTime
from app.schemas.customer import CustomerBrief
from app.schemas.product import ProductBrief
from app.schemas.user import UserBrief


class OrderItemIn(BaseModel):
    product_id: Annotated[int, Field(gt=0)]
    quantity: Annotated[int, Field(gt=0, le=10_000)]


class OrderCreate(BaseModel):
    customer_id: Annotated[int, Field(gt=0)]
    items: Annotated[list[OrderItemIn], Field(min_length=1, max_length=50)]
    notes: Annotated[TrimmedStr, Field(max_length=500)] | None = None


class ApproveRequest(BaseModel):
    comment: Annotated[TrimmedStr, Field(max_length=500)] | None = None


class RejectRequest(BaseModel):
    comment: Annotated[TrimmedStr, Field(min_length=3, max_length=500)]


class CancelRequest(BaseModel):
    comment: Annotated[TrimmedStr, Field(max_length=500)] | None = None


class OrderItemOut(ORMModel):
    id: int
    product: ProductBrief
    quantity: int
    unit_price: Money
    line_total: Money


class ApprovalOut(ORMModel):
    id: int
    status: ApprovalStatus
    threshold_amount: Money
    requested_by: UserBrief
    requested_at: UTCDateTime
    decided_by: UserBrief | None
    decided_at: UTCDateTime | None
    decision_comment: str | None


class OrderSummaryOut(ORMModel):
    id: int
    order_number: str
    customer: CustomerBrief
    created_by: UserBrief
    status: OrderStatus
    total_amount: Money
    requires_approval: bool
    created_at: UTCDateTime
    completed_at: UTCDateTime | None


class OrderOut(OrderSummaryOut):
    notes: str | None
    items: list[OrderItemOut]
    approval: ApprovalOut | None


class ApprovalQueueItem(ApprovalOut):
    order: OrderSummaryOut
