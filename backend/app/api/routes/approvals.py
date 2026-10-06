from fastapi import APIRouter

from app.api.deps import DbSession, ManagerUser, Pagination
from app.models import ApprovalStatus
from app.schemas.common import Page
from app.schemas.order import ApprovalQueueItem
from app.services import order_service

router = APIRouter(prefix="/approvals", tags=["Approvals"])


@router.get("", response_model=Page[ApprovalQueueItem])
def list_approvals(db: DbSession, _: ManagerUser, params: Pagination, status: ApprovalStatus | None = None):
    return order_service.list_approvals(db, params, status)
