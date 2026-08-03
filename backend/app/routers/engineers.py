from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_context import Actor, get_current_actor, require_manager
from app.database import get_db
from app.models import Engineer
from app.schemas.engineer import EngineerCreate, EngineerRead, EngineerUpdate

router = APIRouter(prefix="/api/engineers", tags=["engineers"])


@router.get("", response_model=list[EngineerRead])
def list_engineers(db: Session = Depends(get_db)):
    return db.query(Engineer).order_by(Engineer.name).all()


@router.post("", response_model=EngineerRead, status_code=201)
def create_engineer(
    payload: EngineerCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    engineer = Engineer(**payload.model_dump())
    db.add(engineer)
    db.commit()
    db.refresh(engineer)
    return engineer


@router.get("/{engineer_id}", response_model=EngineerRead)
def get_engineer(engineer_id: int, db: Session = Depends(get_db)):
    engineer = db.get(Engineer, engineer_id)
    if engineer is None:
        raise HTTPException(status_code=404, detail="Engineer not found")
    return engineer


@router.patch("/{engineer_id}", response_model=EngineerRead)
def update_engineer(
    engineer_id: int,
    payload: EngineerUpdate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    engineer = db.get(Engineer, engineer_id)
    if engineer is None:
        raise HTTPException(status_code=404, detail="Engineer not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(engineer, field, value)
    db.commit()
    db.refresh(engineer)
    return engineer


@router.delete("/{engineer_id}", status_code=204)
def delete_engineer(
    engineer_id: int,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    engineer = db.get(Engineer, engineer_id)
    if engineer is None:
        raise HTTPException(status_code=404, detail="Engineer not found")
    db.delete(engineer)
    db.commit()
