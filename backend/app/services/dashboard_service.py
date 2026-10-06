from datetime import datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.models import ApprovalStatus, OrderApproval, OrderItem, OrderStatus, Product, SalesOrder
from app.services import settings_service
from app.services.order_service import SUMMARY_OPTIONS

TREND_DAYS = 30


def _sales_kpis(db: Session, now: datetime) -> dict:
    completed = SalesOrder.status == OrderStatus.COMPLETED
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today_start = datetime.combine(now.date(), time.min)

    total_revenue, completed_orders, month_revenue = db.execute(
        select(
            func.coalesce(func.sum(SalesOrder.total_amount), 0),
            func.count(SalesOrder.id),
            func.coalesce(func.sum(case((SalesOrder.completed_at >= month_start, SalesOrder.total_amount), else_=0)), 0),
        ).where(completed)
    ).one()
    orders_today = db.scalar(select(func.count(SalesOrder.id)).where(SalesOrder.created_at >= today_start)) or 0
    average = (Decimal(total_revenue) / completed_orders) if completed_orders else Decimal("0")
    return {
        "total_revenue": total_revenue,
        "revenue_this_month": month_revenue,
        "completed_orders": completed_orders,
        "average_order_value": round(average, 2),
        "orders_today": orders_today,
    }


def _approval_kpis(db: Session) -> dict:
    counts = dict(db.execute(select(OrderApproval.status, func.count()).group_by(OrderApproval.status)).all())
    pending_value = db.scalar(
        select(func.coalesce(func.sum(SalesOrder.total_amount), 0)).where(
            SalesOrder.status == OrderStatus.PENDING_APPROVAL
        )
    )
    # Averaged in Python to stay database-agnostic (MySQL TIMESTAMPDIFF vs SQLite julianday).
    decided = db.execute(
        select(OrderApproval.requested_at, OrderApproval.decided_at).where(
            OrderApproval.status.in_([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED])
        )
    ).all()
    avg_hours = (
        round(sum((d - r).total_seconds() for r, d in decided) / len(decided) / 3600, 1) if decided else None
    )
    return {
        "pending": counts.get(ApprovalStatus.PENDING, 0),
        "approved": counts.get(ApprovalStatus.APPROVED, 0),
        "rejected": counts.get(ApprovalStatus.REJECTED, 0),
        "pending_value": pending_value,
        "avg_decision_hours": avg_hours,
    }


def _inventory_kpis(db: Session) -> dict:
    active, low, out, value = db.execute(
        select(
            func.count(Product.id),
            func.coalesce(func.sum(case((Product.stock_quantity <= Product.reorder_level, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Product.stock_quantity == 0, 1), else_=0)), 0),
            func.coalesce(func.sum(Product.stock_quantity * Product.unit_price), 0),
        ).where(Product.is_active.is_(True))
    ).one()
    return {"active_products": active, "low_stock": low, "out_of_stock": out, "stock_value": value}


def _sales_trend(db: Session, now: datetime) -> list[dict]:
    start = datetime.combine(now.date() - timedelta(days=TREND_DAYS - 1), time.min)
    day = func.date(SalesOrder.completed_at)
    rows = db.execute(
        select(day, func.sum(SalesOrder.total_amount), func.count(SalesOrder.id))
        .where(SalesOrder.status == OrderStatus.COMPLETED, SalesOrder.completed_at >= start)
        .group_by(day)
    ).all()
    by_day = {str(d): (revenue, count) for d, revenue, count in rows}
    trend = []
    for offset in range(TREND_DAYS):
        current = start.date() + timedelta(days=offset)
        revenue, count = by_day.get(str(current), (0, 0))
        trend.append({"date": current, "revenue": revenue, "orders": count})
    return trend


def _top_products(db: Session, limit: int = 5) -> list[dict]:
    revenue = func.sum(OrderItem.line_total)
    rows = db.execute(
        select(Product.id, Product.sku, Product.name, func.sum(OrderItem.quantity), revenue)
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(SalesOrder, SalesOrder.id == OrderItem.order_id)
        .where(SalesOrder.status == OrderStatus.COMPLETED)
        .group_by(Product.id, Product.sku, Product.name)
        .order_by(revenue.desc())
        .limit(limit)
    ).all()
    return [
        {"product_id": pid, "sku": sku, "name": name, "quantity_sold": int(qty), "revenue": rev}
        for pid, sku, name, qty, rev in rows
    ]


def get_summary(db: Session) -> dict:
    now = utcnow()
    status_counts = dict(db.execute(select(SalesOrder.status, func.count()).group_by(SalesOrder.status)).all())
    low_stock = db.scalars(
        select(Product)
        .where(Product.is_active.is_(True), Product.stock_quantity <= Product.reorder_level)
        .order_by(Product.stock_quantity, Product.name)
        .limit(8)
    ).all()
    recent = db.scalars(select(SalesOrder).order_by(SalesOrder.id.desc()).options(*SUMMARY_OPTIONS).limit(6)).all()
    return {
        "sales": _sales_kpis(db, now),
        "approvals": _approval_kpis(db),
        "inventory": _inventory_kpis(db),
        "orders_by_status": {s.value: status_counts.get(s, 0) for s in OrderStatus},
        "sales_trend": _sales_trend(db, now),
        "top_products": _top_products(db),
        "low_stock_products": low_stock,
        "recent_orders": recent,
        "approval_threshold": settings_service.get_approval_threshold(db),
    }
