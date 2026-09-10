from datetime import date, timedelta
from unittest.mock import MagicMock

import anthropic
import httpx
import pytest

from app.models import Initiative
from app.models.enums import InitiativeStatus, InitiativeType
from app.services.ai_breakdown import AiBreakdownError, TaskBreakdownService, generate_and_persist_breakdown
from app.services.sprint import sprint_number_for_date


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


def test_generate_wraps_anthropic_api_errors_as_ai_breakdown_error():
    client = MagicMock()
    client.messages.create.side_effect = anthropic.APIConnectionError(
        message="Connection error.", request=httpx.Request("POST", "https://api.anthropic.com")
    )
    service = TaskBreakdownService(client=client)
    initiative = Initiative(title="Test KBI", type=InitiativeType.KBI, status=InitiativeStatus.DRAFT)

    with pytest.raises(AiBreakdownError, match="Claude API error"):
        service.generate(initiative)


def test_generate_wraps_malformed_tool_response_as_ai_breakdown_error():
    client = MagicMock()
    # Missing the required "stage" key - simulates an unexpected/malformed tool response.
    client.messages.create.return_value = _fake_anthropic_response(
        [{"title": "Oops", "description": "Missing stage", "forecast_duration_days": 3}]
    )
    service = TaskBreakdownService(client=client)
    initiative = Initiative(title="Test KBI", type=InitiativeType.KBI, status=InitiativeStatus.DRAFT)

    with pytest.raises(AiBreakdownError, match="unexpected shape"):
        service.generate(initiative)


def test_generate_and_persist_breakdown_creates_editable_task_rows(db_session):
    initiative = Initiative(title="Test KBI", type=InitiativeType.KBI, status=InitiativeStatus.DRAFT)
    db_session.add(initiative)
    db_session.flush()

    client = MagicMock()
    client.messages.create.return_value = _fake_anthropic_response(FAKE_TASKS)
    service = TaskBreakdownService(client=client)

    created = generate_and_persist_breakdown(db_session, initiative, service=service)

    assert len(created) == 2
    assert all(t.is_ai_generated is True for t in created)
    # Ownership is self-service: an AI-generated Outcome starts unassigned until an
    # engineer opts into the Ask and claims it, same as an uploaded Ask catalog's Outcomes.
    assert all(t.owner_engineer_id is None for t in created)
    assert [t.sequence_order for t in created] == [0, 1]


def test_generate_and_persist_breakdown_assigns_sequential_sprints(db_session):
    initiative = Initiative(
        title="Test KBI",
        type=InitiativeType.KBI,
        status=InitiativeStatus.DRAFT,
        start_date=date(2026, 8, 3),
    )
    db_session.add(initiative)
    db_session.flush()

    client = MagicMock()
    client.messages.create.return_value = _fake_anthropic_response(FAKE_TASKS)
    service = TaskBreakdownService(client=client)

    created = generate_and_persist_breakdown(db_session, initiative, service=service)

    first_sprint = sprint_number_for_date(date(2026, 8, 3))
    assert created[0].sprint_number == first_sprint
    assert created[1].sprint_number == first_sprint + 1
    assert created[1].start_date == created[0].delivery_date + timedelta(days=1)  # chained, non-overlapping
    for task in created:
        assert (task.delivery_date - task.start_date).days == 13
