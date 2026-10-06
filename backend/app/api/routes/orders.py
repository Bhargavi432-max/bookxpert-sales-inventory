from datetime import date

from fastapi import APIRouter, BackgroundTasks

from app.api.deps import CurrentUser, DbSession, ManagerUser, Pagination, queue_emails
from app.models import OrderStatus
from app.schemas.common import Page
from app.schemas.order import ApproveRequest, CancelRequest, OrderCreate, OrderOut, OrderSummaryOut, RejectRequest
from app.services import order_service

router = APIRouter(prefix="/orders", tags=["Sales orders"])


@router.get("", response_model=Page[OrderSummaryOut])
def list_orders(
    db: DbSession,
    user: CurrentUser,
    params: Pagination,
    status: OrderStatus | None = None,
    customer_id: int | None = None,
    mine: bool = False,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    return order_service.list_orders(
        db,
        params,
        status=status,
        customer_id=customer_id,
        created_by_id=user.id if mine else None,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )


@router.post(
    "",
    response_model=OrderOut,
    status_code=201,
    summary="Create a sales order",
    description="Validates the customer, products and stock. Orders above the approval threshold are "
    "held as PENDING_APPROVAL and managers are emailed; others complete immediately and deduct stock.",
)
def create_order(payload: OrderCreate, db: DbSession, user: CurrentUser, background_tasks: BackgroundTasks):
    order, emails = order_service.create_order(db, payload, user)
    queue_emails(background_tasks, emails)
    return order_service.get_order(db, order.id)


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: DbSession, _: CurrentUser):
    return order_service.get_order(db, order_id)


@router.post("/{order_id}/approve", response_model=OrderOut)
def approve_order(
    order_id: int, payload: ApproveRequest, db: DbSession, manager: ManagerUser, background_tasks: BackgroundTasks
):
    order, emails = order_service.approve_order(db, order_id, manager, payload.comment)
    queue_emails(background_tasks, emails)
    return order_service.get_order(db, order.id)


@router.post("/{order_id}/reject", response_model=OrderOut)
def reject_order(
    order_id: int, payload: RejectRequest, db: DbSession, manager: ManagerUser, background_tasks: BackgroundTasks
):
    order, emails = order_service.reject_order(db, order_id, manager, payload.comment)
    queue_emails(background_tasks, emails)
    return order_service.get_order(db, order.id)


@router.post("/{order_id}/cancel", response_model=OrderOut)
def cancel_order(order_id: int, payload: CancelRequest, db: DbSession, user: CurrentUser):
    order = order_service.cancel_order(db, order_id, user, payload.comment)
    return order_service.get_order(db, order.id)
