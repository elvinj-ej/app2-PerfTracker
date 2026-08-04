from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.enums import TaskStage, TaskStatus


class TaskBase(BaseModel):
    title: str
    description: str | None = None
    stage: TaskStage | None = None
    owner_engineer_id: int
    forecast_duration_days: float | None = None
    start_date: date | None = None
    delivery_date: date | None = None
    status: TaskStatus = TaskStatus.NOT_STARTED


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    stage: TaskStage | None = None
    owner_engineer_id: int | None = None
    forecast_duration_days: float | None = None
    start_date: date | None = None
    delivery_date: date | None = None
    status: TaskStatus | None = None


class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    initiative_id: int
    sequence_order: int
    is_ai_generated: bool


class TaskReorderRequest(BaseModel):
    task_ids_in_order: list[int]
