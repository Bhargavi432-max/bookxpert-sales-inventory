from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated, Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel, ConfigDict, PlainSerializer, StringConstraints

T = TypeVar("T")


def _as_utc_iso(value: datetime) -> str:
    return value.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


# Money is stored as DECIMAL(12,2); JSON gets a number so the UI can format it.
Money = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]
# Timestamps are stored as naive UTC; emit an explicit Z so browsers convert to local time.
UTCDateTime = Annotated[datetime, PlainSerializer(_as_utc_iso, return_type=str, when_used="json")]
TrimmedStr = Annotated[str, StringConstraints(strip_whitespace=True)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class PageParams:
    def __init__(
        self,
        page: Annotated[int, Query(ge=1)] = 1,
        page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    ):
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class Message(BaseModel):
    message: str
