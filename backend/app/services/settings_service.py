from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import AppSetting, User

APPROVAL_THRESHOLD_KEY = "approval_threshold"


def get_approval_threshold(db: Session) -> Decimal:
    row = db.get(AppSetting, APPROVAL_THRESHOLD_KEY)
    return Decimal(row.value) if row else settings.default_approval_threshold


def set_approval_threshold(db: Session, value: Decimal, user: User) -> Decimal:
    row = db.get(AppSetting, APPROVAL_THRESHOLD_KEY)
    if row is None:
        row = AppSetting(key=APPROVAL_THRESHOLD_KEY, value=str(value))
        db.add(row)
    row.value = str(value)
    row.updated_by_id = user.id
    db.commit()
    return value
