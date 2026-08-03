from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Engineer
from app.schemas.reporting import EngineerDashboard, TeamSummary
from app.services.reporting import build_engineer_dashboard, build_team_summary

router = APIRouter(tags=["reports"])


@router.get("/api/engineers/{engineer_id}/dashboard", response_model=EngineerDashboard)
def get_engineer_dashboard(engineer_id: int, db: Session = Depends(get_db)):
    engineer = (
        db.query(Engineer)
        .options(selectinload(Engineer.initiative_links))
        .filter(Engineer.id == engineer_id)
        .first()
    )
    if engineer is None:
        raise HTTPException(status_code=404, detail="Engineer not found")
    return build_engineer_dashboard(db, engineer)


@router.get("/api/team/summary", response_model=TeamSummary)
def get_team_summary(db: Session = Depends(get_db)):
    return build_team_summary(db)
