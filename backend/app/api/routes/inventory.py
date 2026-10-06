from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession, Pagination
from app.models import InventoryTxnType
from app.schemas.common import Page
from app.schemas.product import InventoryTransactionOut
from app.services import product_service

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/transactions", response_model=Page[InventoryTransactionOut])
def list_transactions(
    db: DbSession,
    _: CurrentUser,
    params: Pagination,
    product_id: int | None = None,
    txn_type: InventoryTxnType | None = None,
):
    return product_service.list_transactions(db, params, product_id, txn_type)
