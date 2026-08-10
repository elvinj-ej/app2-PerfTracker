from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_context import Actor, get_current_actor, require_manager
from app.database import get_db
from app.models import KbiCategory
from app.schemas.kbi_category import KbiCategoryCreate, KbiCategoryRead, KbiCategoryUpdate

router = APIRouter(prefix="/api/kbi-categories", tags=["kbi-categories"])


@router.get("", response_model=list[KbiCategoryRead])
def list_categories(db: Session = Depends(get_db)):
    return db.query(KbiCategory).order_by(KbiCategory.sort_order).all()


@router.post("", response_model=KbiCategoryRead, status_code=201)
def create_category(
    payload: KbiCategoryCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    category = KbiCategory(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=KbiCategoryRead)
def update_category(
    category_id: int,
    payload: KbiCategoryUpdate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    require_manager(actor)
    category = db.get(KbiCategory, category_id)
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
    category = db.get(KbiCategory, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(category)
    db.commit()
