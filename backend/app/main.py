from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import (
    engineers,
    kbi,
    platform_categories,
    platform_initiatives,
    recurring_ops,
    reports,
    tasks,
    time_entries,
    upgrade_units,
)

app = FastAPI(title="Cloud Team Performance Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(engineers.router)
app.include_router(platform_categories.router)
app.include_router(kbi.router)
app.include_router(platform_initiatives.router)
app.include_router(recurring_ops.router)
app.include_router(tasks.router)
app.include_router(time_entries.router)
app.include_router(upgrade_units.router)
app.include_router(reports.router)


@app.get("/api/health")
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
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        candidate = _static_dir / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_static_dir / "index.html")
