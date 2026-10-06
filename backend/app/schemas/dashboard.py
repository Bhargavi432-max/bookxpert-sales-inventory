from datetime import date

from pydantic import BaseModel

from app.schemas.common import Money
from app.schemas.order import OrderSummaryOut
from app.schemas.product import ProductOut


class SalesKpis(BaseModel):
    total_revenue: Money
    revenue_this_month: Money
    completed_orders: int
    average_order_value: Money
    orders_today: int


class ApprovalKpis(BaseModel):
    pending: int
    approved: int
    rejected: int
    pending_value: Money
    avg_decision_hours: float | None


class InventoryKpis(BaseModel):
    active_products: int
    low_stock: int
    out_of_stock: int
    stock_value: Money


class TrendPoint(BaseModel):
    date: date
    revenue: Money
    orders: int


class TopProduct(BaseModel):
    product_id: int
    sku: str
    name: str
    quantity_sold: int
    revenue: Money


class DashboardSummary(BaseModel):
    sales: SalesKpis
    approvals: ApprovalKpis
    inventory: InventoryKpis
    orders_by_status: dict[str, int]
    sales_trend: list[TrendPoint]
    top_products: list[TopProduct]
    low_stock_products: list[ProductOut]
    recent_orders: list[OrderSummaryOut]
    approval_threshold: Money
