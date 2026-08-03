from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
