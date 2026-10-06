from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models import Customer
from app.schemas.common import PageParams
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.services.pagination import paginate


def _ensure_email_free(db: Session, email: str, exclude_id: int | None = None) -> None:
    stmt = select(func.count()).where(Customer.email == email)
    if exclude_id is not None:
        stmt = stmt.where(Customer.id != exclude_id)
    if db.scalar(stmt):
        raise ConflictError(
            "A customer with this email already exists", details=[{"field": "email", "message": "Already in use"}]
        )


def list_customers(db: Session, params: PageParams, search: str | None, include_inactive: bool) -> dict:
    stmt = select(Customer).order_by(Customer.name)
    if not include_inactive:
        stmt = stmt.where(Customer.is_active.is_(True))
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(Customer.name.ilike(term) | Customer.email.ilike(term) | Customer.phone.ilike(term))
    return paginate(db, stmt, params)


def get_customer(db: Session, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise NotFoundError("Customer not found")
    return customer


def create_customer(db: Session, data: CustomerCreate) -> Customer:
    email = data.email.lower()
    _ensure_email_free(db, email)
    customer = Customer(**data.model_dump(exclude={"email"}), email=email)
    db.add(customer)
    db.commit()
    return customer


def update_customer(db: Session, customer_id: int, data: CustomerUpdate) -> Customer:
    customer = get_customer(db, customer_id)
    changes = data.model_dump(exclude_unset=True)
    if "email" in changes:
        changes["email"] = changes["email"].lower()
        _ensure_email_free(db, changes["email"], exclude_id=customer.id)
    for field, value in changes.items():
        setattr(customer, field, value)
    db.commit()
    return customer


def deactivate_customer(db: Session, customer_id: int) -> None:
    # Soft delete: customers are referenced by historical orders.
    customer = get_customer(db, customer_id)
    customer.is_active = False
    db.commit()
