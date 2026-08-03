#!/bin/sh
set -e

alembic upgrade head

if [ "$SEED_ON_START" = "true" ]; then
  python scripts/seed_db.py
fi

exec "$@"
