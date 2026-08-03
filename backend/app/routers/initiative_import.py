from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.auth_context import Actor, get_current_actor, require_manager
from app.schemas.jira_import import JiraImportPreview
from app.services.jira_import import JiraImportError, parse_jira_issue_xml

router = APIRouter(tags=["initiative-import"])

# A single-issue Jira export is a few KB to a few hundred KB - 5 MB is generous headroom.
_MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024


@router.post("/api/initiatives/import/jira-xml/preview", response_model=JiraImportPreview)
async def preview_jira_xml_import(
    file: UploadFile = File(...),
    actor: Actor = Depends(get_current_actor),
):
    """Parses a Jira single-issue XML export into a field preview. Doesn't create
    anything - the caller reviews/edits the result and then creates either a KBI or a
    Platform Initiative via the existing create endpoints for whichever type they pick.
    """
    require_manager(actor)
    contents = await file.read(_MAX_IMPORT_FILE_SIZE + 1)
    if len(contents) > _MAX_IMPORT_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File is too large for a single-issue export (max 5 MB)")
    try:
        parsed = parse_jira_issue_xml(contents)
    except JiraImportError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return JiraImportPreview(
        jira_number=parsed.jira_number,
        title=parsed.title,
        description=parsed.description,
        business_goal=parsed.business_goal,
        start_date=parsed.start_date,
        expected_delivery_date=parsed.expected_delivery_date,
        priority=parsed.priority,
        suggested_status=parsed.suggested_status,
        skipped_linked_issues=parsed.skipped_linked_issues,
    )
