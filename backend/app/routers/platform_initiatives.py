from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_context import Actor, get_current_actor, require_manager
from app.database import get_db
from app.models import Engineer, Initiative, PlatformInitiativeCategory, PlatformInitiativeDetail
from app.models.enums import InitiativeType
from app.schemas.initiative import PlatformInitiativeCreate, PlatformInitiativeRead, PlatformInitiativeUpdate
from app.schemas.opt_in import GenerateBreakdownRequest, OptInRequest
from app.schemas.task import TaskRead
from app.services.ai_breakdown import AiBreakdownError, generate_and_persist_breakdown
from app.services.initiatives import opt_in as _opt_in
from app.services.initiatives import opt_out as _opt_out
from app.services.initiatives import query_by_type, to_platform_read

router = APIRouter(prefix="/api/platform-initiatives", tags=["platform-initiatives"])


def _get_category_or_404(db: Session, category_id: int) -> PlatformInitiativeCategory:
    category = db.get(PlatformInitiativeCategory, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Platform initiative category not found")
    return category


@router.get("", response_model=list[PlatformInitiativeRead])
def list_platform_initiatives(db: Session = Depends(get_db)):
    initiatives = query_by_type(db, InitiativeType.PLATFORM).order_by(Initiative.expected_delivery_date).all()
    return [to_platform_read(i) for i in initiatives]


@router.post("", response_model=PlatformInitiativeRead, status_code=201)
def create_platform_initiative(
    payload: PlatformInitiativeCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    _get_category_or_404(db, payload.category_id)
    data = payload.model_dump()
    category_id = data.pop("category_id")
    initiative = Initiative(type=InitiativeType.PLATFORM, **data)
    db.add(initiative)
    db.flush()
    db.add(PlatformInitiativeDetail(initiative_id=initiative.id, category_id=category_id))
    db.commit()
    initiative = query_by_type(db, InitiativeType.PLATFORM).filter(Initiative.id == initiative.id).first()
    return to_platform_read(initiative)


def _get_platform_initiative_or_404(db: Session, initiative_id: int) -> Initiative:
    initiative = query_by_type(db, InitiativeType.PLATFORM).filter(Initiative.id == initiative_id).first()
    if initiative is None:
        raise HTTPException(status_code=404, detail="Platform initiative not found")
    return initiative


@router.get("/{initiative_id}", response_model=PlatformInitiativeRead)
def get_platform_initiative(initiative_id: int, db: Session = Depends(get_db)):
    return to_platform_read(_get_platform_initiative_or_404(db, initiative_id))


@router.patch("/{initiative_id}", response_model=PlatformInitiativeRead)
def update_platform_initiative(
    initiative_id: int,
    payload: PlatformInitiativeUpdate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    initiative = _get_platform_initiative_or_404(db, initiative_id)
    data = payload.model_dump(exclude_unset=True)
    category_id = data.pop("category_id", None)
    if category_id is not None:
        _get_category_or_404(db, category_id)
        initiative.platform_detail.category_id = category_id
    for field, value in data.items():
        setattr(initiative, field, value)
    db.commit()
    db.refresh(initiative)
    return to_platform_read(initiative)


@router.delete("/{initiative_id}", status_code=204)
def delete_platform_initiative(
    initiative_id: int,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    initiative = _get_platform_initiative_or_404(db, initiative_id)
    db.delete(initiative)
    db.commit()


@router.post("/{initiative_id}/opt-in", status_code=204)
def opt_in_platform_initiative(
    initiative_id: int,
    payload: OptInRequest,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    _get_platform_initiative_or_404(db, initiative_id)
    engineer_id = payload.engineer_id if payload.engineer_id is not None else actor.engineer_id
    if engineer_id is None:
        raise HTTPException(status_code=400, detail="engineer_id is required")
    if db.get(Engineer, engineer_id) is None:
        raise HTTPException(status_code=404, detail="Engineer not found")
    _opt_in(db, initiative_id, engineer_id)


@router.delete("/{initiative_id}/opt-in", status_code=204)
def opt_out_platform_initiative(
    initiative_id: int,
    payload: OptInRequest,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    _get_platform_initiative_or_404(db, initiative_id)
    engineer_id = payload.engineer_id if payload.engineer_id is not None else actor.engineer_id
    if engineer_id is None:
        raise HTTPException(status_code=400, detail="engineer_id is required")
    _opt_out(db, initiative_id, engineer_id)


@router.post("/{initiative_id}/tasks/generate-ai-breakdown", response_model=list[TaskRead], status_code=201)
def generate_platform_initiative_breakdown(
    initiative_id: int,
    payload: GenerateBreakdownRequest,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    initiative = _get_platform_initiative_or_404(db, initiative_id)
    owner_id = payload.default_owner_engineer_id if payload.default_owner_engineer_id is not None else actor.engineer_id
    if owner_id is None:
        raise HTTPException(status_code=400, detail="default_owner_engineer_id is required")
    if db.get(Engineer, owner_id) is None:
        raise HTTPException(status_code=404, detail="default_owner_engineer_id does not reference a known engineer")
    try:
        return generate_and_persist_breakdown(
            db, initiative, owner_id, category_name=initiative.platform_detail.category.name
        )
    except AiBreakdownError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
