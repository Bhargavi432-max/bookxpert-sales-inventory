from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.dashboard import DashboardSummary
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(db: DbSession, _: CurrentUser):
    return dashboard_service.get_summary(db)
