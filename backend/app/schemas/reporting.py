from datetime import date

from pydantic import BaseModel

from app.models.enums import InitiativeType, TaskStage, TaskStatus
from app.services.completion import TimelineHealth


class InitiativeSummary(BaseModel):
    id: int
    type: InitiativeType
    title: str
    status: str
    category_name: str | None = None
    start_date: date | None = None
    expected_delivery_date: date | None = None
    completion_pct: float | None
    expected_pct: float | None
    timeline_health: TimelineHealth
    total_hours_logged: float


class TaskSummary(BaseModel):
    id: int
    initiative_id: int
    initiative_title: str
    initiative_type: InitiativeType
    title: str
    stage: TaskStage | None
    status: TaskStatus
    forecast_duration_days: float | None
    actual_hours_logged: float


class WeeklyHours(BaseModel):
    week_start_date: date
    fiscal_year_label: str
    initiative_type: InitiativeType
    hours: float


class EngineerDashboard(BaseModel):
    engineer_id: int
    engineer_name: str
    kbis: list[InitiativeSummary]
    platform_initiatives: list[InitiativeSummary]
    recurring_ops: list[InitiativeSummary]
    tasks: list[TaskSummary]
    weekly_hours: list[WeeklyHours]


class CategoryHours(BaseModel):
    initiative_type: InitiativeType
    hours: float


class EngineerHoursBreakdown(BaseModel):
    engineer_id: int
    engineer_name: str
    hours_by_type: dict[InitiativeType, float]
    total_hours: float


class TeamSummary(BaseModel):
    kbis: list[InitiativeSummary]
    platform_initiatives: list[InitiativeSummary]
    recurring_ops: list[InitiativeSummary]
    hours_by_category: list[CategoryHours]
    hours_by_engineer: list[EngineerHoursBreakdown]


class MonthlyTaskDetail(BaseModel):
    id: int
    initiative_id: int
    title: str
    stage: TaskStage | None
    owner_engineer_id: int
    owner_engineer_name: str
    forecast_duration_days: float | None
    status: TaskStatus
    hours_this_month: float


class MonthlyInitiativeReport(BaseModel):
    id: int
    type: InitiativeType
    title: str
    category_name: str | None = None
    status: str
    completion_pct: float | None
    expected_delivery_date: date | None = None
    tasks: list[MonthlyTaskDetail]
    total_hours_this_month: float


class MonthlyReport(BaseModel):
    month: str
    kbis: list[MonthlyInitiativeReport]
    platform_initiatives: list[MonthlyInitiativeReport]
    recurring_ops: list[MonthlyInitiativeReport]
