from datetime import date
from unittest.mock import MagicMock

from app.models import Engineer, Initiative
from app.models.enums import InitiativeStatus, InitiativeType
from app.services.ai_breakdown import TaskBreakdownService, generate_and_persist_breakdown
from app.services.outcome_dates import validate_delivery_span


def _fake_anthropic_response(tasks: list[dict]):
    tool_use_block = MagicMock()
    tool_use_block.type = "tool_use"
    tool_use_block.input = {"tasks": tasks}
    response = MagicMock()
    response.content = [tool_use_block]
    response.model_dump.return_value = {"fake": "response"}
    return response


FAKE_TASKS = [
    {"title": "High-Level Design", "description": "Draft HLD", "stage": "HLD", "forecast_duration_days": 5},
    {"title": "Low-Level Design", "description": "Draft LLD", "stage": "LLD", "forecast_duration_days": 8},
]


def test_generate_parses_tool_use_response_into_suggested_tasks():
    client = MagicMock()
    client.messages.create.return_value = _fake_anthropic_response(FAKE_TASKS)
    service = TaskBreakdownService(client=client)
    initiative = Initiative(title="Test KBI", type=InitiativeType.KBI, status=InitiativeStatus.DRAFT)

    tasks, response = service.generate(initiative)

    assert len(tasks) == 2
    assert tasks[0].title == "High-Level Design"
    assert tasks[0].stage.value == "HLD"
    assert tasks[1].sequence_order == 1
    client.messages.create.assert_called_once()
    assert client.messages.create.call_args.kwargs["tool_choice"] == {
        "type": "tool",
        "name": "record_task_breakdown",
    }


def test_generate_and_persist_breakdown_creates_editable_task_rows(db_session):
    engineer = Engineer(name="Test Engineer", email="test@example.com")
    db_session.add(engineer)
    db_session.flush()

    initiative = Initiative(title="Test KBI", type=InitiativeType.KBI, status=InitiativeStatus.DRAFT)
    db_session.add(initiative)
    db_session.flush()

    client = MagicMock()
    client.messages.create.return_value = _fake_anthropic_response(FAKE_TASKS)
    service = TaskBreakdownService(client=client)

    created = generate_and_persist_breakdown(db_session, initiative, engineer.id, service=service)

    assert len(created) == 2
    assert all(t.is_ai_generated is True for t in created)
    assert all(t.owner_engineer_id == engineer.id for t in created)
    assert [t.sequence_order for t in created] == [0, 1]


def test_generate_and_persist_breakdown_assigns_sequential_wednesday_windows(db_session):
    engineer = Engineer(name="Test Engineer", email="test2@example.com")
    db_session.add(engineer)
    db_session.flush()

    initiative = Initiative(
        title="Test KBI",
        type=InitiativeType.KBI,
        status=InitiativeStatus.DRAFT,
        start_date=date(2026, 8, 3),  # a Monday
    )
    db_session.add(initiative)
    db_session.flush()

    client = MagicMock()
    client.messages.create.return_value = _fake_anthropic_response(FAKE_TASKS)
    service = TaskBreakdownService(client=client)

    created = generate_and_persist_breakdown(db_session, initiative, engineer.id, service=service)

    assert created[0].start_date == date(2026, 8, 5)  # rolled forward to the next Wednesday
    assert created[0].delivery_date == date(2026, 8, 19)
    assert created[1].start_date == created[0].delivery_date  # chained, non-overlapping
    for task in created:
        validate_delivery_span(task.start_date, task.delivery_date)
