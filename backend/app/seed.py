"""Demo data so the app is explorable right after `docker compose up`.

Orders are created through order_service so they follow the real business rules,
then their timestamps are spread over the last few weeks for a meaningful dashboard.
Runs only when the users table is empty.
"""
import logging
import random
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import SessionLocal, utcnow
from app.core.exceptions import AppError
from app.core.security import hash_password
from app.models import Customer, InventoryTransaction, InventoryTxnType, Product, User, UserRole
from app.schemas.order import OrderCreate, OrderItemIn
from app.services import order_service

logger = logging.getLogger("seed")

USERS = [
    ("Priya Sharma", "manager@bookxpert.com", "Manager@123", UserRole.MANAGER),
    ("Rahul Verma", "finance.manager@bookxpert.com", "Manager@123", UserRole.MANAGER),
    ("Anil Kumar", "sales@bookxpert.com", "Sales@123", UserRole.SALES),
    ("Sneha Reddy", "sales2@bookxpert.com", "Sales@123", UserRole.SALES),
]

CUSTOMERS = [
    ("Sri Lakshmi Traders", "accounts@srilakshmitraders.in", "+91 98490 11223", "Ameerpet, Hyderabad", "36AABCS1429B1Z5"),
    ("Vizag Office Mart", "purchase@vizagofficemart.in", "+91 99890 44556", "Dwaraka Nagar, Visakhapatnam", "37AACCV2231K1Z2"),
    ("Chennai Tech Solutions", "procurement@chennaitech.in", "+91 94440 77889", "T. Nagar, Chennai", "33AADCC5512L1Z9"),
    ("Bengaluru Startups Hub", "ops@blrstartupshub.in", "+91 98450 22334", "Koramangala, Bengaluru", None),
    ("Pune Retail Co.", "orders@puneretail.in", "+91 98220 55667", "Shivajinagar, Pune", "27AAFCP7788M1Z4"),
    ("Delhi Enterprises", "buying@delhient.in", "+91 98110 88990", "Connaught Place, New Delhi", None),
]

PRODUCTS = [
    ("LAP-DEL-5440", "Dell Latitude 5440 Laptop", "Intel i5, 16 GB RAM, 512 GB SSD", "68500.00", 25, 5),
    ("LAP-HP-450G10", "HP ProBook 450 G10", "Intel i7, 16 GB RAM, 1 TB SSD", "82000.00", 12, 4),
    ("MON-LG-24", "LG 24\" Full HD Monitor", "IPS panel, HDMI + DP", "11200.00", 60, 15),
    ("MON-SAM-27", "Samsung 27\" QHD Monitor", "75 Hz, eye-saver mode", "21500.00", 30, 8),
    ("KEY-LOG-MK270", "Logitech MK270 Wireless Combo", "Keyboard and mouse", "1795.00", 150, 30),
    ("MOU-LOG-M331", "Logitech M331 Silent Mouse", "Wireless, silent clicks", "1095.00", 200, 40),
    ("PRN-HP-M126", "HP LaserJet Pro MFP M126nw", "Print, scan, copy", "18999.00", 14, 5),
    ("UPS-APC-1100", "APC Back-UPS 1100VA", "Line-interactive UPS", "7450.00", 40, 10),
    ("RTR-TPL-AX55", "TP-Link Archer AX55 Router", "Wi-Fi 6 dual band", "5299.00", 35, 10),
    ("SSD-SAM-1TB", "Samsung 870 EVO 1TB SSD", "SATA III 2.5\"", "7899.00", 8, 10),
    ("HDS-JBR-EV2", "Jabra Evolve2 30 Headset", "USB-C, MS Teams certified", "6499.00", 45, 10),
    ("CHR-ERG-PRO", "Ergonomic Office Chair Pro", "Mesh back, lumbar support", "14500.00", 3, 5),
]


def _seed_master_data(db) -> tuple[list[User], list[Customer], list[Product]]:
    users = [User(name=n, email=e, password_hash=hash_password(p), role=r) for n, e, p, r in USERS]
    customers = [Customer(name=n, email=e, phone=ph, address=a, gstin=g) for n, e, ph, a, g in CUSTOMERS]
    products = [
        Product(sku=s, name=n, description=d, unit_price=Decimal(p), stock_quantity=q, reorder_level=r)
        for s, n, d, p, q, r in PRODUCTS
    ]
    db.add_all(users + customers + products)
    db.flush()
    for product in products:
        db.add(
            InventoryTransaction(
                product=product,
                txn_type=InventoryTxnType.INITIAL,
                quantity_change=product.stock_quantity,
                balance_after=product.stock_quantity,
                note="Opening stock",
                created_by=users[0],
            )
        )
    db.commit()
    return users, customers, products


def _seed_orders(db, users, customers, products) -> None:
    rng = random.Random(42)
    managers = [u for u in users if u.role == UserRole.MANAGER]
    sales_reps = [u for u in users if u.role == UserRole.SALES]
    # Cheap products in small quantities keep these orders under the threshold so they complete directly.
    everyday = [p for p in products if p.unit_price < 10000]

    plans = []
    for _ in range(22):
        lines = rng.sample(everyday, k=rng.randint(1, 3))
        plans.append(("small", [OrderItemIn(product_id=p.id, quantity=rng.randint(1, 2)) for p in lines]))
    for decision in ["approve", "approve", "approve", "reject", "approve", "pending", "pending"]:
        laptop = rng.choice(products[:2])
        plans.append((decision, [OrderItemIn(product_id=laptop.id, quantity=rng.randint(1, 2)),
                                 OrderItemIn(product_id=products[2].id, quantity=rng.randint(1, 3))]))

    now = utcnow()
    for index, (decision, items) in enumerate(plans):
        rep = rng.choice(sales_reps)
        payload = OrderCreate(customer_id=rng.choice(customers).id, items=items)
        try:
            order, _ = order_service.create_order(db, payload, rep)
            if decision == "approve":
                order_service.approve_order(db, order.id, rng.choice(managers), "Approved - regular customer")
            elif decision == "reject":
                order_service.reject_order(db, order.id, managers[0], "Discount not agreed; please re-quote")
        except AppError as exc:  # e.g. stock ran out in the random plan
            db.rollback()
            logger.info("Skipped demo order: %s", exc.message)
            continue

        # Spread history over the last 28 days, keeping the two pending orders recent.
        age = timedelta(days=28 - index, hours=rng.randint(0, 8)) if decision != "pending" else timedelta(hours=index - 26)
        created = now - age
        order.created_at = order.updated_at = created
        if order.completed_at:
            order.completed_at = created + timedelta(hours=rng.randint(1, 20) if order.requires_approval else 0)
        if order.approval:
            order.approval.requested_at = created
            if order.approval.decided_at:
                order.approval.decided_at = order.completed_at or created + timedelta(hours=5)
        for txn in db.scalars(select(InventoryTransaction).where(InventoryTransaction.order_id == order.id)):
            txn.created_at = order.completed_at
        db.commit()


def run() -> None:
    with SessionLocal() as db:
        if db.scalar(select(func.count(User.id))):
            logger.info("Database already has users; skipping seed")
            return
        users, customers, products = _seed_master_data(db)
        if settings.seed_demo_data:
            _seed_orders(db, users, customers, products)
        logger.info("Seeded %d users, %d customers, %d products", len(users), len(customers), len(products))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    # Seeded orders are historical; their approval emails would be noise in the inbox.
    settings.smtp_enabled = False
    run()
