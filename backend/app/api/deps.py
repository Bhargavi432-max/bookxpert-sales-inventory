from typing import Annotated

import jwt
from fastapi import BackgroundTasks, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.models import User, UserRole
from app.schemas.common import PageParams
from app.services import email_service
from app.services.email_service import OutgoingEmail

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Annotated[Session, Depends(get_db)]) -> User:
    try:
        user_id = int(decode_access_token(token)["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise UnauthorizedError("Your session is invalid or has expired. Please sign in again.") from None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Your account is no longer active")
    return user


def require_manager(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != UserRole.MANAGER:
        raise ForbiddenError("Only managers can perform this action")
    return user


DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
ManagerUser = Annotated[User, Depends(require_manager)]
Pagination = Annotated[PageParams, Depends()]


def queue_emails(background_tasks: BackgroundTasks, emails: list[OutgoingEmail]) -> None:
    """Send after the response; the transaction has already committed by now."""
    for email in emails:
        background_tasks.add_task(email_service.send_email, email)
