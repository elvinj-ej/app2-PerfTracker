from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_context import Actor, get_current_actor, require_manager
from app.database import get_db
from app.models import Initiative, UpgradeUnit
from app.models.enums import InitiativeType
from app.schemas.upgrade_unit import UpgradeUnitCreate, UpgradeUnitRead, UpgradeUnitUpdate

router = APIRouter(tags=["upgrade-units"])


def _get_platform_initiative_or_404(db: Session, initiative_id: int) -> Initiative:
    initiative = db.get(Initiative, initiative_id)
    if initiative is None or initiative.type != InitiativeType.PLATFORM:
        raise HTTPException(status_code=404, detail="Platform initiative not found")
    return initiative


@router.get("/api/platform-initiatives/{initiative_id}/upgrade-units", response_model=list[UpgradeUnitRead])
def list_upgrade_units(initiative_id: int, db: Session = Depends(get_db)):
    _get_platform_initiative_or_404(db, initiative_id)
    return db.query(UpgradeUnit).filter(UpgradeUnit.initiative_id == initiative_id).order_by(UpgradeUnit.id).all()


@router.post("/api/platform-initiatives/{initiative_id}/upgrade-units", response_model=UpgradeUnitRead, status_code=201)
def create_upgrade_unit(
    initiative_id: int,
    payload: UpgradeUnitCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    _get_platform_initiative_or_404(db, initiative_id)
    unit = UpgradeUnit(initiative_id=initiative_id, **payload.model_dump())
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


@router.patch("/api/upgrade-units/{unit_id}", response_model=UpgradeUnitRead)
def update_upgrade_unit(unit_id: int, payload: UpgradeUnitUpdate, db: Session = Depends(get_db)):
    unit = db.get(UpgradeUnit, unit_id)
    if unit is None:
        raise HTTPException(status_code=404, detail="Upgrade unit not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(unit, field, value)
    db.commit()
    db.refresh(unit)
    return unit


@router.delete("/api/upgrade-units/{unit_id}", status_code=204)
def delete_upgrade_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    unit = db.get(UpgradeUnit, unit_id)
    if unit is None:
        raise HTTPException(status_code=404, detail="Upgrade unit not found")
    db.delete(unit)
    db.commit()
