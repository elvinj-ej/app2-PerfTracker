"""Live Jira issue lookup for the Import from Jira page, replacing the old XML/Word
single-issue export-then-upload flow entirely: a manager pastes a URL or issue key and
this fetches it directly via Jira's REST API (v2 - this targets Jira Server/Data Center,
not Cloud), using a Personal Access Token the browser supplies per-request and this app
never stores.

Jira returns custom fields keyed by opaque, instance-specific IDs (customfield_12345),
not by name - ?expand=names asks the API to also include an id -> human label map in the
same response, which is what _resolve_field uses to find fields like "Target start" or
"Purpose" without hardcoding IDs that would only be valid on this one Jira instance.
"""

import re
from dataclasses import dataclass
from datetime import date
from enum import Enum
from typing import Any

import httpx

from app.models.enums import Priority, TaskStatus

_ISSUE_TYPE_KIND = {
    "initiative": "INITIATIVE",
    "epic": "OUTCOME",
    "story": "OUTCOME",
}

_INITIATIVE_STATUS_BY_CATEGORY = {"new": "OPEN", "indeterminate": "IN_PROGRESS", "done": "COMPLETED"}
_TASK_STATUS_BY_CATEGORY = {
    "new": TaskStatus.NOT_STARTED,
    "indeterminate": TaskStatus.IN_PROGRESS,
    "done": TaskStatus.COMPLETE,
}

# Same MoSCoW mapping the old file-based export importers used - Jira's
# priority scheme on this instance doesn't line up with Low/Medium/High/Critical
# one-to-one, but this is a reasonable, documented approximation.
_MOSCOW_PRIORITY_MAP = {
    "must have": Priority.CRITICAL,
    "should have": Priority.HIGH,
    "could have": Priority.MEDIUM,
    "won't have": Priority.LOW,
    "will not have": Priority.LOW,
}

_BOLD_RE = re.compile(r"\*(\S(?:[^\n*]*\S)?)\*")
_COLOR_RE = re.compile(r"\{color[^}]*\}")
_HEADER_RE = re.compile(r"^h[1-6]\.\s*", re.MULTILINE)
_BULLET_RE = re.compile(r"^[ \t]*\*[ \t]+", re.MULTILINE)
_BLANK_LINES_RE = re.compile(r"\n{3,}")

_ISSUE_KEY_RE = re.compile(r"([A-Za-z][A-Za-z0-9]*-\d+)")


class JiraImportError(ValueError):
    pass


class JiraIssueKind(str, Enum):
    INITIATIVE = "INITIATIVE"
    OUTCOME = "OUTCOME"
    UNSUPPORTED = "UNSUPPORTED"


@dataclass
class ParsedJiraIssue:
    kind: JiraIssueKind
    jira_number: str
    issue_type: str
    title: str
    description: str | None
    business_goal: str | None
    start_date: date | None
    expected_delivery_date: date | None
    priority: Priority | None
    suggested_status: str | None  # for INITIATIVE
    suggested_task_status: TaskStatus | None  # for OUTCOME
    skipped_linked_issues: int = 0


def extract_issue_key(text: str) -> str:
    """Pulls an issue key ("IHT-14715") out of either a raw key or a pasted
    .../browse/IHT-14715 URL - whichever the user types in."""
    match = _ISSUE_KEY_RE.search(text.strip())
    if not match:
        raise JiraImportError(f"Couldn't find a Jira issue key in {text!r}")
    return match.group(1).upper()


def _strip_jira_markup(text: str | None) -> str | None:
    if not text:
        return None
    cleaned = _COLOR_RE.sub("", text)
    cleaned = _BOLD_RE.sub(r"\1", cleaned)
    cleaned = _HEADER_RE.sub("", cleaned)
    cleaned = _BULLET_RE.sub("- ", cleaned)
    lines = [line.rstrip() for line in cleaned.splitlines()]
    cleaned = "\n".join(lines).strip()
    cleaned = _BLANK_LINES_RE.sub("\n\n", cleaned)
    return cleaned or None


