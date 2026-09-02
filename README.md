# Cloud Team Performance Tracker

Tracks the Cloud Team's performance over a July–June fiscal year across three
categories of work — **Change Business**, **Change Platform**, and **Run
Operations** — with a Marketplace for engineers to pick up open work,
per-engineer and team-wide views, an AI-assisted Outcome breakdown, a monthly
reporting/export workflow, and a Jira import path for standing up new Asks.

Everything the team needs to deliver is modeled as an **Ask** — the internal
type names (`KBI`, `PLATFORM`, `RECURRING_OPS`) predate the Change
Business/Change Platform/Run Operations naming and stayed as-is rather than
being renamed everywhere in the codebase; only the UI labels changed.

## Features

- **Change Business** (internally `KBI`) — a manager-curated catalog of Asks
  (the Ask text itself, a business goal, optional additional Ask detail, a
  manager-editable category, Jira number, dates, priority, complexity).
  Engineers opt in and own individual Outcomes; an Ask can have several
  engineers, but each Outcome has exactly one owner.
- **Change Platform** (internally `PLATFORM`) — team improvement projects
  against a manager-editable category list (SQL/Windows/VMware/Ops Manager
  upgrades, Improvement, Out-of-Cycle Vulnerability Management, Automation,
  or any category a manager adds). Upgrade-type categories additionally
  track individual systems/servers (`upgrade_units`), and completing those
  units drives the initiative's completion % directly.
