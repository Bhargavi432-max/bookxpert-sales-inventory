from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field

from app.schemas.common import Money


class AppSettingsOut(BaseModel):
    approval_threshold: Money


class ApprovalThresholdUpdate(BaseModel):
    approval_threshold: Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
