from datetime import date, datetime

from app.models import Engineer, Initiative, KbiCategory, KbiDetail, Task, TimeEntry
from app.models.enums import InitiativeStatus, InitiativeType, TaskStatus
from app.services.excel_export import build_completed_outcomes_workbook, build_funded_change_business_workbook
from app.services.reporting import build_engineer_completed_outcomes, build_funded_change_business_report
from app.services.sprint import sprint_bounds, sprint_number_for_date


def _make_engineer(db_session, name="Dana Owner", email="dana@example.com") -> Engineer:
    engineer = Engineer(name=name, email=email)
    db_session.add(engineer)
    db_session.flush()
    return engineer


def _make_kbi(db_session, funded: bool, title="KBI Ask") -> Initiative:
    category = KbiCategory(name=f"Amplify-{title}")
    db_session.add(category)
    db_session.flush()
    initiative = Initiative(type=InitiativeType.KBI, title=title, status=InitiativeStatus.OPEN)
    db_session.add(initiative)
    db_session.flush()
    db_session.add(KbiDetail(initiative_id=initiative.id, category_id=category.id, funded=funded))
    db_session.commit()
    return initiative


def test_funded_change_business_report_only_includes_funded_kbis(db_session):
    funded = _make_kbi(db_session, funded=True, title="Funded Ask")
    _make_kbi(db_session, funded=False, title="Unfunded Ask")

    reports = build_funded_change_business_report(db_session)

    assert len(reports) == 1
    assert reports[0].id == funded.id


def test_funded_change_business_report_includes_unassigned_outcomes(db_session):
    funded = _make_kbi(db_session, funded=True)
    db_session.add(Task(initiative_id=funded.id, title="Unassigned outcome", owner_engineer_id=None))
    db_session.commit()

    reports = build_funded_change_business_report(db_session)

    assert reports[0].outcomes[0].owner_engineer_id is None
    assert reports[0].outcomes[0].owner_engineer_name is None


def test_funded_change_business_report_sums_hours_and_labels_sprint(db_session):
    funded = _make_kbi(db_session, funded=True)
    engineer = _make_engineer(db_session)
    sprint_n = sprint_number_for_date(date.today())
    start, _ = sprint_bounds(sprint_n)
    task = Task(initiative_id=funded.id, title="Outcome", owner_engineer_id=engineer.id, sprint_number=sprint_n)
    db_session.add(task)
    db_session.flush()
    db_session.add(TimeEntry(task_id=task.id, engineer_id=engineer.id, week_start_date=start, fiscal_year_label="FY26-27", hours=6))
    db_session.commit()

    reports = build_funded_change_business_report(db_session)

    assert reports[0].total_hours_logged == 6.0
    assert reports[0].outcomes[0].sprint_label == f"S{sprint_n}"
    assert reports[0].outcomes[0].owner_engineer_name == "Dana Owner"


def test_funded_change_business_workbook_builds_without_error(db_session):
    _make_kbi(db_session, funded=True)
    reports = build_funded_change_business_report(db_session)
    workbook_bytes = build_funded_change_business_workbook(reports)
    assert workbook_bytes.startswith(b"PK")  # xlsx is a zip archive


def test_engineer_completed_outcomes_only_includes_complete_tasks(db_session):
    engineer = _make_engineer(db_session)
    initiative = Initiative(type=InitiativeType.PLATFORM, title="Platform Ask", status=InitiativeStatus.OPEN)
    db_session.add(initiative)
    db_session.flush()
    db_session.add_all(
        [
            Task(initiative_id=initiative.id, title="Done", owner_engineer_id=engineer.id, status=TaskStatus.COMPLETE),
            Task(initiative_id=initiative.id, title="Not done", owner_engineer_id=engineer.id, status=TaskStatus.IN_PROGRESS),
        ]
    )
    db_session.commit()

    outcomes = build_engineer_completed_outcomes(db_session, engineer)

    assert len(outcomes) == 1
    assert outcomes[0].title == "Done"


def test_engineer_completed_outcomes_orders_most_recent_first(db_session):
    engineer = _make_engineer(db_session)
    initiative = Initiative(type=InitiativeType.PLATFORM, title="Platform Ask", status=InitiativeStatus.OPEN)
    db_session.add(initiative)
    db_session.flush()
    older = Task(initiative_id=initiative.id, title="Older", owner_engineer_id=engineer.id, status=TaskStatus.COMPLETE)
    newer = Task(initiative_id=initiative.id, title="Newer", owner_engineer_id=engineer.id, status=TaskStatus.COMPLETE)
    db_session.add_all([older, newer])
    db_session.flush()
    older.completed_at = datetime(2026, 1, 1)
    newer.completed_at = datetime(2026, 6, 1)
    db_session.commit()

    outcomes = build_engineer_completed_outcomes(db_session, engineer)

    assert [o.title for o in outcomes] == ["Newer", "Older"]


def test_completed_outcomes_workbook_builds_without_error(db_session):
    engineer = _make_engineer(db_session)
    outcomes = build_engineer_completed_outcomes(db_session, engineer)
    workbook_bytes = build_completed_outcomes_workbook(engineer.name, outcomes)
    assert workbook_bytes.startswith(b"PK")