- **Run Operations** (internally `RECURRING_OPS`) — repeatable operational
  work (patching, password resets, cost control, etc.) against a
  manager-editable category list, with a recurrence type (daily/weekly/
  monthly/quarterly/half-yearly/annual/ad hoc) and a priority. No forecast is
  tracked, only actual hours logged per occurrence. See
  [Managing repeated Asks](#managing-repeated-asks) below for how a recurring
  Ask is represented (one persistent Ask, not a row per occurrence) and how
  that shows up in the Marketplace.
- **Marketplace** — every open Ask across all three categories in one place.
  Engineers filter by category, see each Ask's priority and cadence/delivery
  badge, and opt in directly from the card ("Unclaimed only" is on by
  default so picking up new work doesn't mean scrolling past everything
  already covered). See `frontend/src/pages/MarketplacePage.tsx`.
- **Outcomes and AI-generated breakdown** — a Change Business or Change
  Platform Ask's work is broken down into **Outcomes**: concrete,
  single-owner pieces of work that answer the Ask, each with a start date
  and delivery date. Engineers define Outcomes themselves, or generate a
  suggested breakdown via a live Claude API call
  (`backend/app/services/ai_breakdown.py`) that follows the team's
  TOGAF-style lifecycle (HLD → LLD → Solution Design Approval → Non-Prod
  Deployment → Prod Deployment), using forced tool-use so the response
  parses directly into Outcome rows. The engineer can then edit, reorder,
  add, or remove Outcomes freely — nothing about them stays "AI-owned."
  Every Outcome's dates must fall on a Wednesday, delivery must be within
  two weeks of the start date, and neither date may fall outside the parent
  Ask's own start/delivery window — see
  [Outcome delivery-date rules](#outcome-delivery-date-rules) below.
- **Weekly time tracking** — engineers log actual hours per Outcome per ISO
  week; re-submitting for the same Outcome/week updates the existing entry
  rather than duplicating it.
- **Engineer Dashboard** — per-engineer view of their Change Business, Change
  Platform, and Run Operations work, completion %/timeline health per
  initiative, and their own Outcome list with forecast vs. actual hours.
- **Team Summary** — organization-wide rollup: hours logged by category and
  by engineer (charts), plus the same completion tables across every Change
  Business, Change Platform, and Run Operations Ask.
- **Monthly Report** — a month-picker view for managers showing each Change
  Business/Change Platform Ask's full predefined Outcome breakdown alongside
  that specific calendar month's actual hours (even though tracking itself
  is weekly), plus an **Export to Excel** button producing a two-sheet
  workbook (Outcome detail, and an engineer × category hours summary)
  covering all three categories for that month.
- **Import from Jira** — upload either a Jira single-issue XML export or a
  Jira Word (.doc) export to pre-fill a new Ask; review and edit every
  field, choose whether it becomes a Change Business or Change Platform Ask
  (and its category), and only then create it. See
  [Importing initiatives from Jira](#importing-initiatives-from-jira) below.
- **Upload Marketplace** — a manager can bulk-load the whole Ask catalog
  from a spreadsheet (Category / Ask / By Date / Outcome columns), either
  adding only the Asks not already in the Marketplace or replacing the
  entire catalog outright. Always shows a full preview - counts, warnings,
  every parsed row - before anything is written. See
  [Uploading the Marketplace Ask catalog](#uploading-the-marketplace-ask-catalog)
  below.

## Design

### Data model

Rather than three separate tables for Change Business/Change Platform/Run
Ops, there's a single `initiatives` table with a `type` discriminator column
(`KBI`/`PLATFORM`/`RECURRING_OPS`), plus 1:1 "detail" tables for
type-specific fields (`kbi_details`, `platform_initiative_details`,
`recurring_ops_details` — each just an `initiative_id` + `category_id`,
`recurring_ops_details` additionally carrying the recurrence fields). Tasks
(branded "Outcomes" in the UI — the underlying table and model are still
named `Task`), time entries, and the opt-in join table
(`initiative_engineers`) all reference `initiatives.id` directly — one
shared foreign key regardless of type — so reporting queries (dashboards,
team summary, monthly report) never need to `UNION` across per-type tables.

`ask` (an optional free-text field for extra detail beyond the Ask title
itself) and `priority` are shared columns on `initiatives`, even though
`ask` is currently only surfaced in the Change Business UI — consistent with
how `business_goal` is shared across types despite being KBI/Platform-only
in practice.

All three category lookups (`kbi_categories`, `platform_initiative_categories`,
`recurring_ops_categories`) are runtime-editable tables rather than hardcoded
enums, so a manager can add a new category (e.g. a new upgrade type, or a new
Change Business area beyond the ones loaded from the FY26-27 catalog) without
a code deploy.

Tasks always have exactly one `owner_engineer_id` (never a join table),
matching the requirement that an Outcome is single-owner even when its parent
initiative has multiple engineers opted in. `time_entries` has a unique
constraint on `(task_id, week_start_date)`, so logging hours for a week is an
upsert, not an append.

### Managing repeated Asks

A Run Operations Ask that recurs (e.g. "Monthly - Windows OS patching") is
**one persistent row**, not a new row generated per occurrence — the
`recurrence_type` on its `recurring_ops_details` (daily/weekly/monthly/
quarterly/half-yearly/annual/ad hoc) is the whole representation of "how
often." There's no separate occurrence/instance table: the engineer who owns
it logs actual hours against Outcomes they create for each cycle (e.g. a
fresh "August patch cycle" Outcome each month), and the Ask itself just
keeps existing as the standing responsibility.

That's also how it shows up in the **Marketplace**: a recurring Ask appears
as a single card with a cadence badge ("Recurs monthly", "Recurs
half-yearly", ...) instead of one card per occurrence. Opting in means taking
on the ongoing responsibility, not claiming a single instance of it — so
once claimed, a recurring Ask stays off the "Unclaimed only" view
indefinitely, the same way a Change Business/Change Platform Ask does once
someone opts in.

### Outcome delivery-date rules

Every Outcome (`start_date`/`delivery_date` on the `tasks` table) must follow
three rules, enforced server-side in `backend/app/services/outcome_dates.py`
and applied on every create/update in `routers/tasks.py`:

- **Both dates must fall on a Wednesday.**
- **`delivery_date` must be within 14 days of `start_date`** — an Outcome
  that won't fit in a two-week window needs to be split into multiple
  sequential Outcomes rather than given a longer window.
- **Neither date may fall outside the parent Ask's own window** —
  `start_date` can't be before the Ask's `start_date`, and `delivery_date`
  can't be after the Ask's `expected_delivery_date` (`validate_within_ask_timeline()`).
  Either bound is skipped if the Ask itself doesn't have that date set (Run
  Operations Asks have no dates of their own, so this is a no-op there).

When an AI breakdown is generated, dates aren't trusted to the LLM: each
suggested Outcome is assigned a deterministic, sequential, non-overlapping
two-week Wednesday-to-Wednesday window (`sequential_wednesday_windows()`),
chained starting from the initiative's start date (or today, if unset). The
AI prompt is also told to keep each Outcome scoped to fit that window.

### Completion % and timeline health

Implemented in `backend/app/services/completion.py`, covered by
`backend/tests/test_completion.py`.

**Change Business, and Change Platform Asks without an upgrade-type
category** — forecast-day-weighted ratio of completed Outcomes:

```
completion % = Σ(forecast_days of COMPLETE tasks) / Σ(forecast_days of all tasks) × 100
```

If any task is missing a forecast, this falls back to a simple count ratio
(`# complete tasks / # total tasks`) so an initiative with incomplete
forecasting data still gets a reasonable number instead of an error.

**Change Platform Asks with an upgrade-type category** — completion is driven
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

A manager can import a Change Business or Change Platform Ask from either of
Jira's single-issue export formats via the **Import from Jira** page —
upload the file, review the parsed fields (nothing is saved yet), choose
whether it becomes a Change Business or Change Platform Ask, pick its
category, edit anything, then create it. Both formats feed the same review
step and pull out the same set of fields. Neither Jira export format has an
equivalent of the optional "additional Ask detail" field, so the manager
fills that in during review if needed, same as on the manual creation form.

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

## Uploading the Marketplace Ask catalog

A manager can bulk-load the entire Marketplace from one spreadsheet via the
**Upload Marketplace** page, instead of creating Asks one at a time. Download
the blank template from that page (or build your own) with these columns:

| Category | Ask | By Date | Outcome 1 | Outcome 2 | ... |
|---|---|---|---|---|---|

- **Category** decides the type: a category starting with "Run" becomes a
  Run Operations Ask, "Change Platform" a Change Platform Ask, "Change
  Business" a Change Business Ask (same convention as the built-in FY26-27
  catalog in `backend/app/data/fy2627_asks.py`). Any other category is
  flagged in the preview and skipped.
- **Ask** becomes the initiative's title.
- **By Date** is parsed the same way as the built-in catalog: a recurrence
  ("by end of month", "by end of quarter", ...) for Run Operations rows, or a
  concrete FY26-27 delivery date for Change Platform/Change Business rows.
  See `backend/app/services/ask_parsing.py` for the exact phrase mapping.
- Every populated **Outcome N** cell on a row becomes an Outcome under that
  Ask automatically, in column order — handy for listing out each
  server/UPS/system as its own Outcome. Outcomes created this way start
  unassigned ("Unassigned" in the owner dropdown) until an engineer opts in
  and claims one.

Uploading always shows a **preview** first — every row parsed, its inferred
type/priority/dates, its Outcome count, and any warnings (unrecognized
category, missing Ask, duplicate title) — before anything is written. From
there, choose:

- **Add** — only creates Asks whose title isn't already in the Marketplace
  (matched per type, case-insensitively); everything else is left untouched.
- **Overwrite** — deletes every existing Ask, Outcome, and opt-in (Run
  Operations, Change Platform, and Change Business alike) and loads only
  what's in the file. Engineers themselves are never deleted. This requires
  an explicit confirmation checkbox since it can't be undone.

See `backend/app/services/ask_catalog_import.py` for the parser and
`backend/app/routers/ask_catalog_import.py` for the preview/commit endpoints.

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

To load the starting data the first time, run `seed_sample_data.bat`
(Windows) or `python scripts/seed_db.py` from an activated venv — **this
wipes and reloads all data**, so only do it once, on a fresh install. It's
not demo/placeholder data: it loads the real FY26-27 Ask catalog
(`backend/app/data/fy2627_asks.py`) as unclaimed Marketplace Asks, keeping
only the 3 named engineers as sample accounts. See
[Managing repeated Asks](#managing-repeated-asks) and
`backend/app/services/seed.py` for the category/date/priority assumptions it
makes while loading.

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

**Your data is never wiped by an update.** `backend/perftracker.db` is
git-ignored, so `git pull` can't touch it, and `update.bat`/`setup.bat` only
ever run `alembic upgrade head` - schema migrations that add tables/columns
(and backfill sensible defaults where needed), never ones that delete your
data. The *only* thing that wipes the database is deliberately running
`seed_sample_data.bat` (or `python scripts/seed_db.py`) yourself - it says so
before it does anything, and asks you to confirm. As extra insurance, both
`setup.bat` (before every migration) and `seed_sample_data.bat` (before
wiping) now copy `perftracker.db` to `backend\backups\` with a timestamp
first, so a bad update or an accidental reseed is always one file-copy away
from undone. Restore by stopping the app, copying the backup back over
`backend\perftracker.db`, and restarting.

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
python scripts/seed_db.py   # optional: loads the FY26-27 Ask catalog
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
delivery-date rules (Wednesday alignment, the 14-day span limit, the
parent-Ask timeline bound, and the deterministic window-assignment helper),
the FY26-27 seed catalog (cadence/date/priority parsing, and that every
seeded row actually serializes through its API Read schema), the
AI-breakdown parsing/persistence (against a mocked Claude client — no real
API calls or cost in the test suite), and both Jira import parsers — the XML
one (including a check that it rejects an XXE payload) and the Word/HTML
one.
