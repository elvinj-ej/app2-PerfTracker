from datetime import date

from app.models import Engineer, Initiative, PlatformInitiativeCategory, PlatformInitiativeDetail, Task, TimeEntry
from app.models.enums import InitiativeStatus, InitiativeType, TaskStatus
from app.services.fiscal_year import fiscal_year_label
from app.services.reporting import build_monthly_report, get_available_months, month_bounds


def test_month_bounds_within_a_year():
    assert month_bounds("2026-07") == (date(2026, 7, 1), date(2026, 7, 31))


def test_month_bounds_handles_december_rollover():
    assert month_bounds("2026-12") == (date(2026, 12, 1), date(2026, 12, 31))


def test_month_bounds_handles_leap_february():
    assert month_bounds("2028-02") == (date(2028, 2, 1), date(2028, 2, 29))


def test_get_available_months_falls_back_to_today_when_no_data(db_session):
    months = get_available_months(db_session)
    assert months == [date.today().strftime("%Y-%m")]


def _make_engineer(db_session, name="Test Engineer", email="test@example.com") -> Engineer:
    engineer = Engineer(name=name, email=email)
    db_session.add(engineer)
    db_session.flush()
    return engineer


def test_build_monthly_report_attributes_hours_by_week_start_month(db_session):
    engineer = _make_engineer(db_session)

    initiative = Initiative(
        type=InitiativeType.KBI,
        title="Test KBI",
        status=InitiativeStatus.IN_PROGRESS,
        start_date=date(2026, 7, 1),
        expected_delivery_date=date(2026, 9, 1),
    )
    db_session.add(initiative)
    db_session.flush()

    task_with_hours = Task(
        initiative_id=initiative.id,
        title="Task with July hours",
        owner_engineer_id=engineer.id,
        forecast_duration_days=5,
        status=TaskStatus.IN_PROGRESS,
        sequence_order=0,
    )
    task_without_hours = Task(
        initiative_id=initiative.id,
        title="Task not started yet",
        owner_engineer_id=engineer.id,
        forecast_duration_days=3,
        status=TaskStatus.NOT_STARTED,
        sequence_order=1,
    )
    db_session.add_all([task_with_hours, task_without_hours])
    db_session.flush()

    july_week = date(2026, 7, 6)  # a Monday in July
    august_week = date(2026, 8, 3)  # a Monday in August
    db_session.add_all(
        [
            TimeEntry(
                task_id=task_with_hours.id,
                engineer_id=engineer.id,
                week_start_date=july_week,
                fiscal_year_label=fiscal_year_label(july_week),
                hours=10,
            ),
            TimeEntry(
                task_id=task_with_hours.id,
                engineer_id=engineer.id,
                week_start_date=august_week,
                fiscal_year_label=fiscal_year_label(august_week),
                hours=15,
            ),
        ]
    )
    db_session.commit()

    july_report = build_monthly_report(db_session, "2026-07")
    assert len(july_report.kbis) == 1
    july_kbi = july_report.kbis[0]
    assert july_kbi.total_hours_this_month == 10.0
    # both predefined tasks show up, including the one with zero hours this month
    assert {t.title for t in july_kbi.tasks} == {"Task with July hours", "Task not started yet"}
    hours_task = next(t for t in july_kbi.tasks if t.title == "Task with July hours")
    assert hours_task.hours_this_month == 10.0
    assert hours_task.owner_engineer_name == "Test Engineer"
    zero_task = next(t for t in july_kbi.tasks if t.title == "Task not started yet")
    assert zero_task.hours_this_month == 0.0

    august_report = build_monthly_report(db_session, "2026-08")
    august_kbi = august_report.kbis[0]
    assert august_kbi.total_hours_this_month == 15.0


def test_build_monthly_report_recurring_ops_have_no_completion_pct(db_session):
    engineer = _make_engineer(db_session)
    initiative = Initiative(type=InitiativeType.RECURRING_OPS, title="Patching", status=InitiativeStatus.OPEN)
    db_session.add(initiative)
    db_session.flush()
    task = Task(
        initiative_id=initiative.id,
        title="August patch cycle",
        owner_engineer_id=engineer.id,
        status=TaskStatus.IN_PROGRESS,
        sequence_order=0,
    )
    db_session.add(task)
    db_session.commit()

    report = build_monthly_report(db_session, date.today().strftime("%Y-%m"))
    assert len(report.recurring_ops) == 1
    assert report.recurring_ops[0].completion_pct is None


def test_build_monthly_report_upgrade_completion_uses_units(db_session):
    from app.models import UpgradeUnit
    from app.models.enums import UpgradeUnitStatus

    engineer = _make_engineer(db_session)
    category = PlatformInitiativeCategory(name="SQL Upgrade", is_upgrade_type=True)
    db_session.add(category)
    db_session.flush()

    initiative = Initiative(type=InitiativeType.PLATFORM, title="SQL Upgrade Wave", status=InitiativeStatus.IN_PROGRESS)
    db_session.add(initiative)
    db_session.flush()
    db_session.add(PlatformInitiativeDetail(initiative_id=initiative.id, category_id=category.id))
    db_session.add_all(
        [
            UpgradeUnit(initiative_id=initiative.id, system_name="SQL-01", status=UpgradeUnitStatus.COMPLETE),
            UpgradeUnit(initiative_id=initiative.id, system_name="SQL-02", status=UpgradeUnitStatus.NOT_STARTED),
        ]
    )
    db_session.commit()

    report = build_monthly_report(db_session, date.today().strftime("%Y-%m"))
    platform = next(p for p in report.platform_initiatives if p.id == initiative.id)
    assert platform.category_name == "SQL Upgrade"
    assert platform.completion_pct == 50.0
