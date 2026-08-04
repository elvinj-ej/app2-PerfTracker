"""Parses a Jira "Issue -> Export -> Word" file for a single issue.

Despite the .doc extension, this is actually an HTML document with a
consistent "label <td>, value <td>" table structure (Jira just names it .doc
so it opens in Word) - not a real binary Word document. Produces the same
ParsedJiraInitiative shape as jira_import.py's XML parser and reuses its
priority/status mapping and HTML-stripping helpers, so both importers feed
the same review UI.

This app's KBI/Platform fields don't have a dedicated home for "Opportunity",
"Who will Benefit?", or "Functional Stream", so those are folded into the
description (clearly labeled) rather than silently dropped - unlike the XML
importer's linked issues, which genuinely have no equivalent concept here at
all.

Parsed with plain regexes rather than an HTML parser: this is plain text as
far as the parser is concerned, so there's no entity-expansion/XXE surface
the way there is for the XML importer's defusedxml usage.
"""

import re
from datetime import date, datetime

from app.services.jira_import import (
    JiraImportError,
    ParsedJiraInitiative,
    _guess_priority,
    _guess_status,
    _strip_html,
)

_TITLE_RE = re.compile(
    r'<h3 class="formtitle">\s*\[([A-Za-z][A-Za-z0-9]*-\d+)\]\s*&nbsp;<a[^>]*>([^<]+)</a>',
    re.IGNORECASE,
)
_DESCRIPTION_RE = re.compile(r'<td id="descriptionArea">(.*?)</td>', re.IGNORECASE | re.DOTALL)
_DATETIME_ATTR_RE = re.compile(r'datetime="(\d{4}-\d{2}-\d{2})"')


def _extract_field(html: str, label: str) -> str | None:
    pattern = re.compile(
        r"<b>\s*" + re.escape(label) + r"\s*\??\s*:?\s*</b>\s*</td>\s*<td[^>]*>(.*?)</td>",
        re.IGNORECASE | re.DOTALL,
    )
    match = pattern.search(html)
    return match.group(1) if match else None


def _extract_date(value_html: str | None) -> date | None:
    if not value_html:
        return None
    match = _DATETIME_ATTR_RE.search(value_html)
    if not match:
        return None
    try:
        return datetime.strptime(match.group(1), "%Y-%m-%d").date()
    except ValueError:
        return None


def parse_jira_word_export(html_bytes: bytes) -> ParsedJiraInitiative:
    html = html_bytes.decode("utf-8", errors="replace")

    title_match = _TITLE_RE.search(html)
    if not title_match:
        raise JiraImportError(
            "Could not find an issue title - this doesn't look like a Jira 'Export > Word' "
            "file for a single issue."
        )
    jira_number = title_match.group(1)
    title = title_match.group(2).strip()

    description_match = _DESCRIPTION_RE.search(html)
    description_parts = []
    if description_match:
        stripped = _strip_html(description_match.group(1))
        if stripped:
            description_parts.append(stripped)

    functional_stream = _extract_field(html, "Functional Stream")
    if functional_stream:
        stripped = _strip_html(functional_stream)
        if stripped:
            description_parts.append(f"Functional Stream: {stripped}")

    opportunity = _extract_field(html, "Opportunity")
    if opportunity:
        stripped = _strip_html(opportunity)
        if stripped:
            description_parts.append(f"Opportunity:\n{stripped}")

    who_will_benefit = _extract_field(html, "Who will Benefit")
    if who_will_benefit:
        stripped = _strip_html(who_will_benefit)
        if stripped:
            description_parts.append(f"Who will Benefit?:\n{stripped}")

    purpose = _extract_field(html, "Purpose")
    priority_text = _extract_field(html, "Priority")
    status_text = _extract_field(html, "Status")

    return ParsedJiraInitiative(
        jira_number=jira_number,
        title=title,
        description="\n\n".join(description_parts) or None,
        business_goal=_strip_html(purpose),
        start_date=_extract_date(_extract_field(html, "Target start")),
        expected_delivery_date=_extract_date(_extract_field(html, "Target end")),
        priority=_guess_priority(_strip_html(priority_text)),
        suggested_status=_guess_status(_strip_html(status_text)),
        skipped_linked_issues=0,
    )
