from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import CurrentUser, DbSession
from app.schemas.user import LoginRequest, TokenResponse, UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession):
    return auth_service.authenticate(db, payload.email, payload.password)


@router.post("/token", response_model=TokenResponse, include_in_schema=True, summary="OAuth2 login (Swagger 'Authorize')")
def token(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession):
    return auth_service.authenticate(db, form.username, form.password)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user
