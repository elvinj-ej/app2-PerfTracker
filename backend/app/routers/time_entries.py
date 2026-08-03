from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth_context import Actor, get_current_actor
from app.database import get_db
from app.models import Task, TimeEntry
from app.schemas.time_entry import TimeEntryRead, TimeEntryUpsert
from app.services.fiscal_year import fiscal_year_label, week_start

router = APIRouter(tags=["time-entries"])


def _resolve_engineer_id(actor: Actor, payload_engineer_id: int | None) -> int:
    engineer_id = payload_engineer_id if actor.role == "manager" else actor.engineer_id
    if engineer_id is None:
        raise HTTPException(status_code=400, detail="engineer_id is required (manager submitting on behalf of an engineer)")
    return engineer_id


@router.get("/api/time-entries", response_model=list[TimeEntryRead])
def list_time_entries(
    engineer_id: int | None = Query(None),
    task_id: int | None = Query(None),
    fiscal_year_label: str | None = Query(None, alias="fiscal_year_label"),
    db: Session = Depends(get_db),
):
    query = db.query(TimeEntry)
    if engineer_id is not None:
        query = query.filter(TimeEntry.engineer_id == engineer_id)
    if task_id is not None:
        query = query.filter(TimeEntry.task_id == task_id)
    if fiscal_year_label is not None:
        query = query.filter(TimeEntry.fiscal_year_label == fiscal_year_label)
    return query.order_by(TimeEntry.week_start_date).all()


@router.post("/api/time-entries", response_model=TimeEntryRead, status_code=200)
def upsert_time_entry(
    payload: TimeEntryUpsert,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    task = db.get(Task, payload.task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    engineer_id = _resolve_engineer_id(actor, payload.engineer_id)
    if engineer_id != task.owner_engineer_id:
        raise HTTPException(status_code=400, detail="Only the task's owning engineer may log time against it")

    week = week_start(payload.week_start_date)
    entry = (
        db.query(TimeEntry)
        .filter(TimeEntry.task_id == task.id, TimeEntry.week_start_date == week)
        .first()
    )
    if entry is None:
        entry = TimeEntry(
            task_id=task.id,
            engineer_id=engineer_id,
            week_start_date=week,
            fiscal_year_label=fiscal_year_label(week),
            hours=payload.hours,
            notes=payload.notes,
        )
        db.add(entry)
    else:
        entry.hours = payload.hours
        entry.notes = payload.notes

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/api/time-entries/{entry_id}", status_code=204)
def delete_time_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(TimeEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Time entry not found")
    db.delete(entry)
    db.commit()


@router.get("/api/engineers/{engineer_id}/time-entries/week/{week_start_date}", response_model=list[TimeEntryRead])
def get_engineer_week(engineer_id: int, week_start_date: date, db: Session = Depends(get_db)):
    week = week_start(week_start_date)
    return (
        db.query(TimeEntry)
        .filter(TimeEntry.engineer_id == engineer_id, TimeEntry.week_start_date == week)
        .all()
    )
