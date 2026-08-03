"""Completion % and timeline-health calculations.

Pure functions over plain data so they're unit-testable without a database (see
tests/test_completion.py). Callers (routers/reports) are responsible for loading the
relevant ORM rows and passing in simple values.
"""

from dataclasses import dataclass
from datetime import date
from enum import Enum

from app.models.enums import TaskStatus, UpgradeUnitStatus


class TimelineHealth(str, Enum):
    ON_TRACK = "ON_TRACK"
    AT_RISK = "AT_RISK"
    BEHIND = "BEHIND"
    NOT_APPLICABLE = "NOT_APPLICABLE"


@dataclass
class TaskLike:
    status: TaskStatus
    forecast_duration_days: float | None


@dataclass
class UpgradeUnitLike:
    status: UpgradeUnitStatus


@dataclass
class CompletionResult:
    completion_pct: float | None
    timeline_health: TimelineHealth
    expected_pct: float | None


def task_completion_pct(tasks: list[TaskLike]) -> float | None:
    """Forecast-weighted completion ratio, falling back to a simple task-count ratio
    when forecast durations are missing (partially or entirely).
    """
    if not tasks:
        return None

    if all(t.forecast_duration_days is not None for t in tasks):
        total_forecast = sum(t.forecast_duration_days for t in tasks)  # type: ignore[misc]
        if total_forecast > 0:
            completed_forecast = sum(
                t.forecast_duration_days for t in tasks if t.status == TaskStatus.COMPLETE  # type: ignore[misc]
            )
            return round((completed_forecast / total_forecast) * 100, 1)

    completed_count = sum(1 for t in tasks if t.status == TaskStatus.COMPLETE)
    return round((completed_count / len(tasks)) * 100, 1)


def upgrade_unit_completion_pct(units: list[UpgradeUnitLike]) -> float | None:
    if not units:
        return None
    completed = sum(1 for u in units if u.status == UpgradeUnitStatus.COMPLETE)
    return round((completed / len(units)) * 100, 1)


def timeline_health(
    completion_pct: float | None,
    start_date: date | None,
    expected_delivery_date: date | None,
    today: date | None = None,
) -> tuple[TimelineHealth, float | None]:
    """Compares actual completion % to where the initiative should be given elapsed
    time. Kept separate from completion_pct rather than blended into it, so "% done"
    and "on schedule?" stay independently interpretable.
    """
    if completion_pct is None or start_date is None or expected_delivery_date is None:
        return TimelineHealth.NOT_APPLICABLE, None

    total_days = (expected_delivery_date - start_date).days
    if total_days <= 0:
        return TimelineHealth.NOT_APPLICABLE, None

    today = today or date.today()
    elapsed_days = (today - start_date).days
    expected_pct = max(0.0, min(100.0, (elapsed_days / total_days) * 100))

    delta = completion_pct - expected_pct
    if delta >= -15:
        health = TimelineHealth.ON_TRACK
    elif delta >= -30:
        health = TimelineHealth.AT_RISK
    else:
        health = TimelineHealth.BEHIND

    return health, round(expected_pct, 1)


def compute_initiative_completion(
    *,
    tasks: list[TaskLike],
    start_date: date | None,
    expected_delivery_date: date | None,
    upgrade_units: list[UpgradeUnitLike] | None = None,
    today: date | None = None,
) -> CompletionResult:
    """Entry point used for KBI and Platform initiatives. Upgrade-category Platform
    initiatives pass upgrade_units, which overrides the task-based formula per the
    requirement that per-system upgrade completion rolls up directly into the
    initiative's headline %. Falls back to the task-based formula if no units exist yet.
    """
    completion_pct = None
    if upgrade_units:
        completion_pct = upgrade_unit_completion_pct(upgrade_units)
    if completion_pct is None:
        completion_pct = task_completion_pct(tasks)

    health, expected_pct = timeline_health(completion_pct, start_date, expected_delivery_date, today)
    return CompletionResult(completion_pct=completion_pct, timeline_health=health, expected_pct=expected_pct)
