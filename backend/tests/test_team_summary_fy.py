from datetime import date, datetime

from app.models import Engineer, Initiative, Task, TimeEntry
from app.models.enums import InitiativeStatus, InitiativeType, TaskStatus
from app.services.fiscal_year import current_fiscal_year_label
from app.services.reporting import build_team_summary
from app.services.sprint import sprint_bounds, sprint_number_for_date


def _make_engineer(db_session) -> Engineer:
    engineer = Engineer(name="Dana Owner", email="dana@example.com")
    db_session.add(engineer)
    db_session.flush()
    return engineer


def test_completion_by_type_counts_complete_and_total_per_category(db_session):
    kbi = Initiative(type=InitiativeType.KBI, title="KBI Ask", status=InitiativeStatus.OPEN)
    platform = Initiative(type=InitiativeType.PLATFORM, title="Platform Ask", status=InitiativeStatus.OPEN)
    db_session.add_all([kbi, platform])
    db_session.flush()

    db_session.add_all(
        [
            Task(initiative_id=kbi.id, title="A", status=TaskStatus.COMPLETE),
            Task(initiative_id=kbi.id, title="B", status=TaskStatus.NOT_STARTED),
            Task(initiative_id=platform.id, title="C", status=TaskStatus.IN_PROGRESS),
        ]
    )
    db_session.commit()

    summary = build_team_summary(db_session)
    by_type = {c.initiative_type: c for c in summary.completion_by_type}

    assert by_type[InitiativeType.KBI].outcomes_completed == 1
    assert by_type[InitiativeType.KBI].outcomes_total == 2
    assert by_type[InitiativeType.PLATFORM].outcomes_completed == 0
    assert by_type[InitiativeType.PLATFORM].outcomes_total == 1
    assert by_type[InitiativeType.RECURRING_OPS].outcomes_total == 0


def test_hours_by_category_fy_only_counts_current_fiscal_year_entries(db_session):
    engineer = _make_engineer(db_session)
    initiative = Initiative(type=InitiativeType.KBI, title="KBI Ask", status=InitiativeStatus.OPEN)
    db_session.add(initiative)
    db_session.flush()
    task = Task(initiative_id=initiative.id, title="Outcome", owner_engineer_id=engineer.id)
    db_session.add(task)
    db_session.flush()

    this_fy = current_fiscal_year_label()
    db_session.add_all(
        [
            TimeEntry(task_id=task.id, engineer_id=engineer.id, week_start_date=date(2026, 7, 8), fiscal_year_label=this_fy, hours=5),
            TimeEntry(task_id=task.id, engineer_id=engineer.id, week_start_date=date(2020, 1, 1), fiscal_year_label="FY19-20", hours=99),
        ]
    )
    db_session.commit()

    summary = build_team_summary(db_session)

    assert summary.fiscal_year_label == this_fy
    fy_hours = {c.initiative_type: c.hours for c in summary.hours_by_category_fy}
    assert fy_hours[InitiativeType.KBI] == 5.0


def test_sprint_trend_counts_outcomes_completed_within_each_sprint_window(db_session):
    engineer = _make_engineer(db_session)
    initiative = Initiative(type=InitiativeType.KBI, title="KBI Ask", status=InitiativeStatus.OPEN)
    db_session.add(initiative)
    db_session.flush()

    current_sprint = sprint_number_for_date(date.today())
    sprint_start, _ = sprint_bounds(current_sprint)

    task = Task(
        initiative_id=initiative.id,
        title="Completed this sprint",
        owner_engineer_id=engineer.id,
        status=TaskStatus.COMPLETE,
    )
    db_session.add(task)
    db_session.flush()
    task.completed_at = datetime.combine(sprint_start, datetime.min.time())
    db_session.commit()

    summary = build_team_summary(db_session)

    current_point = next(p for p in summary.sprint_trend if p.sprint_number == current_sprint)
    assert current_point.outcomes_completed == 1
    assert summary.sprint_trend[-1].sprint_number == current_sprint
    assert summary.sprint_trend[0].sprint_number == max(1, current_sprint - 7)
