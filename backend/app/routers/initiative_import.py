from fastapi import APIRouter, Depends, Header, HTTPException

from app.config import settings
from app.core.auth_context import Actor, get_current_actor, require_manager
from app.schemas.jira_import import JiraIssueLookup, JiraIssuePreview
from app.services.jira_api_client import JiraImportError, extract_issue_key, fetch_issue, parse_jira_issue

router = APIRouter(tags=["initiative-import"])


@router.post("/api/initiatives/import/jira/preview", response_model=JiraIssuePreview)
def preview_jira_issue(
    payload: JiraIssueLookup,
    x_jira_token: str = Header(..., alias="X-Jira-Token"),
    actor: Actor = Depends(get_current_actor),
):
    """Live-fetches a Jira issue (by pasted URL or bare key) via the REST API and
    classifies it as a new Ask (Initiative) or a new Outcome (Epic/Story). Doesn't
    create anything - the caller reviews/edits the result and creates it via the
    existing KBI/Platform/Task endpoints, same review-before-create flow the old
    file-upload importer used.
    """
    require_manager(actor)
    try:
        issue_key = extract_issue_key(payload.issue)
        raw = fetch_issue(settings.jira_base_url, x_jira_token, issue_key)
        parsed = parse_jira_issue(raw)
    except JiraImportError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return JiraIssuePreview(
        kind=parsed.kind,
        jira_number=parsed.jira_number,
        issue_type=parsed.issue_type,
        title=parsed.title,
        description=parsed.description,
        business_goal=parsed.business_goal,
        start_date=parsed.start_date,
        expected_delivery_date=parsed.expected_delivery_date,
        priority=parsed.priority,
        suggested_status=parsed.suggested_status,
        suggested_task_status=parsed.suggested_task_status,
        skipped_linked_issues=parsed.skipped_linked_issues,
    )
