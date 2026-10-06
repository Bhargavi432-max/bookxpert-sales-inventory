from fastapi import APIRouter, status

from app.api.deps import DbSession, ManagerUser, Pagination
from app.schemas.common import Page
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services import auth_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=Page[UserOut])
def list_users(db: DbSession, _: ManagerUser, params: Pagination, search: str | None = None):
    return auth_service.list_users(db, params, search)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: DbSession, _: ManagerUser):
    return auth_service.create_user(db, payload)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: DbSession, manager: ManagerUser):
    return auth_service.update_user(db, user_id, payload, manager)
