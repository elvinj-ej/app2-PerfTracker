from datetime import date

from app.core.auth_context import Actor
from app.models import Engineer, Initiative, Task
from app.models.enums import InitiativeStatus, InitiativeType
from app.routers.time_entries import upsert_time_entry
from app.schemas.time_entry import TimeEntryUpsert
from app.services.sprint import sprint_bounds, sprint_number_for_date


def _setup(db_session):
    engineer = Engineer(name="Dana Owner", email="dana@example.com")
    db_session.add(engineer)
    db_session.flush()
    initiative = Initiative(type=InitiativeType.PLATFORM, title="Some Ask", status=InitiativeStatus.OPEN)
    db_session.add(initiative)
    db_session.flush()
    task = Task(initiative_id=initiative.id, title="Outcome", owner_engineer_id=engineer.id)
    db_session.add(task)
    db_session.commit()
    return engineer, task


def test_upsert_time_entry_snaps_to_sprint_start(db_session):
    engineer, task = _setup(db_session)
    actor = Actor(role="engineer", engineer_id=engineer.id)

    mid_sprint_date = date(2026, 8, 15)  # any date, not necessarily a sprint boundary
    sprint_start, _ = sprint_bounds(sprint_number_for_date(mid_sprint_date))

    entry = upsert_time_entry(
        TimeEntryUpsert(task_id=task.id, week_start_date=mid_sprint_date, hours=6),
        db=db_session,
        actor=actor,
    )

    assert entry.week_start_date == sprint_start


def test_upsert_time_entry_is_idempotent_within_the_same_sprint(db_session):
    engineer, task = _setup(db_session)
    actor = Actor(role="engineer", engineer_id=engineer.id)

    sprint_start, sprint_end = sprint_bounds(sprint_number_for_date(date.today()))

    first = upsert_time_entry(
        TimeEntryUpsert(task_id=task.id, week_start_date=sprint_start, hours=4),
        db=db_session,
        actor=actor,
    )
    second = upsert_time_entry(
        TimeEntryUpsert(task_id=task.id, week_start_date=sprint_end, hours=9),
        db=db_session,
        actor=actor,
    )

    assert first.id == second.id
    assert second.hours == 9
