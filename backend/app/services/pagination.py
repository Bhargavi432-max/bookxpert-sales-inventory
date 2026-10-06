from collections.abc import Sequence
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.schemas.common import PageParams


def paginate(db: Session, stmt: Select, params: PageParams, *, options: Sequence[Any] = ()) -> dict:
    """Run a count and a page query from the same filtered statement."""
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    items = db.scalars(stmt.options(*options).limit(params.page_size).offset(params.offset)).all()
    return {"items": items, "total": total, "page": params.page, "page_size": params.page_size}
