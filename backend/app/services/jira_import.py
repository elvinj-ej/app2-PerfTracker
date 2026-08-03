"""Parses a Jira single-issue XML export (Jira issue -> ... -> Export XML) into the
fields needed to pre-fill a new KBI. Only a small, well-known set of fields is pulled
out - the hundreds of other Jira custom fields (PPM ranking fields, workflow
metadata, etc.) are intentionally ignored, and issue links (Blocks/Relates/etc.) are
just counted, not imported, since this app has no equivalent concept.

Uses defusedxml rather than the stdlib XML parser since this parses user-uploaded
files: defusedxml disables external entity resolution and other XXE-style attacks
that a naively parsed XML upload would otherwise be exposed to.
"""

import re
from dataclasses import dataclass
from datetime import date, datetime

from defusedxml import ElementTree as safe_et

from app.models.enums import Priority

_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"[ \t]+")
_BLANK_LINES_RE = re.compile(r"\n{3,}")

_HTML_ENTITIES = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&#39;": "'",
    "&quot;": '"',
}

# Jira's MoSCoW-style priority scheme doesn't line up with our Low/Medium/High/Critical
# scale one-to-one, but this is a reasonable, documented mapping.
_MOSCOW_PRIORITY_MAP = {
    "must have": Priority.CRITICAL,
    "should have": Priority.HIGH,
    "could have": Priority.MEDIUM,
    "won't have": Priority.LOW,
    "will not have": Priority.LOW,
}

_JIRA_DATE_FORMAT = "%a, %d %b %Y %H:%M:%S %z"


class JiraImportError(ValueError):
    pass


@dataclass
class ParsedJiraInitiative:
    jira_number: str | None
    title: str
    description: str | None
    business_goal: str | None
    start_date: date | None
    expected_delivery_date: date | None
    priority: Priority | None
    suggested_status: str
    skipped_linked_issues: int = 0


def _strip_html(html: str | None) -> str | None:
    if not html:
        return None
    text = _TAG_RE.sub("", html)
    for entity, replacement in _HTML_ENTITIES.items():
        text = text.replace(entity, replacement)
    text = _WHITESPACE_RE.sub(" ", text)
    lines = [line.strip() for line in text.splitlines()]
    text = "\n".join(line for line in lines if line)
    text = _BLANK_LINES_RE.sub("\n\n", text).strip()
    return text or None


def _parse_jira_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value.strip(), _JIRA_DATE_FORMAT).date()
    except ValueError:
        return None


def _find_custom_field(item, *field_names: str) -> str | None:
    wanted = {name.lower() for name in field_names}
    for customfield in item.findall(".//customfields/customfield"):
        name_el = customfield.find("customfieldname")
        if name_el is None or (name_el.text or "").strip().lower() not in wanted:
            continue
        value_el = customfield.find("./customfieldvalues/customfieldvalue")
        if value_el is not None and value_el.text:
            return value_el.text.strip()
    return None


def _guess_status(status_text: str | None) -> str:
    if not status_text:
        return "OPEN"
    lowered = status_text.lower()
    if any(keyword in lowered for keyword in ("done", "complete", "closed")):
        return "COMPLETED"
    if "cancel" in lowered:
        return "CANCELLED"
    if "progress" in lowered:
        return "IN_PROGRESS"
    return "OPEN"


def _guess_priority(priority_text: str | None) -> Priority | None:
    if not priority_text:
        return None
    return _MOSCOW_PRIORITY_MAP.get(priority_text.strip().lower())


def parse_jira_issue_xml(xml_bytes: bytes) -> ParsedJiraInitiative:
    try:
        root = safe_et.fromstring(xml_bytes)
    except Exception as exc:
        raise JiraImportError(f"Could not parse XML: {exc}") from exc

    item = root.find(".//item")
    if item is None:
        raise JiraImportError(
            "No <item> element found - this doesn't look like a Jira single-issue XML export "
            "(Issue -> Export -> XML)."
        )

    def text_of(tag: str) -> str | None:
        el = item.find(tag)
        return el.text.strip() if el is not None and el.text else None

    key = text_of("key")
    summary = text_of("summary") or text_of("title") or "Imported Initiative"

    business_goal_raw = _find_custom_field(item, "Purpose") or _find_custom_field(item, "Opportunity")

    return ParsedJiraInitiative(
        jira_number=key,
        title=summary,
        description=_strip_html(item.findtext("description")),
        business_goal=_strip_html(business_goal_raw),
        start_date=_parse_jira_date(_find_custom_field(item, "Target start")),
        expected_delivery_date=_parse_jira_date(_find_custom_field(item, "Target end")),
        priority=_guess_priority(text_of("priority")),
        suggested_status=_guess_status(text_of("status")),
        skipped_linked_issues=len(item.findall(".//issuelinks//issuelink")),
    )
