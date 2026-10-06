from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession, ManagerUser
from app.schemas.setting import AppSettingsOut, ApprovalThresholdUpdate
from app.services import settings_service

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=AppSettingsOut)
def get_settings(db: DbSession, _: CurrentUser):
    return {"approval_threshold": settings_service.get_approval_threshold(db)}


@router.put("/approval-threshold", response_model=AppSettingsOut)
def update_threshold(payload: ApprovalThresholdUpdate, db: DbSession, manager: ManagerUser):
    return {"approval_threshold": settings_service.set_approval_threshold(db, payload.approval_threshold, manager)}