def _resolve_field(fields: dict[str, Any], names: dict[str, str], *field_names: str) -> Any:
    wanted = {name.lower() for name in field_names}
    for field_id, label in names.items():
        if label.lower() not in wanted:
            continue
        value = fields.get(field_id)
        if value not in (None, "", []):
            return value
    return None


def _as_text(value: Any) -> str | None:
    """Jira select-list custom fields come back as {"value": "..."} objects rather
    than plain strings - unwrap that shape if present."""
    if value is None:
        return None
    if isinstance(value, dict):
        return value.get("value")
    return str(value)


def _parse_field_date(value: Any) -> date | None:
    text = _as_text(value)
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def fetch_issue(base_url: str, token: str, issue_key: str) -> dict[str, Any]:
    if not base_url:
        raise JiraImportError("JIRA_BASE_URL is not configured on the server - ask your admin to set it")
    url = f"{base_url.rstrip('/')}/rest/api/2/issue/{issue_key}"
    try:
        response = httpx.get(
            url,
            params={"expand": "names"},
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                # Some Jira deployments sit behind a WAF/bot-protection layer that blocks
                # scripted HTTP clients by their default User-Agent (e.g. "python-httpx/x")
                # before the request ever reaches Jira itself, typically as a 503. A
                # standard browser User-Agent avoids that false-positive block.
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
                ),
            },
            timeout=15.0,
        )
    except httpx.RequestError as exc:
        raise JiraImportError(f"Couldn't reach Jira at {base_url}: {exc}") from exc

    if response.status_code == 401:
        raise JiraImportError("Jira rejected this token (401) - it may be invalid or expired. Generate a new one.")
    if response.status_code == 404:
        raise JiraImportError(f"Jira issue {issue_key} wasn't found (404) - check the key and try again.")
    if response.status_code != 200:
        raise JiraImportError(f"Jira returned an unexpected status ({response.status_code}) for {issue_key}.")

    content_type = response.headers.get("content-type", "")
    if "json" not in content_type:
        # A login page or SSO redirect comes back as HTML, not JSON - the clearest
        # sign the token wasn't actually accepted even though the status was 200.
        raise JiraImportError(
            "Jira didn't return JSON for this request - the token may not be valid for API access."
        )

    try:
        return response.json()
    except ValueError as exc:
        raise JiraImportError(f"Jira's response couldn't be parsed as JSON: {exc}") from exc


def parse_jira_issue(raw: dict[str, Any]) -> ParsedJiraIssue:
    fields = raw.get("fields") or {}
    names = raw.get("names") or {}

    issue_type_name = ((fields.get("issuetype") or {}).get("name") or "").strip()
    kind = JiraIssueKind(_ISSUE_TYPE_KIND.get(issue_type_name.lower(), "UNSUPPORTED"))

    status_category = (((fields.get("status") or {}).get("statusCategory") or {}).get("key") or "").lower()
    priority_name = ((fields.get("priority") or {}).get("name") or "").strip().lower()

    business_goal_raw = _resolve_field(fields, names, "Purpose") or _resolve_field(fields, names, "Opportunity")
    target_start = _resolve_field(fields, names, "Target start")
    target_end = _resolve_field(fields, names, "Target end")

    return ParsedJiraIssue(
        kind=kind,
        jira_number=raw.get("key") or "",
        issue_type=issue_type_name or "Unknown",
        title=(fields.get("summary") or "Imported Issue").strip(),
        description=_strip_jira_markup(fields.get("description")),
        business_goal=_strip_jira_markup(_as_text(business_goal_raw)),
        start_date=_parse_field_date(target_start),
        expected_delivery_date=_parse_field_date(target_end),
        priority=_MOSCOW_PRIORITY_MAP.get(priority_name),
        suggested_status=_INITIATIVE_STATUS_BY_CATEGORY.get(status_category, "OPEN") if kind == JiraIssueKind.INITIATIVE else None,
        suggested_task_status=_TASK_STATUS_BY_CATEGORY.get(status_category, TaskStatus.NOT_STARTED)
        if kind == JiraIssueKind.OUTCOME
        else None,
        skipped_linked_issues=len(fields.get("issuelinks") or []),
    )
