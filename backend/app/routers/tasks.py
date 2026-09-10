from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Engineer, Initiative, Task
from app.models.enums import TaskStatus
from app.schemas.task import TaskCreate, TaskRead, TaskReorderRequest, TaskUpdate
from app.services.sprint import MAX_FORECAST_DAYS, max_sprint_number, sprint_bounds

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


def _validate_forecast(forecast_duration_days: float | None) -> None:
    if forecast_duration_days is not None and not (0 < forecast_duration_days <= MAX_FORECAST_DAYS):
        raise HTTPException(
            status_code=400,
            detail=f"forecast_duration_days must be between 0 and {MAX_FORECAST_DAYS} (the sprint's working days)",
        )


def _resolve_sprint(sprint_number: int | None) -> tuple[int | None, object | None, object | None]:
    if sprint_number is None:
        return None, None, None
    if not (1 <= sprint_number <= max_sprint_number()):
        raise HTTPException(
            status_code=400, detail=f"sprint_number must be between 1 and {max_sprint_number()}"
        )
    start, end = sprint_bounds(sprint_number)
    return sprint_number, start, end


@router.get("/api/initiatives/{initiative_id}/tasks", response_model=list[TaskRead])
def list_tasks(initiative_id: int, db: Session = Depends(get_db)):
    _get_initiative_or_404(db, initiative_id)
    return db.query(Task).filter(Task.initiative_id == initiative_id).order_by(Task.sequence_order).all()


@router.post("/api/initiatives/{initiative_id}/tasks", response_model=TaskRead, status_code=201)
def create_task(initiative_id: int, payload: TaskCreate, db: Session = Depends(get_db)):
    _get_initiative_or_404(db, initiative_id)
    _validate_owner(db, payload.owner_engineer_id)
    _validate_forecast(payload.forecast_duration_days)
    sprint_number, start_date, delivery_date = _resolve_sprint(payload.sprint_number)
    max_order = (
        db.query(Task.sequence_order).filter(Task.initiative_id == initiative_id).order_by(Task.sequence_order.desc()).first()
    )
    next_order = (max_order[0] + 1) if max_order else 0
    data = payload.model_dump(exclude={"sprint_number"})
    task = Task(
        initiative_id=initiative_id,
        sequence_order=next_order,
        sprint_number=sprint_number,
        start_date=start_date,
        delivery_date=delivery_date,
        **data,
    )
    if task.status == TaskStatus.COMPLETE:
        task.completed_at = datetime.now()
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
    if "forecast_duration_days" in data:
        _validate_forecast(data["forecast_duration_days"])
    if "sprint_number" in data:
        sprint_number, start_date, delivery_date = _resolve_sprint(data.pop("sprint_number"))
        data["sprint_number"] = sprint_number
        data["start_date"] = start_date
        data["delivery_date"] = delivery_date
    if "status" in data:
        if data["status"] == TaskStatus.COMPLETE and task.status != TaskStatus.COMPLETE:
            data["completed_at"] = datetime.now()
        elif data["status"] != TaskStatus.COMPLETE and task.status == TaskStatus.COMPLETE:
            data["completed_at"] = None
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
