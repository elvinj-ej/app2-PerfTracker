from datetime import date

from pydantic import BaseModel, ConfigDict


class TimeEntryUpsert(BaseModel):
    task_id: int
    week_start_date: date
    hours: float
    notes: str | None = None
    engineer_id: int | None = None  # only honored when the actor is a manager acting on an engineer's behalf


class TimeEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    engineer_id: int
    week_start_date: date
    fiscal_year_label: str
    hours: float
    notes: str | None
