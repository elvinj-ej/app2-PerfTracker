from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_context import Actor, get_current_actor, require_manager
from app.database import get_db
from app.models import Engineer, Initiative
from app.models.enums import InitiativeType
from app.schemas.initiative import KbiCreate, KbiRead, KbiUpdate
from app.schemas.opt_in import GenerateBreakdownRequest, OptInRequest
from app.schemas.task import TaskRead
from app.services.ai_breakdown import AiBreakdownError, generate_and_persist_breakdown
from app.services.initiatives import opt_in as _opt_in
from app.services.initiatives import opt_out as _opt_out
from app.services.initiatives import query_by_type, to_kbi_read

router = APIRouter(prefix="/api/kbis", tags=["kbis"])


@router.get("", response_model=list[KbiRead])
def list_kbis(db: Session = Depends(get_db)):
    initiatives = query_by_type(db, InitiativeType.KBI).order_by(Initiative.expected_delivery_date).all()
    return [to_kbi_read(i) for i in initiatives]


@router.post("", response_model=KbiRead, status_code=201)
def create_kbi(
    payload: KbiCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    initiative = Initiative(type=InitiativeType.KBI, **payload.model_dump())
    db.add(initiative)
    db.commit()
    db.refresh(initiative)
    return to_kbi_read(initiative)


def _get_kbi_or_404(db: Session, kbi_id: int) -> Initiative:
    initiative = query_by_type(db, InitiativeType.KBI).filter(Initiative.id == kbi_id).first()
    if initiative is None:
        raise HTTPException(status_code=404, detail="KBI not found")
    return initiative


@router.get("/{kbi_id}", response_model=KbiRead)
def get_kbi(kbi_id: int, db: Session = Depends(get_db)):
    return to_kbi_read(_get_kbi_or_404(db, kbi_id))


@router.patch("/{kbi_id}", response_model=KbiRead)
def update_kbi(
    kbi_id: int,
    payload: KbiUpdate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    initiative = _get_kbi_or_404(db, kbi_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(initiative, field, value)
    db.commit()
    db.refresh(initiative)
    return to_kbi_read(initiative)


@router.delete("/{kbi_id}", status_code=204)
def delete_kbi(
    kbi_id: int,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    initiative = _get_kbi_or_404(db, kbi_id)
    db.delete(initiative)
    db.commit()


@router.post("/{kbi_id}/opt-in", status_code=204)
def opt_in_kbi(
    kbi_id: int,
    payload: OptInRequest,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    _get_kbi_or_404(db, kbi_id)
    engineer_id = payload.engineer_id if payload.engineer_id is not None else actor.engineer_id
    if engineer_id is None:
        raise HTTPException(status_code=400, detail="engineer_id is required")
    if db.get(Engineer, engineer_id) is None:
        raise HTTPException(status_code=404, detail="Engineer not found")
    _opt_in(db, kbi_id, engineer_id)


@router.delete("/{kbi_id}/opt-in", status_code=204)
def opt_out_kbi(
    kbi_id: int,
    payload: OptInRequest,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    _get_kbi_or_404(db, kbi_id)
    engineer_id = payload.engineer_id if payload.engineer_id is not None else actor.engineer_id
    if engineer_id is None:
        raise HTTPException(status_code=400, detail="engineer_id is required")
    _opt_out(db, kbi_id, engineer_id)


@router.post("/{kbi_id}/tasks/generate-ai-breakdown", response_model=list[TaskRead], status_code=201)
def generate_kbi_breakdown(
    kbi_id: int,
    payload: GenerateBreakdownRequest,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    initiative = _get_kbi_or_404(db, kbi_id)
    owner_id = payload.default_owner_engineer_id if payload.default_owner_engineer_id is not None else actor.engineer_id
    if owner_id is None:
        raise HTTPException(status_code=400, detail="default_owner_engineer_id is required")
    if db.get(Engineer, owner_id) is None:
        raise HTTPException(status_code=404, detail="default_owner_engineer_id does not reference a known engineer")
    try:
        return generate_and_persist_breakdown(db, initiative, owner_id)
    except AiBreakdownError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
