import pytest
from fastapi import HTTPException

from app.models import Initiative, Task
from app.models.enums import InitiativeStatus, InitiativeType, TaskStatus
from app.routers.tasks import create_task, update_task
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.sprint import max_sprint_number, sprint_bounds


def _make_initiative(db_session) -> Initiative:
    initiative = Initiative(type=InitiativeType.PLATFORM, title="Some Ask", status=InitiativeStatus.OPEN)
    db_session.add(initiative)
    db_session.flush()
    return initiative


def test_task_can_be_created_without_an_owner(db_session):
    initiative = _make_initiative(db_session)

    task = Task(initiative_id=initiative.id, title="Unowned outcome", owner_engineer_id=None)
    db_session.add(task)
    db_session.commit()

    db_session.refresh(task)
    assert task.owner_engineer_id is None


def test_create_task_with_sprint_number_derives_dates(db_session):
    initiative = _make_initiative(db_session)

    created = create_task(initiative.id, TaskCreate(title="Outcome", sprint_number=3), db=db_session)

    start, end = sprint_bounds(3)
    assert created.sprint_number == 3
    assert created.start_date == start
    assert created.delivery_date == end


def test_create_task_without_sprint_number_leaves_dates_unset(db_session):
    initiative = _make_initiative(db_session)

    created = create_task(initiative.id, TaskCreate(title="Outcome"), db=db_session)

    assert created.sprint_number is None
    assert created.start_date is None
    assert created.delivery_date is None


def test_create_task_rejects_out_of_range_sprint_number(db_session):
    initiative = _make_initiative(db_session)

    with pytest.raises(HTTPException) as exc_info:
        create_task(initiative.id, TaskCreate(title="Outcome", sprint_number=max_sprint_number() + 1), db=db_session)
    assert exc_info.value.status_code == 400


def test_create_task_rejects_forecast_over_eleven_days(db_session):
    initiative = _make_initiative(db_session)

    with pytest.raises(HTTPException) as exc_info:
        create_task(initiative.id, TaskCreate(title="Outcome", forecast_duration_days=12), db=db_session)
    assert exc_info.value.status_code == 400


def test_create_task_accepts_forecast_at_the_eleven_day_cap(db_session):
    initiative = _make_initiative(db_session)

    created = create_task(initiative.id, TaskCreate(title="Outcome", forecast_duration_days=11), db=db_session)
    assert float(created.forecast_duration_days) == 11.0


def test_create_task_marking_complete_immediately_sets_completed_at(db_session):
    initiative = _make_initiative(db_session)

    created = create_task(initiative.id, TaskCreate(title="Outcome", status=TaskStatus.COMPLETE), db=db_session)
    assert created.completed_at is not None


def test_update_task_transitioning_to_complete_sets_completed_at(db_session):
    initiative = _make_initiative(db_session)
    task = create_task(initiative.id, TaskCreate(title="Outcome"), db=db_session)
    assert task.completed_at is None

    updated = update_task(task.id, TaskUpdate(status=TaskStatus.COMPLETE), db=db_session)
    assert updated.completed_at is not None


def test_update_task_transitioning_away_from_complete_clears_completed_at(db_session):
    initiative = _make_initiative(db_session)
    task = create_task(initiative.id, TaskCreate(title="Outcome", status=TaskStatus.COMPLETE), db=db_session)
    assert task.completed_at is not None

    updated = update_task(task.id, TaskUpdate(status=TaskStatus.NOT_STARTED), db=db_session)
    assert updated.completed_at is None


def test_update_task_changing_sprint_number_rederives_dates(db_session):
    initiative = _make_initiative(db_session)
    task = create_task(initiative.id, TaskCreate(title="Outcome", sprint_number=1), db=db_session)

    updated = update_task(task.id, TaskUpdate(sprint_number=5), db=db_session)

    start, end = sprint_bounds(5)
    assert updated.sprint_number == 5
    assert updated.start_date == start
    assert updated.delivery_date == end
