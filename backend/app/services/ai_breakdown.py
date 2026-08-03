"""Generates a suggested task breakdown for an initiative via the Claude API.

Uses forced tool-use (rather than parsing free text) so the response is guaranteed to be
a clean, structured list of tasks that maps directly onto Task rows. Requires
ANTHROPIC_API_KEY to be set; the model is configurable via ANTHROPIC_MODEL.
"""

import json
from dataclasses import dataclass

import anthropic
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AiBreakdownRequest, Initiative, Task
from app.models.enums import TaskStage

SYSTEM_PROMPT = """You are assisting a Cloud/Hosting & Platform engineering team in breaking \
down a work initiative into an execution task list. This team follows a TOGAF-influenced \
systems design lifecycle for KBI and Platform work, with these standard stages, in order:

1. HLD - High-Level Design
2. LLD - Low-Level Design
3. SOLUTION_DESIGN_APPROVAL - Solution Design sign-off/approval
4. NON_PROD_DEPLOYMENT - Deployment and validation in non-production
5. PROD_DEPLOYMENT - Production deployment

Given the initiative's details, propose a concrete, tailored task breakdown following \
this lifecycle. Not every stage necessarily needs multiple tasks, but the sequence should \
generally follow this order. Each task needs a short title, a one-to-two sentence \
description specific to this initiative (not generic boilerplate), the stage it belongs to, \
and a rough forecast in engineer-days. Use the record_task_breakdown tool to return your answer."""

TASK_BREAKDOWN_TOOL = {
    "name": "record_task_breakdown",
    "description": "Records the suggested task breakdown for the initiative.",
    "input_schema": {
        "type": "object",
        "properties": {
            "tasks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "stage": {
                            "type": "string",
                            "enum": [s.value for s in TaskStage],
                        },
                        "forecast_duration_days": {"type": "number"},
                    },
                    "required": ["title", "description", "stage", "forecast_duration_days"],
                },
            }
        },
        "required": ["tasks"],
    },
}


@dataclass
class SuggestedTask:
    title: str
    description: str
    stage: TaskStage
    forecast_duration_days: float
    sequence_order: int


class AiBreakdownError(RuntimeError):
    pass


def _build_user_prompt(initiative, category_name: str | None) -> str:
    lines = [
        f"Title: {initiative.title}",
        f"Description: {initiative.description or 'N/A'}",
        f"Business goal: {initiative.business_goal or 'N/A'}",
        f"Jira number: {initiative.jira_number or 'N/A'}",
        f"Start date: {initiative.start_date or 'N/A'}",
        f"Expected delivery date: {initiative.expected_delivery_date or 'N/A'}",
        f"Priority: {initiative.priority.value if initiative.priority else 'N/A'}",
        f"Complexity: {initiative.complexity.value if initiative.complexity else 'N/A'}",
    ]
    if category_name:
        lines.append(f"Platform initiative category: {category_name}")
    return "\n".join(lines)


class TaskBreakdownService:
    def __init__(self, client: anthropic.Anthropic | None = None):
        if client is not None:
            self._client = client
        elif settings.anthropic_api_key:
            self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        else:
            self._client = None

    def generate(self, initiative, category_name: str | None = None) -> tuple[list[SuggestedTask], object]:
        """Returns (suggested_tasks, raw_response) - the raw response is handed back so
        the caller can persist it to ai_breakdown_requests for debuggability."""
        if self._client is None:
            raise AiBreakdownError("ANTHROPIC_API_KEY is not configured")

        response = self._client.messages.create(
            model=settings.anthropic_model,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            tools=[TASK_BREAKDOWN_TOOL],
            tool_choice={"type": "tool", "name": "record_task_breakdown"},
            messages=[{"role": "user", "content": _build_user_prompt(initiative, category_name)}],
        )

        tool_use_block = next((b for b in response.content if b.type == "tool_use"), None)
        if tool_use_block is None:
            raise AiBreakdownError("Claude did not return a tool_use block with the task breakdown")

        raw_tasks = tool_use_block.input.get("tasks", [])
        tasks = [
            SuggestedTask(
                title=t["title"],
                description=t["description"],
                stage=TaskStage(t["stage"]),
                forecast_duration_days=float(t["forecast_duration_days"]),
                sequence_order=i,
            )
            for i, t in enumerate(raw_tasks)
        ]
        return tasks, response

    @staticmethod
    def serialize_raw_response(response) -> str:
        return json.dumps(response.model_dump() if hasattr(response, "model_dump") else str(response))


def generate_and_persist_breakdown(
    db: Session,
    initiative: Initiative,
    default_owner_engineer_id: int,
    category_name: str | None = None,
    service: TaskBreakdownService | None = None,
) -> list[Task]:
    """Calls the AI breakdown service and persists the result as editable Task rows
    (is_ai_generated=True), continuing sequence_order after any existing tasks. Also
    logs the raw response to ai_breakdown_requests for debuggability.
    """
    service = service or TaskBreakdownService()

    max_order = (
        db.query(Task.sequence_order)
        .filter(Task.initiative_id == initiative.id)
        .order_by(Task.sequence_order.desc())
        .first()
    )
    next_order = (max_order[0] + 1) if max_order else 0

    try:
        suggested_tasks, raw_response = service.generate(initiative, category_name)
    except AiBreakdownError as exc:
        db.add(
            AiBreakdownRequest(
                initiative_id=initiative.id,
                model_used=settings.anthropic_model,
                raw_response_json=json.dumps({"error": str(exc)}),
                status="FAILED",
            )
        )
        db.commit()
        raise

    created_tasks = []
    for suggestion in suggested_tasks:
        task = Task(
            initiative_id=initiative.id,
            title=suggestion.title,
            description=suggestion.description,
            stage=suggestion.stage,
            owner_engineer_id=default_owner_engineer_id,
            forecast_duration_days=suggestion.forecast_duration_days,
            sequence_order=next_order + suggestion.sequence_order,
            is_ai_generated=True,
        )
        db.add(task)
        created_tasks.append(task)

    db.add(
        AiBreakdownRequest(
            initiative_id=initiative.id,
            model_used=settings.anthropic_model,
            raw_response_json=TaskBreakdownService.serialize_raw_response(raw_response),
            status="SUCCESS",
        )
    )
    db.commit()
    for task in created_tasks:
        db.refresh(task)
    return created_tasks
