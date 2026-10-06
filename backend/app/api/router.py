from fastapi import APIRouter

from app.api.routes import approvals, auth, customers, dashboard, inventory, orders, products, settings, users

api_router = APIRouter()
for module in (auth, users, customers, products, inventory, orders, approvals, dashboard, settings):
    api_router.include_router(module.router)
