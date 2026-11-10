import httpx
import pytest

from app.models.enums import Priority, TaskStatus
from app.services.jira_api_client import (
    JiraImportError,
    JiraIssueKind,
    extract_issue_key,
    fetch_issue,
    parse_jira_issue,
)

# A trimmed-down version of a real response from a Cochlear Jira Server/DC instance
# (issue IHT-14715), keeping only the fields parse_jira_issue actually reads plus
# enough of `names` to resolve them by label - the real response has ~900 mostly-null
# custom fields from a shared company-wide Jira, which parse_jira_issue is specifically
# designed to ignore.
REAL_INITIATIVE_RESPONSE = {
    "key": "IHT-14715",
    "fields": {
        "summary": "Establish AWS Platform Centre of Excellence (CoE)",
        "description": (
            "Cochlear operates a distributed DevOps model.\n\n"
            "*Out of Scope* *\n"
            " * Application architecture ownership\n"
            " * Application delivery and deployment\n\n"
            "*Cadence :*\n\nMonthly meeting"
        ),
        "issuetype": {"name": "Initiative"},
        "status": {"name": "Define - In Progress", "statusCategory": {"key": "indeterminate", "name": "In Progress"}},
        "priority": {"name": "Should Have"},
        "project": {"key": "IHT", "name": "Hosting, Platforms & Databases"},
        "issuelinks": [],
        "customfield_16182": None,
        "customfield_16183": "2027-06-30",
        "customfield_16007": "Establish a formal AWS Platform CoE responsible for AWS platform governance.",
        "customfield_16008": "Cochlear's distributed DevOps teams require a consistent AWS platform foundation.",
    },
    "names": {
        "customfield_16182": "Target start",
        "customfield_16183": "Target end",
        "customfield_16007": "Purpose",
        "customfield_16008": "Opportunity",
    },
}

EPIC_RESPONSE = {
    "key": "IHT-20001",
    "fields": {
        "summary": "Migrate billing service to AWS",
        "description": "Move the legacy billing service off-prem.",
        "issuetype": {"name": "Epic"},
        "status": {"name": "In Progress", "statusCategory": {"key": "indeterminate"}},
        "priority": {"name": "Must Have"},
        "issuelinks": [{"type": {"name": "Blocks"}}],
        "customfield_16182": "2026-08-01",
        "customfield_16183": "2026-09-01",
    },
    "names": {"customfield_16182": "Target start", "customfield_16183": "Target end"},
}

BUG_RESPONSE = {
    "key": "IHT-99999",
    "fields": {
        "summary": "Login page throws 500",
        "description": None,
        "issuetype": {"name": "Bug"},
        "status": {"name": "Open", "statusCategory": {"key": "new"}},
        "priority": None,
        "issuelinks": [],
    },
    "names": {},
}


def test_parse_jira_issue_classifies_initiative():
    parsed = parse_jira_issue(REAL_INITIATIVE_RESPONSE)
    assert parsed.kind == JiraIssueKind.INITIATIVE
    assert parsed.jira_number == "IHT-14715"
    assert parsed.title == "Establish AWS Platform Centre of Excellence (CoE)"
    assert parsed.expected_delivery_date.isoformat() == "2027-06-30"
    assert parsed.start_date is None
    assert parsed.priority == Priority.HIGH  # "Should Have" -> HIGH
    assert parsed.suggested_status == "IN_PROGRESS"  # statusCategory "indeterminate"
    assert parsed.suggested_task_status is None
    assert "Establish a formal AWS Platform CoE" in parsed.business_goal


def test_parse_jira_issue_strips_wiki_markup_from_description():
    parsed = parse_jira_issue(REAL_INITIATIVE_RESPONSE)
    assert "*Out of Scope*" not in parsed.description
    assert "Out of Scope" in parsed.description
    assert "- Application architecture ownership" in parsed.description


def test_parse_jira_issue_classifies_epic_as_outcome():
    parsed = parse_jira_issue(EPIC_RESPONSE)
    assert parsed.kind == JiraIssueKind.OUTCOME
    assert parsed.priority == Priority.CRITICAL  # "Must Have" -> CRITICAL
    assert parsed.suggested_task_status == TaskStatus.IN_PROGRESS
    assert parsed.suggested_status is None
    assert parsed.skipped_linked_issues == 1


def test_parse_jira_issue_classifies_bug_as_unsupported():
    parsed = parse_jira_issue(BUG_RESPONSE)
    assert parsed.kind == JiraIssueKind.UNSUPPORTED
    assert parsed.suggested_status is None
    assert parsed.suggested_task_status is None


def test_extract_issue_key_from_bare_key():
    assert extract_issue_key("IHT-14715") == "IHT-14715"


def test_extract_issue_key_from_url():
    assert extract_issue_key("https://cltd-jira.cochlear.com/browse/IHT-14715") == "IHT-14715"


def test_extract_issue_key_rejects_garbage():
    with pytest.raises(JiraImportError):
        extract_issue_key("not a jira key")


def _mock_get(handler):
    """fetch_issue passes trust_env (a Client-constructor-only kwarg) to httpx.get(),
    which httpx's top-level function accepts but Client.get() does not - drop it before
    replaying the call against a MockTransport-backed Client."""

    def fake_get(url, **kw):
        kw.pop("trust_env", None)
        return httpx.Client(transport=httpx.MockTransport(handler)).get(url, **kw)

    return fake_get


def test_fetch_issue_success(monkeypatch):
    def handler(request):
        assert request.headers["Authorization"] == "Bearer secret-token"
        return httpx.Response(200, json=REAL_INITIATIVE_RESPONSE, headers={"content-type": "application/json"})

    monkeypatch.setattr(httpx, "get", _mock_get(handler))
    result = fetch_issue("https://cltd-jira.cochlear.com", "secret-token", "IHT-14715")
    assert result["key"] == "IHT-14715"


def test_fetch_issue_401_raises_clear_error(monkeypatch):
    def handler(request):
        return httpx.Response(401, json={"error": "unauthorized"}, headers={"content-type": "application/json"})

    monkeypatch.setattr(httpx, "get", _mock_get(handler))
    with pytest.raises(JiraImportError, match="rejected this token"):
        fetch_issue("https://cltd-jira.cochlear.com", "bad-token", "IHT-14715")


def test_fetch_issue_404_raises_clear_error(monkeypatch):
    def handler(request):
        return httpx.Response(404, json={}, headers={"content-type": "application/json"})

    monkeypatch.setattr(httpx, "get", _mock_get(handler))
    with pytest.raises(JiraImportError, match="wasn't found"):
        fetch_issue("https://cltd-jira.cochlear.com", "token", "IHT-00000")


def test_fetch_issue_html_response_treated_as_auth_failure(monkeypatch):
    def handler(request):
        return httpx.Response(200, text="<html>login</html>", headers={"content-type": "text/html"})

    monkeypatch.setattr(httpx, "get", _mock_get(handler))
    with pytest.raises(JiraImportError, match="didn't return JSON"):
        fetch_issue("https://cltd-jira.cochlear.com", "token", "IHT-14715")


def test_fetch_issue_requires_base_url():
    with pytest.raises(JiraImportError, match="not configured"):
        fetch_issue("", "token", "IHT-14715")
