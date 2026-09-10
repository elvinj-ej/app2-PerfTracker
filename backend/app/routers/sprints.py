from fastapi import APIRouter

from app.schemas.sprint import SprintRead
from app.services.sprint import list_sprints

router = APIRouter(tags=["sprints"])


@router.get("/api/sprints", response_model=list[SprintRead])
def get_sprints():
    return list_sprints()
