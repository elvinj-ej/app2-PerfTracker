"""Shared "By Date" / priority parsing rules for the FY26-27 Ask catalog. Used by both
the one-time `services/seed.py` load and the manager-facing Ask catalog upload
(`services/ask_catalog_import.py`), so the two never drift apart on what "by end of
quarter" or "upgrade" in an Ask's text actually means.

FY26-27 runs July 2026 - June 2027 (Cochlear's fiscal year). See `seed.py`'s module
docstring for the full rationale behind these date/priority assumptions.
"""

from datetime import date

from app.models.enums import Priority, RecurrenceType

FY_Q1_END = date(2026, 9, 30)
FY_H1_END = date(2026, 12, 31)
FY_END = date(2027, 6, 30)
FY_FEB_END = date(2027, 2, 28)

_RUN_CADENCE_BY_PHRASE = {
    "by end of day": RecurrenceType.DAILY,
    "by end of month": RecurrenceType.MONTHLY,
    "by end of quarter": RecurrenceType.QUARTERLY,
    "by end of half year": RecurrenceType.HALF_YEARLY,
    "by end of year": RecurrenceType.ANNUAL,
}

_CHANGE_DATE_BY_PHRASE = {
    "by end of quarter": FY_Q1_END,
    "by end of half year": FY_H1_END,
    "by end of year": FY_END,
    "by feb": FY_FEB_END,
}

_LOW_PRIORITY_KEYWORDS = ("evaluate", "re-asses", "re-assess", "set-up and deploy patterns")
_CRITICAL_PRIORITY_KEYWORDS = (
    "security",
    "vulnerab",
    "compliance",
    "sailpoint",
    "access review",
    "password reset",
    "dr test",
    "disaster",
    "backup",
    "restore",
    "audit",
)
_HIGH_PRIORITY_KEYWORDS = (
    "upgrade",
    "upgrde",
    "update of",
    "retire",
    "retirement",
    "renewal",
    "go live",
    "finops",
    "cost control",
    "patching",
)


def parse_run_cadence(by_date: str | None) -> RecurrenceType:
    if by_date:
        cadence = _RUN_CADENCE_BY_PHRASE.get(by_date.strip().lower())
        if cadence is not None:
            return cadence
    return RecurrenceType.AD_HOC


def parse_change_delivery(by_date: str | None) -> tuple[date, str | None]:
    """Returns (expected_delivery_date, extra_note). extra_note is folded into the
    initiative's description when the "By Date" text held a sub-detail rather than a
    date phrase.
    """
    if not by_date:
        return FY_END, None
    known = _CHANGE_DATE_BY_PHRASE.get(by_date.strip().lower())
    if known is not None:
        return known, None
    return FY_END, by_date


def infer_priority(category: str, ask: str) -> Priority:
    text = f"{category} {ask}".lower()
    if any(k in text for k in _LOW_PRIORITY_KEYWORDS):
        return Priority.LOW
    if any(k in text for k in _CRITICAL_PRIORITY_KEYWORDS):
        return Priority.CRITICAL
    if any(k in text for k in _HIGH_PRIORITY_KEYWORDS):
        return Priority.HIGH
    return Priority.MEDIUM
