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

- **Backend**: Python (FastAPI) + SQLAlchemy + Alembic. Defaults to a local
  **SQLite** file (`backend/perftracker.db`) — no separate database server to
  install or manage. Postgres is supported too (just change `DATABASE_URL`) if
  you outgrow SQLite later. See `backend/app/`.
- **Frontend**: React + TypeScript (Vite) + TanStack Query + React Router. See
  `frontend/src/`. The production build is a handful of static files that
  FastAPI serves directly (`backend/app/main.py`) — so the whole app runs as
  **one process**, no separate frontend server needed once built.
- **AI task breakdown**: a live call to the Claude API (`backend/app/services/ai_breakdown.py`),
  using forced tool-use so the response parses directly into task rows.
- **Auth**: no real authentication in v1 — a lightweight role/engineer switcher
  in the header sends `X-Actor-Role` / `X-Actor-Engineer-Id` headers, resolved by
  a single `get_current_actor()` dependency (`backend/app/core/auth_context.py`).
  Swapping in real auth later means rewriting that one function.

## Running standalone on a server (no Docker) — recommended

Requires **Python 3.11+** and, for the one-time frontend build step, **Node.js**
(Node isn't needed afterward to *run* the app — only Python is).

Copy this whole folder to the server, then:

**Windows:**
```bat
setup.bat
start.bat
```

**Mac/Linux:**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
cd ../frontend
npm install && npm run build
rm -rf ../backend/static && cp -r dist ../backend/static
cd ../backend
uvicorn app.main:app --host 0.0.0.0 --port 5020
```

Either way, open `http://localhost:5020/PerfTracker` (or
`http://<server-ip>:5020/PerfTracker` from another machine). Everything — API
and UI — is served by that one process, under the `/PerfTracker` path prefix
(so it can coexist with other internally-hosted apps on the same server using
a `host:port/AppName` convention). Change the port via `start.bat` /
`--port`, and the prefix via `URL_PREFIX` in `backend/.env` (empty string =
serve at the root instead).

To load sample demo data the first time, run `seed_sample_data.bat` (Windows)
or `python scripts/seed_db.py` from an activated venv — **this wipes and
reloads all data**, so only do it once, on a fresh install.

To keep it running after you close the terminal / across reboots, wrap
`start.bat` (or the `uvicorn` command) in a Windows Scheduled Task ("run
whether user is logged on or not", trigger "at startup") or a Linux `systemd`
service — ask if you want one written out for your exact setup.

Set `ANTHROPIC_API_KEY` in `backend/.env` if you want the AI task-breakdown
feature; everything else works without it.

## Running via Docker instead

If you'd rather containerize it (e.g. alongside other Dockerized services),
a `docker-compose.yml` at the repo root runs Postgres + backend + an
nginx-served frontend build:

```bash
cp .env.example .env
docker compose up -d --build
```

See `docker-compose.yml` and each service's `Dockerfile` for details. This
path uses Postgres rather than SQLite.

## Running in dev mode

**Backend:**

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and set `URL_PREFIX=` (blank) — the Vite dev server below
expects the API at the origin root, not under `/PerfTracker`.

```bash
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
so the frontend expects the backend to already be running on port 8000 with
an empty `URL_PREFIX`. Visit `http://localhost:5173`.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | Defaults to `sqlite:///./perftracker.db`; set to a Postgres URL to use Postgres instead |
| `ANTHROPIC_API_KEY` | backend | Required for the AI task-breakdown feature |
| `ANTHROPIC_MODEL` | backend | Defaults to `claude-sonnet-5` |
| `CORS_ORIGINS` | backend | Comma-separated allowed origins (only matters if the frontend is served from a different origin than the API) |
| `STATIC_DIR` | backend | Where the built frontend lives; defaults to `static` |
| `URL_PREFIX` | backend | Path the app is hosted under; defaults to `/PerfTracker`. Empty = serve at root (used for dev mode and the Docker path) |
| `POSTGRES_PASSWORD`, `HTTP_PORT`, `SEED_ON_START` | docker-compose only | See "Running via Docker" above |

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
