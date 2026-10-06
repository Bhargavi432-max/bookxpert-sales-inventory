from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession, ManagerUser, Pagination
from app.schemas.common import Page
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerUpdate
from app.services import customer_service

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=Page[CustomerOut])
def list_customers(
    db: DbSession, _: CurrentUser, params: Pagination, search: str | None = None, include_inactive: bool = False
):
    return customer_service.list_customers(db, params, search, include_inactive)


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, db: DbSession, _: CurrentUser):
    return customer_service.create_customer(db, payload)


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: DbSession, _: CurrentUser):
    return customer_service.get_customer(db, customer_id)


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, payload: CustomerUpdate, db: DbSession, _: CurrentUser):
    return customer_service.update_customer(db, customer_id, payload)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Deactivate a customer")
def deactivate_customer(customer_id: int, db: DbSession, _: ManagerUser):
    customer_service.deactivate_customer(db, customer_id)
