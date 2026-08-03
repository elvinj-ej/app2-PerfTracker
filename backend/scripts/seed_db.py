#!/usr/bin/env python3
import sys
from pathlib import Path

# Makes this runnable directly (python scripts/seed_db.py) regardless of the caller's
# working directory or PYTHONPATH - without this, the `app` package (one level up from
# this script) isn't importable unless something else already put it on sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.seed import main  # noqa: E402

if __name__ == "__main__":
    main()
