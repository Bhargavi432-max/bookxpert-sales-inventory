"""Sales order lifecycle and the approval workflow.

    create ──► total <= threshold ──► COMPLETED   (stock deducted immediately)
           └─► total >  threshold ──► PENDING_APPROVAL ──► approve ──► COMPLETED
                                                       ├─► reject  ──► REJECTED
                                                       └─► cancel  ──► CANCELLED

Every state change runs in one database transaction. Rows that are read and then
changed (the order, its products) are locked with SELECT ... FOR UPDATE, always in
ascending product-id order so two concurrent transactions can't deadlock.
"""
import logging
from collections import defaultdict
from collections.abc import Iterable
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import utcnow
from app.core.exceptions import BusinessRuleError, ConflictError, ForbiddenError, InsufficientStockError, NotFoundError
from app.models import (
    ApprovalStatus,
    Customer,
    InventoryTransaction,
    InventoryTxnType,
    OrderApproval,
    OrderItem,
    OrderStatus,
    Product,
    SalesOrder,
    User,
    UserRole,
)
from app.schemas.common import PageParams
from app.schemas.order import OrderCreate
from app.services import settings_service
from app.services.email_service import OutgoingEmail, build_approval_request_email, build_decision_email
from app.services.pagination import paginate

logger = logging.getLogger(__name__)

CENT = Decimal("0.01")

SUMMARY_OPTIONS = (selectinload(SalesOrder.customer), selectinload(SalesOrder.created_by))
DETAIL_OPTIONS = (
    *SUMMARY_OPTIONS,
    selectinload(SalesOrder.items).selectinload(OrderItem.product),
    selectinload(SalesOrder.approval).selectinload(OrderApproval.requested_by),
    selectinload(SalesOrder.approval).selectinload(OrderApproval.decided_by),
)


# ---------- queries ----------

