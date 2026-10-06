from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession, ManagerUser, Pagination
from app.schemas.common import Page
from app.schemas.product import (
    InventoryTransactionOut,
    ProductCreate,
    ProductOut,
    ProductUpdate,
    StockAdjustmentCreate,
)
from app.services import product_service

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=Page[ProductOut])
def list_products(
    db: DbSession,
    _: CurrentUser,
    params: Pagination,
    search: str | None = None,
    include_inactive: bool = False,
    low_stock: bool = False,
):
    return product_service.list_products(db, params, search, include_inactive, low_stock)


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: DbSession, manager: ManagerUser):
    return product_service.create_product(db, payload, manager)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: DbSession, _: CurrentUser):
    return product_service.get_product(db, product_id)


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductUpdate, db: DbSession, _: ManagerUser):
    return product_service.update_product(db, product_id, payload)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Deactivate a product")
def deactivate_product(product_id: int, db: DbSession, _: ManagerUser):
    product_service.deactivate_product(db, product_id)


@router.post("/{product_id}/stock-adjustments", response_model=ProductOut)
def adjust_stock(product_id: int, payload: StockAdjustmentCreate, db: DbSession, manager: ManagerUser):
    return product_service.adjust_stock(db, product_id, payload, manager)


@router.get("/{product_id}/inventory-transactions", response_model=Page[InventoryTransactionOut])
def product_transactions(product_id: int, db: DbSession, _: CurrentUser, params: Pagination):
    product_service.get_product(db, product_id)
    return product_service.list_transactions(db, params, product_id, None)
