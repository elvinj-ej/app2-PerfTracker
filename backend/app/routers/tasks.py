from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Engineer, Initiative, Task
from app.schemas.task import TaskCreate, TaskRead, TaskReorderRequest, TaskUpdate
from app.services.outcome_dates import OutcomeDateError, validate_delivery_span, validate_within_ask_timeline

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


def _validate_owner(db: Session, owner_engineer_id: int | None) -> None:
    if owner_engineer_id is not None and db.get(Engineer, owner_engineer_id) is None:
        raise HTTPException(status_code=400, detail="owner_engineer_id does not reference a known engineer")


def _validate_dates(start_date, delivery_date, initiative: Initiative | None = None) -> None:
    try:
        validate_delivery_span(start_date, delivery_date)
        if initiative is not None:
            validate_within_ask_timeline(
                start_date, delivery_date, initiative.start_date, initiative.expected_delivery_date
            )
    except OutcomeDateError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/initiatives/{initiative_id}/tasks", response_model=list[TaskRead])
def list_tasks(initiative_id: int, db: Session = Depends(get_db)):
    _get_initiative_or_404(db, initiative_id)
    return db.query(Task).filter(Task.initiative_id == initiative_id).order_by(Task.sequence_order).all()


@router.post("/api/initiatives/{initiative_id}/tasks", response_model=TaskRead, status_code=201)
def create_task(initiative_id: int, payload: TaskCreate, db: Session = Depends(get_db)):
    initiative = _get_initiative_or_404(db, initiative_id)
    _validate_owner(db, payload.owner_engineer_id)
    _validate_dates(payload.start_date, payload.delivery_date, initiative)
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
    _validate_dates(
        data.get("start_date", task.start_date),
        data.get("delivery_date", task.delivery_date),
        db.get(Initiative, task.initiative_id),
    )
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
