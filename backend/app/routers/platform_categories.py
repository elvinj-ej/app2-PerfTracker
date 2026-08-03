from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_context import Actor, get_current_actor, require_manager
from app.database import get_db
from app.models import PlatformInitiativeCategory
from app.schemas.platform_category import (
    PlatformInitiativeCategoryCreate,
    PlatformInitiativeCategoryRead,
    PlatformInitiativeCategoryUpdate,
)

router = APIRouter(prefix="/api/platform-initiative-categories", tags=["platform-initiative-categories"])


@router.get("", response_model=list[PlatformInitiativeCategoryRead])
def list_categories(db: Session = Depends(get_db)):
    return db.query(PlatformInitiativeCategory).order_by(PlatformInitiativeCategory.sort_order).all()


@router.post("", response_model=PlatformInitiativeCategoryRead, status_code=201)
def create_category(
    payload: PlatformInitiativeCategoryCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    category = PlatformInitiativeCategory(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=PlatformInitiativeCategoryRead)
def update_category(
    category_id: int,
    payload: PlatformInitiativeCategoryUpdate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    category = db.get(PlatformInitiativeCategory, category_id)
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
    category = db.get(PlatformInitiativeCategory, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(category)
    db.commit()
