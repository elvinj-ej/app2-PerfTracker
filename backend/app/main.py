import mimetypes
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings

# Some Windows machines have a corrupted registry mapping for these extensions (often
# ".js" -> "text/plain"), which Python's mimetypes module picks up and which then makes
# browsers refuse to execute the built JS as an ES module ("Failed to load module
# script: Expected a JavaScript module script but the server responded with a MIME
# type of ..."), rendering a blank page even though every request 200s. Registering
# these explicitly overrides whatever the OS supplied, on every platform.
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")
from app.routers import (
    engineers,
    initiative_import,
    kbi,
    platform_categories,
    platform_initiatives,
    recurring_ops,
    recurring_ops_categories,
    reports,
    tasks,
    time_entries,
    upgrade_units,
)

api_app = FastAPI(title="Cloud Team Performance Tracker API")

api_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_app.include_router(engineers.router)
api_app.include_router(initiative_import.router)
api_app.include_router(platform_categories.router)
api_app.include_router(recurring_ops_categories.router)
api_app.include_router(kbi.router)
api_app.include_router(platform_initiatives.router)
api_app.include_router(recurring_ops.router)
api_app.include_router(tasks.router)
api_app.include_router(time_entries.router)
api_app.include_router(upgrade_units.router)
api_app.include_router(reports.router)


@api_app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Serves the built React app (frontend/dist, copied to `static/`) when present, so the
# whole app runs as a single process with no separate frontend server. In dev mode
# without a build, this directory doesn't exist and the Vite dev server (with its own
# /api proxy) is used instead.
_static_dir = Path(settings.static_dir)
if _static_dir.is_dir():
    assets_dir = _static_dir / "assets"
    if assets_dir.is_dir():
        api_app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @api_app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        candidate = _static_dir / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_static_dir / "index.html")


# When URL_PREFIX is set (e.g. "/PerfTracker", to host this app at
# http://host:port/PerfTracker alongside other internally-hosted apps on the same
# server), the whole app above is mounted as a sub-application under that prefix.
# Leave URL_PREFIX empty to serve at the root instead.
_prefix = settings.url_prefix.rstrip("/")
if _prefix:
    app = FastAPI(title="Cloud Team Performance Tracker")
    app.mount(_prefix, api_app)

    @app.get("/")
    def redirect_to_app() -> RedirectResponse:
        return RedirectResponse(url=f"{_prefix}/")
else:
    app = api_app
