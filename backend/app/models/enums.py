from enum import StrEnum

from sqlalchemy import Enum as SAEnum


class UserRole(StrEnum):
    SALES = "SALES"
    MANAGER = "MANAGER"


class OrderStatus(StrEnum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ApprovalStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class InventoryTxnType(StrEnum):
    INITIAL = "INITIAL"
    SALE = "SALE"
    RESTOCK = "RESTOCK"
    ADJUSTMENT = "ADJUSTMENT"


def enum_column(enum_cls: type[StrEnum]) -> SAEnum:
    """Stored as VARCHAR so new enum values never need an ALTER on a native MySQL ENUM."""
    return SAEnum(enum_cls, native_enum=False, length=20, validate_strings=True)
