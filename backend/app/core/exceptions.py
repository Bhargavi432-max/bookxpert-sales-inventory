"""Domain errors and the handlers that turn every failure into one JSON shape:

    {"error": {"code": "...", "message": "...", "details": ...}}
"""
import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "BAD_REQUEST"

    def __init__(self, message: str, *, details: Any = None, code: str | None = None):
        super().__init__(message)
        self.message = message
        self.details = details
        if code:
            self.code = code


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"


class InsufficientStockError(ConflictError):
    code = "INSUFFICIENT_STOCK"


class BusinessRuleError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "BUSINESS_RULE_VIOLATION"


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "UNAUTHORIZED"


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "FORBIDDEN"


def _error_response(status_code: int, code: str, message: str, details: Any = None, headers=None) -> JSONResponse:
    body = {"error": {"code": code, "message": message, "details": details}}
    return JSONResponse(status_code=status_code, content=body, headers=headers)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError):
        headers = {"WWW-Authenticate": "Bearer"} if isinstance(exc, UnauthorizedError) else None
        return _error_response(exc.status_code, exc.code, exc.message, exc.details, headers)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError):
        details = [
            {
                # Drop the leading "body"/"query" segment so the field path matches the form field.
                "field": ".".join(str(part) for part in err["loc"][1:]) or str(err["loc"][0]),
                "message": err["msg"].removeprefix("Value error, "),
            }
            for err in exc.errors()
        ]
        return _error_response(422, "VALIDATION_ERROR", "Some fields are invalid", details)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException):
        return _error_response(exc.status_code, "HTTP_ERROR", str(exc.detail), headers=getattr(exc, "headers", None))

    @app.exception_handler(IntegrityError)
    async def handle_integrity_error(_: Request, exc: IntegrityError):
        logger.warning("Integrity error: %s", exc.orig)
        return _error_response(409, "CONFLICT", "The request conflicts with existing data")

    @app.exception_handler(OperationalError)
    async def handle_operational_error(_: Request, exc: OperationalError):
        logger.error("Database error: %s", exc.orig)
        return _error_response(503, "DATABASE_UNAVAILABLE", "The database is temporarily unavailable")

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_: Request, exc: Exception):
        logger.exception("Unhandled error", exc_info=exc)
        return _error_response(500, "INTERNAL_ERROR", "Something went wrong. Please try again.")
