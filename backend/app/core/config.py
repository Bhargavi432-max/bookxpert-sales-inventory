from decimal import Decimal
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "BookXpert Sales & Inventory"
    environment: str = "development"

    database_url: str = "mysql+pymysql://bookxpert:bookxpert@localhost:3310/sales_inventory"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5174"]
    frontend_url: str = "http://localhost:3000"

    # Orders with a total strictly above this amount need manager approval.
    # The live value is stored in app_settings and editable by managers; this is the fallback.
    default_approval_threshold: Decimal = Decimal("50000.00")

    smtp_enabled: bool = True
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = False
    smtp_from: str = "BookXpert Sales <no-reply@bookxpert.local>"

    seed_demo_data: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
