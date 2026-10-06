import re
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.enums import UserRole
from app.schemas.common import ORMModel, TrimmedStr, UTCDateTime

Name = Annotated[TrimmedStr, Field(min_length=2, max_length=100)]
Password = Annotated[str, Field(min_length=8, max_length=72)]


def _check_password_strength(value: str) -> str:
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("Password must contain at least one letter and one number")
    return value


class UserBrief(ORMModel):
    id: int
    name: str
    email: str


class UserOut(UserBrief):
    role: UserRole
    is_active: bool
    created_at: UTCDateTime


class UserCreate(BaseModel):
    name: Name
    email: EmailStr
    password: Password
    role: UserRole = UserRole.SALES

    _strong_password = field_validator("password")(_check_password_strength)


class UserUpdate(BaseModel):
    name: Name | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    password: Password | None = None

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str | None) -> str | None:
        return _check_password_strength(value) if value is not None else value


class LoginRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=1, max_length=72)]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
