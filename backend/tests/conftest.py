"""Tests run against in-memory SQLite so they need no MySQL. SELECT ... FOR UPDATE is
a no-op there; the locking itself is exercised by the running app on MySQL."""
import os

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SMTP_ENABLED", "false")

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models import Customer, Product, User, UserRole
from app.services import email_service

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def db():
    Base.metadata.create_all(engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture()
def sent_emails(monkeypatch):
    outbox: list[email_service.OutgoingEmail] = []
    monkeypatch.setattr(email_service, "send_email", outbox.append)
    return outbox


@pytest.fixture()
def client(db, sent_emails):
    def override_get_db():
        session = TestingSession()
        try:
            yield session
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def seed(db):
    users = {
        "manager": User(name="Mona Manager", email="manager@test.com", password_hash=hash_password("Manager@123"), role=UserRole.MANAGER),
        "manager2": User(name="Max Manager", email="manager2@test.com", password_hash=hash_password("Manager@123"), role=UserRole.MANAGER),
        "sales": User(name="Sam Sales", email="sales@test.com", password_hash=hash_password("Sales@123"), role=UserRole.SALES),
    }
    customer = Customer(name="Acme Corp", email="acme@test.com", phone="+91 99999 00000")
    cheap = Product(sku="CHEAP-1", name="Mouse", unit_price=Decimal("1000.00"), stock_quantity=50, reorder_level=5)
    pricey = Product(sku="PRICEY-1", name="Laptop", unit_price=Decimal("60000.00"), stock_quantity=5, reorder_level=2)
    db.add_all([*users.values(), customer, cheap, pricey])
    db.commit()
    return {"users": users, "customer": customer, "cheap": cheap, "pricey": pricey}


def _login(client, email, password):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture()
def sales_headers(client, seed):
    return _login(client, "sales@test.com", "Sales@123")


@pytest.fixture()
def manager_headers(client, seed):
    return _login(client, "manager@test.com", "Manager@123")


@pytest.fixture()
def manager2_headers(client, seed):
    return _login(client, "manager2@test.com", "Manager@123")
