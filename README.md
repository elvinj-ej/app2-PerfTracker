# Cloud Team Performance Tracker

Tracks the Cloud Team's performance over a July–June fiscal year across three
categories of work — Key Business Initiatives, Platform Initiatives, and
Run Operations — with per-engineer and team-wide views, an AI-assisted
Outcome breakdown, a monthly reporting/export workflow, and a Jira import path
for standing up new initiatives.

## Features

- **Key Business Initiatives (KBI)** — a manager-curated catalog (title,
  business goal, **the Ask** — a plain-language answer to "what does the
  Cloud Team need to provide?" — Jira number, dates, priority, complexity).
  Engineers opt in and own individual Outcomes; a KBI can have several
  engineers, but each Outcome has exactly one owner.
- **Platform Initiatives** — team improvement projects against a
  manager-editable category list (SQL/Windows/VMware/Ops Manager upgrades,
  Improvement, Out-of-Cycle Vulnerability Management, Automation, or any
  category a manager adds). Upgrade-type categories additionally track
  individual systems/servers (`upgrade_units`), and completing those units
  drives the initiative's completion % directly.
- **Run Operations** — repeatable operational work (patching, password
  resets, etc.) against a manager-editable category list (seeded with Run
  Patching, Run ITSCM, Run IAM, Run FinOps — add more from the catalog page
  at any time), with a recurrence type (annual/quarterly/monthly/weekly/ad
  hoc). No forecast is tracked, only actual hours logged per occurrence.
- **Outcomes and AI-generated breakdown** — a KBI's or Platform Initiative's
  work is broken down into **Outcomes**: concrete, single-owner pieces of
  work that answer the initiative's Ask, each with a start date and delivery
  date. Engineers define Outcomes themselves, or generate a suggested
  breakdown via a live Claude API call
  (`backend/app/services/ai_breakdown.py`) that follows the team's
  TOGAF-style lifecycle (HLD → LLD → Solution Design Approval → Non-Prod
  Deployment → Prod Deployment), using forced tool-use so the response
  parses directly into Outcome rows. The engineer can then edit, reorder,
  add, or remove Outcomes freely — nothing about them stays "AI-owned."
  Every Outcome's dates must fall on a Wednesday, and delivery must be
  within two weeks of the start date — see
  [Outcome delivery-date rules](#outcome-delivery-date-rules) below.
- **Weekly time tracking** — engineers log actual hours per Outcome per ISO
  week; re-submitting for the same Outcome/week updates the existing entry
  rather than duplicating it.
- **Engineer Dashboard** — per-engineer view of their KBIs, Platform
  Initiatives, and Run Operations work, completion %/timeline health per
  initiative, and their own Outcome list with forecast vs. actual hours.
- **Team Summary** — organization-wide rollup: hours logged by category and
  by engineer (charts), plus the same completion tables across every KBI,
  Platform Initiative, and Run Operations item.
- **Monthly Report** — a month-picker view for managers showing each KBI/
  Platform Initiative's full predefined Outcome breakdown alongside that
  specific calendar month's actual hours (even though tracking itself is
  weekly), plus an **Export to Excel** button producing a two-sheet workbook
  (Outcome detail, and an engineer × category hours summary) covering all
  three categories for that month.
- **Import from Jira** — upload either a Jira single-issue XML export or a
  Jira Word (.doc) export to pre-fill a new initiative; review and edit every
  field, choose whether it becomes a KBI or a Platform Initiative, and only
  then create it. See
  [Importing initiatives from Jira](#importing-initiatives-from-jira) below.

## Design

### Data model

Rather than three separate tables for KBI/Platform/Run Ops, there's a
single `initiatives` table with a `type` discriminator column, plus 1:1
"detail" tables for type-specific fields (`platform_initiative_details` with
a `category_id`, `recurring_ops_details` with a `category_id` and recurrence
fields). Tasks (branded "Outcomes" in the UI — the underlying table and model
are still named `Task`), time entries, and the opt-in join table
(`initiative_engineers`) all reference `initiatives.id` directly — one shared
foreign key regardless of type — so reporting queries (dashboards, team
summary, monthly report) never need to `UNION` across per-type tables.
Type-specific data (a Platform Initiative's category, a Run Ops item's
category and recurrence schedule, upgrade units) lives in its own table
rather than bloating the shared one with mostly-null columns.

`ask` (the KBI-specific "what does the Cloud Team need to provide?" field) is
a shared column on `initiatives` alongside `business_goal`, even though only
KBIs surface it in the UI — consistent with how `business_goal` itself is
shared across types.

Both Platform Initiative categories and Run Operations categories are
runtime-editable lookup tables (`platform_initiative_categories`,
`recurring_ops_categories`) rather than hardcoded enums, so a manager can add
a new category (e.g. a new upgrade type, or a new Run Ops category beyond the
seeded Run Patching/Run ITSCM/Run IAM/Run FinOps) without a code deploy.

Tasks always have exactly one `owner_engineer_id` (never a join table),
matching the requirement that an Outcome is single-owner even when its parent
initiative has multiple engineers opted in. `time_entries` has a unique
constraint on `(task_id, week_start_date)`, so logging hours for a week is an
upsert, not an append.

### Outcome delivery-date rules

Every Outcome (`start_date`/`delivery_date` on the `tasks` table) must follow
two rules, enforced server-side in `backend/app/services/outcome_dates.py`
and applied on every create/update in `routers/tasks.py`:

- **Both dates must fall on a Wednesday.**
- **`delivery_date` must be within 14 days of `start_date`** — an Outcome
  that won't fit in a two-week window needs to be split into multiple
  sequential Outcomes rather than given a longer window.

When an AI breakdown is generated, dates aren't trusted to the LLM: each
suggested Outcome is assigned a deterministic, sequential, non-overlapping
two-week Wednesday-to-Wednesday window (`sequential_wednesday_windows()`),
chained starting from the initiative's start date (or today, if unset). The
AI prompt is also told to keep each Outcome scoped to fit that window.

### Completion % and timeline health

Implemented in `backend/app/services/completion.py`, covered by
`backend/tests/test_completion.py`.

**KBI, and Platform Initiatives without an upgrade-type category** — forecast-
day-weighted ratio of completed tasks:

```
completion % = Σ(forecast_days of COMPLETE tasks) / Σ(forecast_days of all tasks) × 100
```

If any task is missing a forecast, this falls back to a simple count ratio
(`# complete tasks / # total tasks`) so an initiative with incomplete
forecasting data still gets a reasonable number instead of an error.

**Platform Initiatives with an upgrade-type category** — completion is driven
by the per-system upgrade units instead, overriding the task-based formula:

```
completion % = (# upgrade units marked COMPLETE) / (# total upgrade units) × 100
```

(Falls back to the task-based formula if no units have been added yet.)

**Run Operations** — no completion % at all; only actual hours logged
are reported, since there's no forecast to compare against.

**Timeline health** is a separate signal from completion %, so "how much is
done" and "are we on schedule" stay independently readable rather than being
blended into one number:

```
expected % = (today − start_date) / (expected_delivery_date − start_date) × 100   [clamped 0–100]
delta = completion % − expected %

delta ≥ −15        → On Track
−30 ≤ delta < −15   → At Risk
delta < −30         → Behind
(missing dates, or N/A for Run Operations)
```

### Fiscal year and monthly attribution

Implemented in `backend/app/services/fiscal_year.py` as pure date math (no
database table) — the fiscal year runs **July 1 – June 30**, labeled
`FY25-26` for the year starting July 2025. Weeks are Monday-aligned
(`week_start_date` is always a Monday); a `TimeEntry`'s `fiscal_year_label` is
computed and stored at write time so reporting queries can filter directly
without recomputing date math per row.

For the Monthly Report, a week's hours are attributed entirely to the
**calendar month containing that week's Monday** — the simplest unambiguous
rule for a week that straddles a month boundary (e.g. a week starting July 28
counts fully toward July, even though it runs into August).

## Architecture

- **Backend**: Python (FastAPI) + SQLAlchemy + Alembic. Defaults to a local
  **SQLite** file (`backend/perftracker.db`) — no separate database server to
  install or manage. Postgres is supported too (just change `DATABASE_URL`) if
  you outgrow SQLite later. See `backend/app/`.
- **Frontend**: React + TypeScript (Vite) + TanStack Query + React Router. See
  `frontend/src/`. The production build is a handful of static files that
  FastAPI serves directly (`backend/app/main.py`) — so the whole app runs as
  **one process**, no separate frontend server needed once built.
- **Auth**: no real authentication in v1 — a lightweight role/engineer switcher
  in the header sends `X-Actor-Role` / `X-Actor-Engineer-Id` headers, resolved by
  a single `get_current_actor()` dependency (`backend/app/core/auth_context.py`).
  Swapping in real auth later means rewriting that one function.
- **Excel export**: `backend/app/services/excel_export.py` builds the Monthly
  Report workbook with `openpyxl` — no pandas dependency.
- **Hosting under a path prefix**: the whole FastAPI app is mounted as a
  sub-application under a configurable `URL_PREFIX` (default `/PerfTracker`),
  so it can sit at `host:port/AppName` alongside other internally-hosted
  tools. See `backend/app/main.py`.

## Importing initiatives from Jira

A manager can import a Key Business Initiative or Platform Initiative from
either of Jira's single-issue export formats via the **Import from Jira**
page — upload the file, review the parsed fields (nothing is saved yet),
choose whether it becomes a KBI or a Platform Initiative, edit anything, then
create it. Both formats feed the same review step and pull out the same set
of fields. Neither Jira export format has an equivalent of "the Ask," so when
importing as a KBI the manager fills that field in during review, same as on
the manual KBI creation form.

**XML export** (in Jira: open the issue → **Export** → **XML**), parsed by
`backend/app/services/jira_import.py`: the issue key, summary, description
(HTML stripped to plain text), the "Target start"/"Target end" custom fields
for the initiative's dates, "Purpose" or "Opportunity" for the business goal,
and the priority (mapped from Jira's Must/Should/Could/Won't Have scale to
Low/Medium/High/Critical). Linked issues (Blocks/Relates/etc.) are counted but
not imported — there's no equivalent concept in this app. Uploaded XML is
parsed with `defusedxml` rather than the stdlib parser, since this file comes
from the user rather than from a trusted source.

**Word export** (in Jira: open the issue → **Export** → **Word**), parsed by
`backend/app/services/word_doc_import.py`. Despite the `.doc` extension, this
is actually an HTML document with a label/value table layout, not a binary
Word file, so it's parsed as text rather than requiring any Word-reading
library. Pulls the same fields as the XML export, plus "Priority" and
"Status" from their own labeled rows, and folds "Opportunity", "Who will
Benefit?", and "Functional Stream" into the description (each clearly
labeled) since there's no dedicated field for them in this app's data model.

## Running standalone on a server (no Docker) — recommended

Requires **Python 3.11+** and, for the one-time frontend build step, **Node.js**
(Node isn't needed afterward to *run* the app — only Python is).

Get the code onto the server with `git clone` rather than a downloaded ZIP if
you can — it makes future updates a one-command `git pull` instead of
re-downloading and re-copying files by hand:

```bat
git clone -b claude/cloud-team-perf-review-app-e8eaa0 https://github.com/elvinj-ej/app2-perftracker.git C:\Apps\PerfTracker
cd C:\Apps\PerfTracker
```

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

### Updating after a code change

You don't need to redo the whole setup - only `setup.bat` picks up whatever
actually changed (new dependencies, a new database migration, a rebuilt
frontend), and it's safe to re-run any time. If the code came in via
`git clone`, `update.bat` does the whole cycle in one step: `git pull`, then
`setup.bat`, then it stops whatever's currently running on port 5020 and
restarts it in a new window.

```bat
update.bat
```

If you downloaded a ZIP instead of using `git clone`, there's no repo to pull
from - re-download the latest ZIP, extract it, copy the files over the
folder (keep your existing `backend\.env` and `backend\perftracker.db` -
don't overwrite those), then run `setup.bat` and restart `start.bat` yourself.

Set `ANTHROPIC_API_KEY` in `backend/.env` if you want the AI task-breakdown
feature; everything else works without it.

Hit a snag on a Windows server specifically (npm/network errors, a blank
page after deploying, etc.)? See **`WINDOWS_DEPLOYMENT.md`** — it covers the
issues actually run into deploying this way and their fixes.

## Running via Docker instead

If you'd rather containerize it (e.g. alongside other Dockerized services),
a `docker-compose.yml` at the repo root runs Postgres + backend + an
nginx-served frontend build:

```bash
cp .env.example .env
docker compose up -d --build
```

See `docker-compose.yml` and each service's `Dockerfile` for details. This
path uses Postgres rather than SQLite, and serves at the root (`URL_PREFIX`
empty) rather than under `/PerfTracker`.

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
upgrade-unit override and the timeline-health thresholds), the Outcome
delivery-date rules (Wednesday alignment, the 14-day span limit, and the
deterministic window-assignment helper), the AI-breakdown parsing/persistence
(against a mocked Claude client — no real API calls or cost in the test
suite), and both Jira import parsers — the XML one (including a check that
it rejects an XXE payload) and the Word/HTML one.
