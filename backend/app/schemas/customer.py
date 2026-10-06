from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import ORMModel, TrimmedStr, UTCDateTime

Name = Annotated[TrimmedStr, Field(min_length=2, max_length=150)]
Phone = Annotated[TrimmedStr, Field(pattern=r"^\+?[0-9][0-9\s-]{6,18}$")]
Address = Annotated[TrimmedStr, Field(max_length=500)]
Gstin = Annotated[TrimmedStr, Field(pattern=r"^[0-9]{2}[A-Z0-9]{13}$")]


def _blank_to_none(value):
    return None if isinstance(value, str) and not value.strip() else value


def _upper(value):
    return value.strip().upper() if isinstance(value, str) else value


class CustomerBrief(ORMModel):
    id: int
    name: str
    email: str


class CustomerOut(CustomerBrief):
    phone: str
    address: str | None
    gstin: str | None
    is_active: bool
    created_at: UTCDateTime
    updated_at: UTCDateTime


class CustomerCreate(BaseModel):
    name: Name
    email: EmailStr
    phone: Phone
    address: Address | None = None
    gstin: Gstin | None = None

    _blank = field_validator("address", "gstin", mode="before")(_blank_to_none)
    _gstin_upper = field_validator("gstin", mode="before")(_upper)


class CustomerUpdate(BaseModel):
    name: Name | None = None
    email: EmailStr | None = None
    phone: Phone | None = None
    address: Address | None = None
    gstin: Gstin | None = None
    is_active: bool | None = None

    _blank = field_validator("address", "gstin", mode="before")(_blank_to_none)
    _gstin_upper = field_validator("gstin", mode="before")(_upper)