def list_orders(
    db: Session,
    params: PageParams,
    *,
    status: OrderStatus | None = None,
    customer_id: int | None = None,
    created_by_id: int | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    stmt = select(SalesOrder).order_by(SalesOrder.id.desc())
    if status:
        stmt = stmt.where(SalesOrder.status == status)
    if customer_id:
        stmt = stmt.where(SalesOrder.customer_id == customer_id)
    if created_by_id:
        stmt = stmt.where(SalesOrder.created_by_id == created_by_id)
    if date_from:
        stmt = stmt.where(SalesOrder.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(SalesOrder.created_at <= datetime.combine(date_to, time.max))
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.join(SalesOrder.customer).where(SalesOrder.order_number.ilike(term) | Customer.name.ilike(term))
    return paginate(db, stmt, params, options=SUMMARY_OPTIONS)


def get_order(db: Session, order_id: int) -> SalesOrder:
    order = db.scalar(select(SalesOrder).where(SalesOrder.id == order_id).options(*DETAIL_OPTIONS))
    if order is None:
        raise NotFoundError("Order not found")
    return order


def list_approvals(db: Session, params: PageParams, status: ApprovalStatus | None) -> dict:
    stmt = select(OrderApproval).order_by(OrderApproval.requested_at.desc(), OrderApproval.id.desc())
    if status:
        stmt = stmt.where(OrderApproval.status == status)
    options = (
        selectinload(OrderApproval.order).selectinload(SalesOrder.customer),
        selectinload(OrderApproval.order).selectinload(SalesOrder.created_by),
        selectinload(OrderApproval.requested_by),
        selectinload(OrderApproval.decided_by),
    )
    return paginate(db, stmt, params, options=options)


# ---------- internal helpers ----------

def _lock_order(db: Session, order_id: int) -> SalesOrder:
    stmt = (
        select(SalesOrder)
        .where(SalesOrder.id == order_id)
        .options(*DETAIL_OPTIONS)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    order = db.scalar(stmt)
    if order is None:
        raise NotFoundError("Order not found")
    return order


def _lock_products(db: Session, product_ids: Iterable[int]) -> dict[int, Product]:
    stmt = (
        select(Product)
        .where(Product.id.in_(sorted(set(product_ids))))
        .order_by(Product.id)
        .with_for_update()
        # Products may already be in the session from an earlier, unlocked read; refresh them.
        .execution_options(populate_existing=True)
    )
    return {product.id: product for product in db.scalars(stmt)}


def _check_stock(products: dict[int, Product], quantities: dict[int, int]) -> None:
    shortages = [
        {
            "product_id": pid,
            "sku": products[pid].sku,
            "name": products[pid].name,
            "requested": qty,
            "available": products[pid].stock_quantity,
        }
        for pid, qty in quantities.items()
        if products[pid].stock_quantity < qty
    ]
    if shortages:
        names = ", ".join(f"{s['name']} (requested {s['requested']}, available {s['available']})" for s in shortages)
        raise InsufficientStockError(f"Insufficient stock: {names}", details=shortages)


def _ensure_sellable(products: dict[int, Product], requested_ids: Iterable[int]) -> None:
    missing = sorted(set(requested_ids) - products.keys())
    if missing:
        raise NotFoundError("One or more products were not found", details={"product_ids": missing})
    inactive = [p.name for p in products.values() if not p.is_active]
    if inactive:
        raise BusinessRuleError(f"These products are no longer active: {', '.join(inactive)}")


def _fulfil(db: Session, order: SalesOrder, products: dict[int, Product], actor: User) -> None:
    """Deduct stock for every line, write the stock ledger, and complete the order."""
    for item in order.items:
        product = products[item.product_id]
        product.stock_quantity -= item.quantity
        db.add(
            InventoryTransaction(
                product=product,
                txn_type=InventoryTxnType.SALE,
                quantity_change=-item.quantity,
                balance_after=product.stock_quantity,
                order=order,
                note=f"Sale {order.order_number}",
                created_by=actor,
            )
        )
    order.status = OrderStatus.COMPLETED
    order.completed_at = utcnow()


def _ensure_pending(order: SalesOrder) -> None:
    if order.status != OrderStatus.PENDING_APPROVAL:
        raise ConflictError(
            f"Order {order.order_number} is {order.status.value.replace('_', ' ').lower()} and can no longer be changed",
            code="INVALID_ORDER_STATE",
        )


def _record_decision(order: SalesOrder, status: ApprovalStatus, user: User, comment: str | None) -> None:
    approval = order.approval
    approval.status = status
    approval.decided_by = user
    approval.decided_at = utcnow()
    approval.decision_comment = comment


# ---------- commands ----------

def create_order(db: Session, data: OrderCreate, user: User) -> tuple[SalesOrder, list[OutgoingEmail]]:
    customer = db.get(Customer, data.customer_id)
    if customer is None:
        raise NotFoundError("Customer not found")
    if not customer.is_active:
        raise BusinessRuleError("This customer is inactive and cannot place orders")

    # The same product on two lines is merged into one line.
    quantities: dict[int, int] = defaultdict(int)
    for line in data.items:
        quantities[line.product_id] += line.quantity

    products = _lock_products(db, quantities)
    _ensure_sellable(products, quantities)
    _check_stock(products, quantities)

    order = SalesOrder(customer=customer, created_by=user, notes=data.notes, status=OrderStatus.PENDING_APPROVAL)
    total = Decimal("0")
    for product_id, quantity in quantities.items():
        product = products[product_id]
        line_total = (product.unit_price * quantity).quantize(CENT)
        order.items.append(
            OrderItem(product=product, quantity=quantity, unit_price=product.unit_price, line_total=line_total)
        )
        total += line_total
    order.total_amount = total

    threshold = settings_service.get_approval_threshold(db)
    order.requires_approval = total > threshold

    db.add(order)
    db.flush()  # assigns order.id
    order.order_number = f"SO-{utcnow():%Y}-{order.id:06d}"

    emails: list[OutgoingEmail] = []
    if order.requires_approval:
        order.approval = OrderApproval(status=ApprovalStatus.PENDING, threshold_amount=threshold, requested_by=user)
        managers = db.scalars(
            select(User).where(User.role == UserRole.MANAGER, User.is_active.is_(True), User.id != user.id)
        ).all()
        if managers:
            emails.append(build_approval_request_email(order, list(managers)))
        else:
            logger.warning("Order %s needs approval but no other active manager exists", order.order_number)
    else:
        _fulfil(db, order, products, user)

    db.commit()
    logger.info("Order %s created by user %s with status %s", order.order_number, user.id, order.status)
    return order, emails


def approve_order(db: Session, order_id: int, manager: User, comment: str | None) -> tuple[SalesOrder, list[OutgoingEmail]]:
    order = _lock_order(db, order_id)
    _ensure_pending(order)
    if order.created_by_id == manager.id:
        raise ForbiddenError("You cannot approve an order you created; another manager must review it")

    quantities = {item.product_id: item.quantity for item in order.items}
    products = _lock_products(db, quantities)
    _ensure_sellable(products, quantities)
    # Stock may have been sold to other orders since this one was raised.
    _check_stock(products, quantities)

    _fulfil(db, order, products, manager)
    _record_decision(order, ApprovalStatus.APPROVED, manager, comment)
    email = build_decision_email(order, approved=True, manager=manager, comment=comment)
    db.commit()
    logger.info("Order %s approved by user %s", order.order_number, manager.id)
    return order, [email]


def reject_order(db: Session, order_id: int, manager: User, comment: str) -> tuple[SalesOrder, list[OutgoingEmail]]:
    order = _lock_order(db, order_id)
    _ensure_pending(order)
    if order.created_by_id == manager.id:
        raise ForbiddenError("You cannot review an order you created; cancel it instead")

    order.status = OrderStatus.REJECTED
    _record_decision(order, ApprovalStatus.REJECTED, manager, comment)
    email = build_decision_email(order, approved=False, manager=manager, comment=comment)
    db.commit()
    logger.info("Order %s rejected by user %s", order.order_number, manager.id)
    return order, [email]


def cancel_order(db: Session, order_id: int, user: User, comment: str | None) -> SalesOrder:
    order = _lock_order(db, order_id)
    if order.created_by_id != user.id and user.role != UserRole.MANAGER:
        raise ForbiddenError("Only the order's creator or a manager can cancel it")
    _ensure_pending(order)

    order.status = OrderStatus.CANCELLED
    _record_decision(order, ApprovalStatus.CANCELLED, user, comment)
    db.commit()
    return order
