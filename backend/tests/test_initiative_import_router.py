import pytest
from fastapi import HTTPException

from app.core.auth_context import Actor
from app.routers.initiative_import import preview_jira_issue
from app.schemas.jira_import import JiraIssueLookup
from app.services.jira_api_client import JiraIssueKind

MANAGER = Actor(role="manager", engineer_id=None)
ENGINEER = Actor(role="engineer", engineer_id=1)

FAKE_RESPONSE = {
    "key": "IHT-14715",
    "fields": {
        "summary": "Establish AWS Platform CoE",
        "description": None,
        "issuetype": {"name": "Initiative"},
        "status": {"name": "Open", "statusCategory": {"key": "new"}},
        "priority": None,
        "issuelinks": [],
    },
    "names": {},
}


def test_preview_jira_issue_requires_manager():
    with pytest.raises(HTTPException) as exc_info:
        preview_jira_issue(JiraIssueLookup(issue="IHT-14715"), x_jira_token="tok", actor=ENGINEER)
    assert exc_info.value.status_code == 403


def test_preview_jira_issue_returns_classified_preview(monkeypatch):
    monkeypatch.setattr("app.routers.initiative_import.fetch_issue", lambda base_url, token, key: FAKE_RESPONSE)

    result = preview_jira_issue(JiraIssueLookup(issue="https://cltd-jira.cochlear.com/browse/IHT-14715"), x_jira_token="tok", actor=MANAGER)

    assert result.kind == JiraIssueKind.INITIATIVE
    assert result.jira_number == "IHT-14715"
    assert result.title == "Establish AWS Platform CoE"


def test_preview_jira_issue_wraps_fetch_errors_as_400(monkeypatch):
    from app.services.jira_api_client import JiraImportError

    def boom(base_url, token, key):
        raise JiraImportError("Jira rejected this token")

    monkeypatch.setattr("app.routers.initiative_import.fetch_issue", boom)

    with pytest.raises(HTTPException) as exc_info:
        preview_jira_issue(JiraIssueLookup(issue="IHT-14715"), x_jira_token="bad", actor=MANAGER)
    assert exc_info.value.status_code == 400
