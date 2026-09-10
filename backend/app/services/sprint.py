"""Pure date-math helpers for the 2-week sprint calendar (S1, S2, ...).

No DB table backs this: sprint boundaries are fully deterministic from the fixed
epoch below, so storing them would just be denormalized data with no independent
lifecycle - same rationale as fiscal_year.py's week/FY helpers.

S1 starts Wed Jul 8, 2026 and the calendar runs through the end of June 2027
(one fiscal year's worth of sprints, ~25 of them).
"""

from dataclasses import dataclass
from datetime import date, timedelta

SPRINT_EPOCH = date(2026, 7, 8)  # S1 start - confirmed Wednesday
SPRINT_LENGTH_DAYS = 14
CYCLE_END = date(2027, 6, 30)
MAX_FORECAST_DAYS = 11


@dataclass
class SprintInfo:
    number: int
    label: str
    start_date: date
    end_date: date
    is_current: bool


def sprint_label(n: int) -> str:
    return f"S{n}"


def sprint_bounds(n: int) -> tuple[date, date]:
    start = SPRINT_EPOCH + timedelta(days=(n - 1) * SPRINT_LENGTH_DAYS)
    end = start + timedelta(days=SPRINT_LENGTH_DAYS - 1)
    return start, end


def max_sprint_number() -> int:
    n = 1
    while True:
        start, _ = sprint_bounds(n + 1)
        if start > CYCLE_END:
            return n
        n += 1


def sprint_number_for_date(d: date) -> int:
    """Nearest sprint containing `d`, clamped into [1, max_sprint_number()] for
    dates before the epoch or after the cycle ends - used both for migrating
    pre-existing Outcome dates and for any other out-of-range date.
    """
    if d < SPRINT_EPOCH:
        return 1
    n = (d - SPRINT_EPOCH).days // SPRINT_LENGTH_DAYS + 1
    return min(n, max_sprint_number())


def list_sprints(today: date | None = None) -> list[SprintInfo]:
    today = today or date.today()
    current = sprint_number_for_date(today)
    sprints = []
    for n in range(1, max_sprint_number() + 1):
        start, end = sprint_bounds(n)
        sprints.append(SprintInfo(number=n, label=sprint_label(n), start_date=start, end_date=end, is_current=n == current))
    return sprints
