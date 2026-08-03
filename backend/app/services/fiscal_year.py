"""Pure date-math helpers for the Jul 1 - Jun 30 fiscal year.

No DB table backs this: FY boundaries are fully deterministic from any calendar date, so
storing them would just be denormalized data with no independent lifecycle.
"""

from datetime import date, timedelta

FISCAL_YEAR_START_MONTH = 7  # July


def fiscal_year_start_calendar_year(d: date) -> int:
    """The calendar year in which the fiscal year containing `d` starts.

    E.g. both 2025-07-01 and 2026-06-30 belong to the fiscal year starting 2025-07-01.
    """
    return d.year if d.month >= FISCAL_YEAR_START_MONTH else d.year - 1


def fiscal_year_label(d: date) -> str:
    start_year = fiscal_year_start_calendar_year(d)
    end_year = start_year + 1
    return f"FY{start_year % 100:02d}-{end_year % 100:02d}"


def fiscal_year_bounds(label: str) -> tuple[date, date]:
    """Inverse of fiscal_year_label: 'FY25-26' -> (2025-07-01, 2026-06-30)."""
    start_suffix = label[2:4]
    start_year = 2000 + int(start_suffix)
    start = date(start_year, FISCAL_YEAR_START_MONTH, 1)
    end = date(start_year + 1, FISCAL_YEAR_START_MONTH, 1) - timedelta(days=1)
    return start, end


def current_fiscal_year_label(today: date | None = None) -> str:
    return fiscal_year_label(today or date.today())


def week_start(d: date) -> date:
    """Monday-aligned start of the ISO week containing `d`."""
    return d - timedelta(days=d.weekday())


def fiscal_week_index(d: date) -> int:
    """1-based index of the week containing `d` within its own fiscal year."""
    fy_start, _ = fiscal_year_bounds(fiscal_year_label(d))
    return ((week_start(d) - week_start(fy_start)).days // 7) + 1
