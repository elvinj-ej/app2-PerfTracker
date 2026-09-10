from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import TaskStage, TaskStatus


class TaskBase(BaseModel):
    title: str
    description: str | None = None
    stage: TaskStage | None = None
    owner_engineer_id: int | None = None
    forecast_duration_days: float | None = None
    # Delivery scheduling is sprint-only: engineers/managers pick a sprint number
    # (Sx), never a raw date - start_date/delivery_date are derived server-side
    # from it and only ever appear as read-only output (see TaskRead).
    sprint_number: int | None = None
    status: TaskStatus = TaskStatus.NOT_STARTED


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    stage: TaskStage | None = None
    owner_engineer_id: int | None = None
    forecast_duration_days: float | None = None
    sprint_number: int | None = None
    status: TaskStatus | None = None


class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    initiative_id: int
    sequence_order: int
    start_date: date | None = None
    delivery_date: date | None = None
    completed_at: datetime | None = None
    is_ai_generated: bool


class TaskReorderRequest(BaseModel):
    task_ids_in_order: list[int]
