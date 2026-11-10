from datetime import date

from pydantic import BaseModel

from app.models.enums import Priority, TaskStatus
from app.services.jira_api_client import JiraIssueKind


class JiraIssueLookup(BaseModel):
    issue: str


class JiraIssuePreview(BaseModel):
    kind: JiraIssueKind
    jira_number: str
    issue_type: str
    title: str
    description: str | None
    business_goal: str | None
    start_date: date | None
    expected_delivery_date: date | None
    priority: Priority | None
    suggested_status: str | None
    suggested_task_status: TaskStatus | None
    skipped_linked_issues: int
