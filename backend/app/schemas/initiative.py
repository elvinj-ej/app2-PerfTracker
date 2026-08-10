from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.enums import (
    Complexity,
    InitiativeStatus,
    InitiativeType,
    Priority,
    RecurrenceType,
)
from app.schemas.kbi_category import KbiCategoryRead
from app.schemas.platform_category import PlatformInitiativeCategoryRead
from app.schemas.recurring_ops_category import RecurringOpsCategoryRead


class InitiativeBase(BaseModel):
    title: str
    description: str | None = None
    business_goal: str | None = None
    jira_number: str | None = None
    start_date: date | None = None
    expected_delivery_date: date | None = None
    priority: Priority | None = None
    complexity: Complexity | None = None
    status: InitiativeStatus = InitiativeStatus.DRAFT


class InitiativeUpdateBase(BaseModel):
    title: str | None = None
    description: str | None = None
    business_goal: str | None = None
    jira_number: str | None = None
    start_date: date | None = None
    expected_delivery_date: date | None = None
    priority: Priority | None = None
    complexity: Complexity | None = None
    status: InitiativeStatus | None = None


# --- KBI ---


class KbiCreate(InitiativeBase):
    ask: str | None = None
    category_id: int


class KbiUpdate(InitiativeUpdateBase):
    ask: str | None = None
    category_id: int | None = None


class KbiRead(InitiativeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: InitiativeType
    ask: str | None = None
    category: KbiCategoryRead
    engineer_ids: list[int] = []


# --- Platform Initiative ---


class PlatformInitiativeCreate(InitiativeBase):
    category_id: int


class PlatformInitiativeUpdate(InitiativeUpdateBase):
    category_id: int | None = None


class PlatformInitiativeRead(InitiativeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: InitiativeType
    category: PlatformInitiativeCategoryRead
    engineer_ids: list[int] = []


# --- Recurring Ops ---


class RecurringOpsBase(BaseModel):
    title: str
    description: str | None = None
    status: InitiativeStatus = InitiativeStatus.OPEN
    priority: Priority | None = None
    category_id: int
    recurrence_type: RecurrenceType
    recurrence_interval: int = 1
    anchor_month: int | None = None
    anchor_day: int | None = None


class RecurringOpsCreate(RecurringOpsBase):
    pass


class RecurringOpsUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: InitiativeStatus | None = None
    priority: Priority | None = None
    category_id: int | None = None
    recurrence_type: RecurrenceType | None = None
    recurrence_interval: int | None = None
    anchor_month: int | None = None
    anchor_day: int | None = None


class RecurringOpsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: InitiativeType
    title: str
    description: str | None
    status: InitiativeStatus
    priority: Priority | None
    category: RecurringOpsCategoryRead
    recurrence_type: RecurrenceType
    recurrence_interval: int
    anchor_month: int | None
    anchor_day: int | None
    engineer_ids: list[int] = []
