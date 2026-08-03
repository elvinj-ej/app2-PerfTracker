from datetime import date

from pydantic import BaseModel

from app.models.enums import Priority


class JiraImportPreview(BaseModel):
    jira_number: str | None
    title: str
    description: str | None
    business_goal: str | None
    start_date: date | None
    expected_delivery_date: date | None
    priority: Priority | None
    suggested_status: str
    skipped_linked_issues: int
