#!/bin/sh
set -e
echo "Applying database migrations..."
alembic upgrade head
echo "Seeding demo data (skipped if already seeded)..."
python -m app.seed
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers
