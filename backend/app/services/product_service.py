from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models import InventoryTransaction, InventoryTxnType, Product, User
from app.schemas.common import PageParams
from app.schemas.product import ProductCreate, ProductUpdate, StockAdjustmentCreate
from app.services.pagination import paginate

TXN_OPTIONS = (
    selectinload(InventoryTransaction.product),
    selectinload(InventoryTransaction.order),
    selectinload(InventoryTransaction.created_by),
)


def list_products(
    db: Session, params: PageParams, search: str | None, include_inactive: bool, low_stock_only: bool
) -> dict:
    stmt = select(Product).order_by(Product.name)
    if not include_inactive:
        stmt = stmt.where(Product.is_active.is_(True))
    if low_stock_only:
        stmt = stmt.where(Product.stock_quantity <= Product.reorder_level)
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(Product.name.ilike(term) | Product.sku.ilike(term))
    return paginate(db, stmt, params)


def get_product(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise NotFoundError("Product not found")
    return product


def create_product(db: Session, data: ProductCreate, user: User) -> Product:
    if db.scalar(select(func.count()).where(Product.sku == data.sku)):
        raise ConflictError("A product with this SKU already exists", details=[{"field": "sku", "message": "Already in use"}])
    product = Product(**data.model_dump(exclude={"initial_stock"}), stock_quantity=data.initial_stock)
    db.add(product)
    if data.initial_stock:
        db.add(
            InventoryTransaction(
                product=product,
                txn_type=InventoryTxnType.INITIAL,
                quantity_change=data.initial_stock,
                balance_after=data.initial_stock,
                note="Opening stock",
                created_by=user,
            )
        )
    db.commit()
    return product


def update_product(db: Session, product_id: int, data: ProductUpdate) -> Product:
    product = get_product(db, product_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    return product


def deactivate_product(db: Session, product_id: int) -> None:
    product = get_product(db, product_id)
    product.is_active = False
    db.commit()


def adjust_stock(db: Session, product_id: int, data: StockAdjustmentCreate, user: User) -> Product:
    # Row lock so a concurrent sale or adjustment can't read a stale balance.
    product = db.scalar(select(Product).where(Product.id == product_id).with_for_update())
    if product is None:
        raise NotFoundError("Product not found")
    new_balance = product.stock_quantity + data.quantity_change
    if new_balance < 0:
        raise BusinessRuleError(
            f"Adjustment would make stock negative (current stock: {product.stock_quantity})",
            details=[{"field": "quantity_change", "message": f"Cannot remove more than {product.stock_quantity}"}],
        )
    product.stock_quantity = new_balance
    db.add(
        InventoryTransaction(
            product=product,
            txn_type=data.txn_type,
            quantity_change=data.quantity_change,
            balance_after=new_balance,
            note=data.note,
            created_by=user,
        )
    )
    db.commit()
    return product


def list_transactions(
    db: Session, params: PageParams, product_id: int | None, txn_type: InventoryTxnType | None
) -> dict:
    stmt = select(InventoryTransaction).order_by(InventoryTransaction.id.desc())
    if product_id:
        stmt = stmt.where(InventoryTransaction.product_id == product_id)
    if txn_type:
        stmt = stmt.where(InventoryTransaction.txn_type == txn_type)
    return paginate(db, stmt, params, options=TXN_OPTIONS)
