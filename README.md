# Cloud Team Performance Tracker

Tracks the Cloud Team's performance over a July–June fiscal year across three
categories of work:

- **Key Business Initiatives (KBI)** — manager-curated catalog; engineers opt in,
  own tasks, forecast vs. log actual time. An AI-generated task breakdown
  (HLD → LLD → Solution Design Approval → Non-Prod Deployment → Prod Deployment)
  is available per initiative and fully editable afterward.
- **Platform Initiatives** — team improvement projects (upgrades, automation,
  vulnerability management, etc.) with a manager-editable category list. Upgrade
  categories track individual systems/servers, whose completion rolls up into the
  initiative's overall completion %.
- **Recurring Operations** — repeatable operational work (patching, password
  resets). No forecast, just actual hours logged per occurrence.

Two views tie it together: a per-engineer dashboard and a team-wide summary with
completion %, timeline health, and hours-logged charts.

## Architecture

- **Backend**: Python (FastAPI) + PostgreSQL + SQLAlchemy + Alembic. See
  `backend/app/`.
- **Frontend**: React + TypeScript (Vite) + TanStack Query + React Router. See
  `frontend/src/`.
- **AI task breakdown**: a live call to the Claude API (`backend/app/services/ai_breakdown.py`),
  using forced tool-use so the response parses directly into task rows.
- **Auth**: no real authentication in v1 — a lightweight role/engineer switcher
  in the header sends `X-Actor-Role` / `X-Actor-Engineer-Id` headers, resolved by
  a single `get_current_actor()` dependency (`backend/app/core/auth_context.py`).
  Swapping in real auth later means rewriting that one function.

## Running locally (standalone, via Docker)

Requires Docker (Docker Desktop on Windows/Mac, or Docker Engine on Linux).

```bash
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD, and ANTHROPIC_API_KEY if you want the
# AI task-breakdown feature to work
docker compose up -d --build
```

The app is then available at `http://localhost` (or whatever `HTTP_PORT` you set
in `.env`). The frontend container serves the built React app via nginx and
reverse-proxies `/api/*` to the backend container.

To load sample demo data on first start, set `SEED_ON_START=true` in `.env`
before bringing the stack up — **this wipes and reseeds all data**, so only use
it for a fresh install, not on an existing database.

Stop the stack with `docker compose down` (add `-v` to also delete the Postgres
volume and start fresh).

## Running locally (dev mode, without Docker)

**Backend:**

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then edit DATABASE_URL / ANTHROPIC_API_KEY as needed
docker compose up -d   # starts just Postgres, if you don't have it running locally
alembic upgrade head
python scripts/seed_db.py   # optional: loads sample data
uvicorn app.main:app --reload --port 8000
```

Backend API docs (Swagger UI): `http://localhost:8000/docs`.

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:8000` in dev (see `vite.config.ts`),
so the frontend expects the backend to already be running on port 8000.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | Postgres connection string |
| `ANTHROPIC_API_KEY` | backend | Required for the AI task-breakdown feature |
| `ANTHROPIC_MODEL` | backend | Defaults to `claude-sonnet-5` |
| `CORS_ORIGINS` | backend | Comma-separated allowed origins |
| `POSTGRES_PASSWORD` | docker-compose | Postgres password for the standalone stack |
| `HTTP_PORT` | docker-compose | Port the frontend is exposed on (default 80) |
| `SEED_ON_START` | docker-compose | `true` to load sample data on container start |

## Tests

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. pytest
```

Covers fiscal-year boundary logic, the completion-% engine (including the
upgrade-unit override), and the AI-breakdown parsing/persistence (against a
mocked Claude client — no real API calls or cost in the test suite).

## Fiscal year

The fiscal year runs July 1 – June 30 (e.g. `FY25-26` = 2025-07-01 through
2026-06-30). This is pure date math (`backend/app/services/fiscal_year.py`), not
a database table.
