"""Shared helpers for the three initiative-type routers (KBI / Platform / Recurring Ops),
which all sit on the single `initiatives` STI table (see models/initiative.py). Each
router builds its own Read schema explicitly here since the flattened fields (category,
recurrence info, engineer_ids) live on related tables/join tables, not directly on the
Initiative row itself.
"""

from sqlalchemy.orm import Session, selectinload

from app.models import Initiative, InitiativeEngineer, KbiDetail, PlatformInitiativeDetail, RecurringOpsDetail
from app.models.enums import InitiativeType
from app.schemas.initiative import KbiRead, PlatformInitiativeRead, RecurringOpsRead
from app.schemas.kbi_category import KbiCategoryRead
from app.schemas.platform_category import PlatformInitiativeCategoryRead
from app.schemas.recurring_ops_category import RecurringOpsCategoryRead


def query_by_type(db: Session, type_: InitiativeType):
    return (
        db.query(Initiative)
        .filter(Initiative.type == type_)
        .options(
            selectinload(Initiative.engineer_links),
            selectinload(Initiative.kbi_detail).selectinload(KbiDetail.category),
            selectinload(Initiative.platform_detail).selectinload(PlatformInitiativeDetail.category),
            selectinload(Initiative.recurring_ops_detail).selectinload(RecurringOpsDetail.category),
        )
    )


def engineer_ids(initiative: Initiative) -> list[int]:
    return [link.engineer_id for link in initiative.engineer_links]


def opt_in(db: Session, initiative_id: int, engineer_id: int) -> None:
    existing = db.get(InitiativeEngineer, (initiative_id, engineer_id))
    if existing is None:
        db.add(InitiativeEngineer(initiative_id=initiative_id, engineer_id=engineer_id))
        db.commit()


def opt_out(db: Session, initiative_id: int, engineer_id: int) -> None:
    existing = db.get(InitiativeEngineer, (initiative_id, engineer_id))
    if existing is not None:
        db.delete(existing)
        db.commit()


def _base_fields(initiative: Initiative) -> dict:
    return dict(
        id=initiative.id,
        type=initiative.type,
        title=initiative.title,
        description=initiative.description,
        business_goal=initiative.business_goal,
        jira_number=initiative.jira_number,
        start_date=initiative.start_date,
        expected_delivery_date=initiative.expected_delivery_date,
        priority=initiative.priority,
        complexity=initiative.complexity,
        status=initiative.status,
    )


def to_kbi_read(initiative: Initiative) -> KbiRead:
    return KbiRead(
        **_base_fields(initiative),
        ask=initiative.ask,
        category=KbiCategoryRead.model_validate(initiative.kbi_detail.category),
        engineer_ids=engineer_ids(initiative),
    )


def to_platform_read(initiative: Initiative) -> PlatformInitiativeRead:
    return PlatformInitiativeRead(
        **_base_fields(initiative),
        category=PlatformInitiativeCategoryRead.model_validate(initiative.platform_detail.category),
        engineer_ids=engineer_ids(initiative),
    )


def to_recurring_ops_read(initiative: Initiative) -> RecurringOpsRead:
    detail = initiative.recurring_ops_detail
    return RecurringOpsRead(
        id=initiative.id,
        type=initiative.type,
        title=initiative.title,
        description=initiative.description,
        status=initiative.status,
        priority=initiative.priority,
        category=RecurringOpsCategoryRead.model_validate(detail.category),
        recurrence_type=detail.recurrence_type,
        recurrence_interval=detail.recurrence_interval,
        anchor_month=detail.anchor_month,
        anchor_day=detail.anchor_day,
        engineer_ids=engineer_ids(initiative),
    )
