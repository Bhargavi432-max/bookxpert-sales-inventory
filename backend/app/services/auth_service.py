from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, UnauthorizedError
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas.common import PageParams
from app.schemas.user import UserCreate, UserUpdate
from app.services.pagination import paginate


def _normalise_email(email: str) -> str:
    return email.strip().lower()


def authenticate(db: Session, email: str, password: str) -> dict:
    user = db.scalar(select(User).where(User.email == _normalise_email(email)))
    # Same message for unknown email and wrong password, so accounts can't be enumerated.
    if user is None or not verify_password(password, user.password_hash):
        raise UnauthorizedError("Invalid email or password")
    if not user.is_active:
        raise ForbiddenError("This account has been deactivated")
    return {
        "access_token": create_access_token(user.id, user.role.value),
        "expires_in": settings.jwt_expire_minutes * 60,
        "user": user,
    }


def list_users(db: Session, params: PageParams, search: str | None = None) -> dict:
    stmt = select(User).order_by(User.name)
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(User.name.ilike(term) | User.email.ilike(term))
    return paginate(db, stmt, params)


def create_user(db: Session, data: UserCreate) -> User:
    email = _normalise_email(data.email)
    if db.scalar(select(func.count()).where(User.email == email)):
        raise ConflictError("A user with this email already exists", details=[{"field": "email", "message": "Already in use"}])
    user = User(name=data.name, email=email, password_hash=hash_password(data.password), role=data.role)
    db.add(user)
    db.commit()
    return user


def update_user(db: Session, user_id: int, data: UserUpdate, acting_user: User) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found")
    changes = data.model_dump(exclude_unset=True)
    role_changed = "role" in changes and changes["role"] != user.role
    if user.id == acting_user.id and (changes.get("is_active") is False or role_changed):
        raise ForbiddenError("You cannot deactivate yourself or change your own role")
    if "password" in changes:
        user.password_hash = hash_password(changes.pop("password"))
    for field, value in changes.items():
        setattr(user, field, value)
    db.commit()
    return user
