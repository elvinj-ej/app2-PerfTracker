from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_context import Actor, get_current_actor, require_manager
from app.database import get_db
from app.models import RecurringOpsCategory
from app.schemas.recurring_ops_category import (
    RecurringOpsCategoryCreate,
    RecurringOpsCategoryRead,
    RecurringOpsCategoryUpdate,
)

router = APIRouter(prefix="/api/recurring-ops-categories", tags=["recurring-ops-categories"])


@router.get("", response_model=list[RecurringOpsCategoryRead])
def list_categories(db: Session = Depends(get_db)):
    return db.query(RecurringOpsCategory).order_by(RecurringOpsCategory.sort_order).all()


@router.post("", response_model=RecurringOpsCategoryRead, status_code=201)
def create_category(
    payload: RecurringOpsCategoryCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    category = RecurringOpsCategory(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=RecurringOpsCategoryRead)
def update_category(
    category_id: int,
    payload: RecurringOpsCategoryUpdate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    category = db.get(RecurringOpsCategory, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    category = db.get(RecurringOpsCategory, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(category)
    db.commit()
