import math
from datetime import date, timedelta

from app.models.enums import TaskStatus, UpgradeUnitStatus
from app.services.completion import (
    TaskLike,
    TimelineHealth,
    UpgradeUnitLike,
    compute_initiative_completion,
    task_completion_pct,
    timeline_health,
    upgrade_unit_completion_pct,
)


def test_task_completion_pct_weighted_by_forecast_days():
    tasks = [
        TaskLike(status=TaskStatus.COMPLETE, forecast_duration_days=8),
        TaskLike(status=TaskStatus.NOT_STARTED, forecast_duration_days=2),
    ]
    assert task_completion_pct(tasks) == 80.0


def test_task_completion_pct_falls_back_to_count_ratio_without_forecasts():
    tasks = [
        TaskLike(status=TaskStatus.COMPLETE, forecast_duration_days=None),
        TaskLike(status=TaskStatus.NOT_STARTED, forecast_duration_days=None),
        TaskLike(status=TaskStatus.NOT_STARTED, forecast_duration_days=None),
    ]
    assert math.isclose(task_completion_pct(tasks), 33.3, abs_tol=0.1)


def test_task_completion_pct_empty_list_is_none():
    assert task_completion_pct([]) is None


def test_upgrade_unit_completion_pct():
    units = [
        UpgradeUnitLike(status=UpgradeUnitStatus.COMPLETE),
        UpgradeUnitLike(status=UpgradeUnitStatus.COMPLETE),
        UpgradeUnitLike(status=UpgradeUnitStatus.NOT_STARTED),
        UpgradeUnitLike(status=UpgradeUnitStatus.IN_PROGRESS),
    ]
    assert upgrade_unit_completion_pct(units) == 50.0


def test_timeline_health_on_track():
    start = date(2026, 1, 1)
    end = date(2026, 1, 11)  # 10 days total
    today = date(2026, 1, 6)  # 5 days elapsed -> expected 50%
    health, expected_pct = timeline_health(55.0, start, end, today)
    assert health == TimelineHealth.ON_TRACK
    assert expected_pct == 50.0


def test_timeline_health_behind():
    start = date(2026, 1, 1)
    end = date(2026, 1, 11)
    today = date(2026, 1, 11)  # 100% expected
    health, _ = timeline_health(50.0, start, end, today)
    assert health == TimelineHealth.BEHIND


def test_timeline_health_not_applicable_without_dates():
    health, expected_pct = timeline_health(50.0, None, None)
    assert health == TimelineHealth.NOT_APPLICABLE
    assert expected_pct is None


def test_upgrade_units_override_task_based_formula():
    tasks = [TaskLike(status=TaskStatus.NOT_STARTED, forecast_duration_days=5)]
    units = [
        UpgradeUnitLike(status=UpgradeUnitStatus.COMPLETE),
        UpgradeUnitLike(status=UpgradeUnitStatus.NOT_STARTED),
    ]
    result = compute_initiative_completion(
        tasks=tasks,
        start_date=date.today() - timedelta(days=5),
        expected_delivery_date=date.today() + timedelta(days=5),
        upgrade_units=units,
    )
    assert result.completion_pct == 50.0


def test_recurring_ops_style_initiative_with_no_tasks_or_dates_has_no_completion_pct():
    result = compute_initiative_completion(tasks=[], start_date=None, expected_delivery_date=None)
    assert result.completion_pct is None
    assert result.timeline_health == TimelineHealth.NOT_APPLICABLE
