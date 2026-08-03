from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_context import Actor, get_current_actor, require_manager
from app.database import get_db
from app.models import Engineer, Initiative, RecurringOpsDetail
from app.models.enums import InitiativeType
from app.schemas.initiative import RecurringOpsCreate, RecurringOpsRead, RecurringOpsUpdate
from app.schemas.opt_in import OptInRequest
from app.services.initiatives import opt_in as _opt_in
from app.services.initiatives import opt_out as _opt_out
from app.services.initiatives import query_by_type, to_recurring_ops_read

router = APIRouter(prefix="/api/recurring-ops", tags=["recurring-ops"])


@router.get("", response_model=list[RecurringOpsRead])
def list_recurring_ops(db: Session = Depends(get_db)):
    initiatives = query_by_type(db, InitiativeType.RECURRING_OPS).order_by(Initiative.title).all()
    return [to_recurring_ops_read(i) for i in initiatives]


@router.post("", response_model=RecurringOpsRead, status_code=201)
def create_recurring_ops(
    payload: RecurringOpsCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    data = payload.model_dump()
    recurrence_fields = {
        k: data.pop(k) for k in ("recurrence_type", "recurrence_interval", "anchor_month", "anchor_day")
    }
    initiative = Initiative(type=InitiativeType.RECURRING_OPS, **data)
    db.add(initiative)
    db.flush()
    db.add(RecurringOpsDetail(initiative_id=initiative.id, **recurrence_fields))
    db.commit()
    initiative = query_by_type(db, InitiativeType.RECURRING_OPS).filter(Initiative.id == initiative.id).first()
    return to_recurring_ops_read(initiative)


def _get_recurring_ops_or_404(db: Session, initiative_id: int) -> Initiative:
    initiative = query_by_type(db, InitiativeType.RECURRING_OPS).filter(Initiative.id == initiative_id).first()
    if initiative is None:
        raise HTTPException(status_code=404, detail="Recurring ops initiative not found")
    return initiative


@router.get("/{initiative_id}", response_model=RecurringOpsRead)
def get_recurring_ops(initiative_id: int, db: Session = Depends(get_db)):
    return to_recurring_ops_read(_get_recurring_ops_or_404(db, initiative_id))


@router.patch("/{initiative_id}", response_model=RecurringOpsRead)
def update_recurring_ops(
    initiative_id: int,
    payload: RecurringOpsUpdate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    initiative = _get_recurring_ops_or_404(db, initiative_id)
    data = payload.model_dump(exclude_unset=True)
    for field in ("recurrence_type", "recurrence_interval", "anchor_month", "anchor_day"):
        if field in data:
            setattr(initiative.recurring_ops_detail, field, data.pop(field))
    for field, value in data.items():
        setattr(initiative, field, value)
    db.commit()
    db.refresh(initiative)
    return to_recurring_ops_read(initiative)


@router.delete("/{initiative_id}", status_code=204)
def delete_recurring_ops(
    initiative_id: int,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    initiative = _get_recurring_ops_or_404(db, initiative_id)
    db.delete(initiative)
    db.commit()


@router.post("/{initiative_id}/opt-in", status_code=204)
def opt_in_recurring_ops(
    initiative_id: int,
    payload: OptInRequest,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    _get_recurring_ops_or_404(db, initiative_id)
    engineer_id = payload.engineer_id if payload.engineer_id is not None else actor.engineer_id
    if engineer_id is None:
        raise HTTPException(status_code=400, detail="engineer_id is required")
    if db.get(Engineer, engineer_id) is None:
        raise HTTPException(status_code=404, detail="Engineer not found")
    _opt_in(db, initiative_id, engineer_id)


@router.delete("/{initiative_id}/opt-in", status_code=204)
def opt_out_recurring_ops(
    initiative_id: int,
    payload: OptInRequest,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    _get_recurring_ops_or_404(db, initiative_id)
    engineer_id = payload.engineer_id if payload.engineer_id is not None else actor.engineer_id
    if engineer_id is None:
        raise HTTPException(status_code=400, detail="engineer_id is required")
    _opt_out(db, initiative_id, engineer_id)
