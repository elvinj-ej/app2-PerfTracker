# Windows Server Deployment Notes

Reference notes for running PerfTracker standalone on a Windows server (no
Docker), based on getting it running at `C:\Apps\PerfTracker`, port `5020`,
under the `/PerfTracker` path. See `README.md` for the general setup;
this file covers the Windows-specific gotchas actually hit along the way.

## Prerequisites

- **Python 3.11+**
- **Node.js** (LTS, e.g. 24.x) — only needed to build the frontend once;
  not required to run the app afterward
- **Git** (optional but recommended) — install via Chocolatey if not already
  present, so updates are `git pull` instead of manually re-downloading and
  copying a ZIP each time:
  ```powershell
  choco install git -y
  ```

Installing Node.js or Git via Chocolatey, if you don't already have it:
```powershell
choco install nodejs-lts -y
```

## Day-to-day commands

Run these from `C:\Apps\PerfTracker`:

| Command | What it does |
|---|---|
| `.\setup.bat` | One-time (or after any update): creates the Python venv, installs dependencies, runs DB migrations, builds the frontend into `backend\static` |
| `.\start.bat` | Starts the app at `http://localhost:5020/PerfTracker` |
| `.\seed_sample_data.bat` | **Wipes** the database and loads sample demo data |
| `.\update.bat` | `git pull` + re-run setup + restart the running instance (requires Git) |

## Known issues hit during setup, and their fixes

### 1. `npm install` fails with `ECONNRESET` on every package

**Symptom:** `setup.bat`'s frontend build step fails with dozens of
`ECONNRESET` errors fetching packages from `registry.npmjs.org`, even though
`netsh winhttp show proxy` shows no proxy and a plain TCP connection to
`registry.npmjs.org:443` succeeds.

**Cause:** A corporate security appliance (SSL/TLS inspection, e.g.
Zscaler/Palo Alto/similar, or an endpoint agent's network protection feature)
allows the connection through but resets it partway through larger binary
downloads. This is a network-level control, not an npm/proxy misconfiguration
— IT needs to allowlist `registry.npmjs.org` for inspection bypass to fix it
at the source.

**Workaround used:** Build the frontend on a different machine with normal
internet access, then copy the result over:
```powershell
# on a machine with working internet access
git clone -b claude/cloud-team-perf-review-app-e8eaa0 https://github.com/elvinj-ej/app2-perftracker.git
cd app2-perftracker\frontend
npm install
npm run build
```
Copy the **contents** of the resulting `dist` folder into
`C:\Apps\PerfTracker\backend\static` on the server (see issue #2 below for
the exact folder layout it needs to end up in).

### 2. Page loads but is completely blank

**Symptom:** The server starts fine, every request in the access log shows
`200 OK` (including for `/assets/index-*.js`), but the browser shows a blank
page. DevTools console shows:
> Failed to load module script: Expected a JavaScript module script but the
> server responded with a MIME type of "text/html".

**Cause:** Despite the `200 OK`, the JS/CSS files weren't actually being
served — `backend\static` was missing its `assets` subfolder (the `.js`/
`.css` files had been copied directly into `static\` instead of
`static\assets\`), so the app's catch-all route silently fell back to
serving `index.html` for those paths instead.

**Fix:** `backend\static` must look exactly like this (this is what
`frontend\dist` produces):
```
backend\static\
  index.html
  favicon.svg
  icons.svg
  assets\
    index-XXXXXXXX.js
    index-XXXXXXXX.css
```
If the `assets` subfolder is missing, create it and move the `.js`/`.css`
files into it:
```powershell
cd C:\Apps\PerfTracker\backend\static
New-Item -ItemType Directory -Path assets -Force
Move-Item -Path index-*.js, index-*.css -Destination assets
```
Restart `start.bat` and hard-refresh the browser (Ctrl+Shift+R) afterward.

### 3. `seed_sample_data.bat` fails with `ModuleNotFoundError: No module named 'app'`

**Cause:** A real bug (fixed in the repo as of commit `ca3dc81`) —
`scripts\seed_db.py` didn't add the backend root to its own import path, so
running it directly only worked if the caller happened to have `PYTHONPATH`
already set. Pull the latest code (`git pull` or `update.bat`) to pick up the
fix; if you can't, edit `backend\scripts\seed_db.py` to add these two lines
before the `from app.services.seed import main` line:
```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
```

### 4. `git` not recognized

If Git isn't installed, `update.bat` and `git pull` won't work — either
install Git (`choco install git -y`, see Prerequisites above) or fall back to
downloading a fresh ZIP from GitHub each time and manually copying changed
files over (make sure to select the `claude/cloud-team-perf-review-app-e8eaa0`
branch before downloading, not `main`).

## Verifying a deployment is healthy

```powershell
# API responds
Invoke-RestMethod http://localhost:5020/PerfTracker/api/health

# Frontend files are laid out correctly
Get-ChildItem -Recurse C:\Apps\PerfTracker\backend\static
```
The second command's output should match the folder layout shown in issue #2
above. Then open `http://localhost:5020/PerfTracker` in a browser — you
should see the dashboard, not a blank page.
