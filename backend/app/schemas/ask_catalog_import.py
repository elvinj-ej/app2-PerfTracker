from datetime import date
from typing import Literal

from pydantic import BaseModel

from app.models.enums import InitiativeType, Priority, RecurrenceType


class AskCatalogRowPreview(BaseModel):
    row_number: int
    category: str
    ask: str
    by_date: str | None
    initiative_type: InitiativeType | None
    priority: Priority
    recurrence_type: RecurrenceType | None
    expected_delivery_date: date | None
    note: str | None
    outcomes: list[str]
    warnings: list[str]


class AskCatalogPreviewResponse(BaseModel):
    rows: list[AskCatalogRowPreview]
    run_count: int
    platform_count: int
    business_count: int
    skipped_count: int
    total_outcomes: int


AskCatalogImportMode = Literal["overwrite", "add"]


class AskCatalogCommitResult(BaseModel):
    mode: AskCatalogImportMode
    run_count: int
    platform_count: int
    business_count: int
    outcomes_created: int
    categories_created: int
    skipped_existing_asks: list[str]
    skipped_unclassified_rows: int
