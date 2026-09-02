from app.models import Initiative, Task
from app.models.enums import InitiativeStatus, InitiativeType


def test_task_can_be_created_without_an_owner(db_session):
    initiative = Initiative(type=InitiativeType.PLATFORM, title="Some Ask", status=InitiativeStatus.OPEN)
    db_session.add(initiative)
    db_session.flush()

    task = Task(initiative_id=initiative.id, title="Unowned outcome", owner_engineer_id=None)
    db_session.add(task)
    db_session.commit()

    db_session.refresh(task)
    assert task.owner_engineer_id is None
