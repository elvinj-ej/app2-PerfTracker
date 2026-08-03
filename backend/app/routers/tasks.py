from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Engineer, Initiative, Task
from app.schemas.task import TaskCreate, TaskRead, TaskReorderRequest, TaskUpdate

router = APIRouter(tags=["tasks"])


def _get_initiative_or_404(db: Session, initiative_id: int) -> Initiative:
    initiative = db.get(Initiative, initiative_id)
    if initiative is None:
        raise HTTPException(status_code=404, detail="Initiative not found")
    return initiative


def _get_task_or_404(db: Session, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _validate_owner(db: Session, owner_engineer_id: int) -> None:
    if db.get(Engineer, owner_engineer_id) is None:
        raise HTTPException(status_code=400, detail="owner_engineer_id does not reference a known engineer")


@router.get("/api/initiatives/{initiative_id}/tasks", response_model=list[TaskRead])
def list_tasks(initiative_id: int, db: Session = Depends(get_db)):
    _get_initiative_or_404(db, initiative_id)
    return db.query(Task).filter(Task.initiative_id == initiative_id).order_by(Task.sequence_order).all()


@router.post("/api/initiatives/{initiative_id}/tasks", response_model=TaskRead, status_code=201)
def create_task(initiative_id: int, payload: TaskCreate, db: Session = Depends(get_db)):
    _get_initiative_or_404(db, initiative_id)
    _validate_owner(db, payload.owner_engineer_id)
    max_order = (
        db.query(Task.sequence_order).filter(Task.initiative_id == initiative_id).order_by(Task.sequence_order.desc()).first()
    )
    next_order = (max_order[0] + 1) if max_order else 0
    task = Task(initiative_id=initiative_id, sequence_order=next_order, **payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/api/tasks/{task_id}", response_model=TaskRead)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = _get_task_or_404(db, task_id)
    data = payload.model_dump(exclude_unset=True)
    if "owner_engineer_id" in data:
        _validate_owner(db, data["owner_engineer_id"])
    for field, value in data.items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = _get_task_or_404(db, task_id)
    db.delete(task)
    db.commit()


@router.post("/api/initiatives/{initiative_id}/tasks/reorder", response_model=list[TaskRead])
def reorder_tasks(initiative_id: int, payload: TaskReorderRequest, db: Session = Depends(get_db)):
    _get_initiative_or_404(db, initiative_id)
    tasks = db.query(Task).filter(Task.initiative_id == initiative_id).all()
    tasks_by_id = {t.id: t for t in tasks}

    if set(payload.task_ids_in_order) != set(tasks_by_id.keys()):
        raise HTTPException(
            status_code=400,
            detail="task_ids_in_order must contain exactly the current tasks for this initiative",
        )

    for order, task_id in enumerate(payload.task_ids_in_order):
        tasks_by_id[task_id].sequence_order = order
    db.commit()

    return db.query(Task).filter(Task.initiative_id == initiative_id).order_by(Task.sequence_order).all()
