"""Builds the aggregate views behind the Engineer Dashboard (and, in M6, the Team
Summary). Wraps services/completion.py with the DB queries needed to feed it real data.
"""

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models import Engineer, Initiative, PlatformInitiativeDetail, Task, TimeEntry
from app.models.enums import InitiativeType
from app.schemas.reporting import (
    CategoryHours,
    EngineerDashboard,
    EngineerHoursBreakdown,
    InitiativeSummary,
    TaskSummary,
    TeamSummary,
    WeeklyHours,
)
from app.services.completion import TaskLike, TimelineHealth, UpgradeUnitLike, compute_initiative_completion


def _task_hours_map(db: Session, task_ids: list[int]) -> dict[int, float]:
    if not task_ids:
        return {}
    rows = (
        db.query(TimeEntry.task_id, func.sum(TimeEntry.hours))
        .filter(TimeEntry.task_id.in_(task_ids))
        .group_by(TimeEntry.task_id)
        .all()
    )
    return {task_id: float(total) for task_id, total in rows}


def build_initiative_summary(initiative: Initiative, hours_by_task: dict[int, float]) -> InitiativeSummary:
    tasks = initiative.tasks
    task_likes = [
        TaskLike(
            status=t.status,
            forecast_duration_days=float(t.forecast_duration_days) if t.forecast_duration_days is not None else None,
        )
        for t in tasks
    ]

    upgrade_units = None
    category_name = None
    if initiative.type == InitiativeType.PLATFORM and initiative.platform_detail:
        category_name = initiative.platform_detail.category.name
        if initiative.platform_detail.category.is_upgrade_type:
            upgrade_units = [UpgradeUnitLike(status=u.status) for u in initiative.upgrade_units]

    result = compute_initiative_completion(
        tasks=task_likes,
        start_date=initiative.start_date,
        expected_delivery_date=initiative.expected_delivery_date,
        upgrade_units=upgrade_units,
    )

    total_hours = sum(hours_by_task.get(t.id, 0.0) for t in tasks)

    return InitiativeSummary(
        id=initiative.id,
        type=initiative.type,
        title=initiative.title,
        status=initiative.status.value,
        category_name=category_name,
        start_date=initiative.start_date,
        expected_delivery_date=initiative.expected_delivery_date,
        completion_pct=result.completion_pct,
        expected_pct=result.expected_pct,
        timeline_health=result.timeline_health,
        total_hours_logged=total_hours,
    )


def build_recurring_ops_summary(initiative: Initiative, hours_by_task: dict[int, float]) -> InitiativeSummary:
    total_hours = sum(hours_by_task.get(t.id, 0.0) for t in initiative.tasks)
    return InitiativeSummary(
        id=initiative.id,
        type=initiative.type,
        title=initiative.title,
        status=initiative.status.value,
        category_name=None,
        start_date=None,
        expected_delivery_date=None,
        completion_pct=None,
        expected_pct=None,
        timeline_health=TimelineHealth.NOT_APPLICABLE,
        total_hours_logged=total_hours,
    )


def _load_initiatives(db: Session, initiative_ids: list[int]) -> list[Initiative]:
    if not initiative_ids:
        return []
    return (
        db.query(Initiative)
        .filter(Initiative.id.in_(initiative_ids))
        .options(
            selectinload(Initiative.tasks),
            selectinload(Initiative.upgrade_units),
            selectinload(Initiative.platform_detail).selectinload(PlatformInitiativeDetail.category),
            selectinload(Initiative.recurring_ops_detail),
        )
        .all()
    )


def build_engineer_dashboard(db: Session, engineer: Engineer) -> EngineerDashboard:
    initiative_ids = [link.initiative_id for link in engineer.initiative_links]
    initiatives = _load_initiatives(db, initiative_ids)

    all_task_ids = [t.id for i in initiatives for t in i.tasks]
    hours_by_task = _task_hours_map(db, all_task_ids)

    kbis = [build_initiative_summary(i, hours_by_task) for i in initiatives if i.type == InitiativeType.KBI]
    platform_initiatives = [
        build_initiative_summary(i, hours_by_task) for i in initiatives if i.type == InitiativeType.PLATFORM
    ]
    recurring_ops = [
        build_recurring_ops_summary(i, hours_by_task) for i in initiatives if i.type == InitiativeType.RECURRING_OPS
    ]

    owned_tasks = (
        db.query(Task)
        .filter(Task.owner_engineer_id == engineer.id)
        .options(selectinload(Task.initiative))
        .all()
    )
    owned_hours_by_task = _task_hours_map(db, [t.id for t in owned_tasks])

    task_summaries = [
        TaskSummary(
            id=t.id,
            initiative_id=t.initiative_id,
            initiative_title=t.initiative.title,
            initiative_type=t.initiative.type,
            title=t.title,
            stage=t.stage,
            status=t.status,
            forecast_duration_days=(
                float(t.forecast_duration_days) if t.forecast_duration_days is not None else None
            ),
            actual_hours_logged=owned_hours_by_task.get(t.id, 0.0),
        )
        for t in owned_tasks
    ]

    weekly_rows = (
        db.query(TimeEntry.week_start_date, TimeEntry.fiscal_year_label, Initiative.type, func.sum(TimeEntry.hours))
        .join(Task, TimeEntry.task_id == Task.id)
        .join(Initiative, Task.initiative_id == Initiative.id)
        .filter(TimeEntry.engineer_id == engineer.id)
        .group_by(TimeEntry.week_start_date, TimeEntry.fiscal_year_label, Initiative.type)
        .order_by(TimeEntry.week_start_date)
        .all()
    )
    weekly_hours = [
        WeeklyHours(week_start_date=w, fiscal_year_label=fy, initiative_type=itype, hours=float(h))
        for w, fy, itype, h in weekly_rows
    ]

    return EngineerDashboard(
        engineer_id=engineer.id,
        engineer_name=engineer.name,
        kbis=kbis,
        platform_initiatives=platform_initiatives,
        recurring_ops=recurring_ops,
        tasks=task_summaries,
        weekly_hours=weekly_hours,
    )


def build_team_summary(db: Session) -> TeamSummary:
    initiatives = (
        db.query(Initiative)
        .options(
            selectinload(Initiative.tasks),
            selectinload(Initiative.upgrade_units),
            selectinload(Initiative.platform_detail).selectinload(PlatformInitiativeDetail.category),
            selectinload(Initiative.recurring_ops_detail),
        )
        .all()
    )

    all_task_ids = [t.id for i in initiatives for t in i.tasks]
    hours_by_task = _task_hours_map(db, all_task_ids)

    kbis = [build_initiative_summary(i, hours_by_task) for i in initiatives if i.type == InitiativeType.KBI]
    platform_initiatives = [
        build_initiative_summary(i, hours_by_task) for i in initiatives if i.type == InitiativeType.PLATFORM
    ]
    recurring_ops = [
        build_recurring_ops_summary(i, hours_by_task) for i in initiatives if i.type == InitiativeType.RECURRING_OPS
    ]

    category_rows = (
        db.query(Initiative.type, func.sum(TimeEntry.hours))
        .join(Task, TimeEntry.task_id == Task.id)
        .join(Initiative, Task.initiative_id == Initiative.id)
        .group_by(Initiative.type)
        .all()
    )
    hours_by_category = [CategoryHours(initiative_type=itype, hours=float(h)) for itype, h in category_rows]

    engineer_rows = (
        db.query(Engineer.id, Engineer.name, Initiative.type, func.sum(TimeEntry.hours))
        .join(TimeEntry, TimeEntry.engineer_id == Engineer.id)
        .join(Task, TimeEntry.task_id == Task.id)
        .join(Initiative, Task.initiative_id == Initiative.id)
        .group_by(Engineer.id, Engineer.name, Initiative.type)
        .order_by(Engineer.name)
        .all()
    )
    breakdown_by_engineer: dict[int, EngineerHoursBreakdown] = {}
    for engineer_id, engineer_name, itype, hours in engineer_rows:
        breakdown = breakdown_by_engineer.setdefault(
            engineer_id,
            EngineerHoursBreakdown(
                engineer_id=engineer_id, engineer_name=engineer_name, hours_by_type={}, total_hours=0.0
            ),
        )
        breakdown.hours_by_type[itype] = float(hours)
        breakdown.total_hours += float(hours)

    return TeamSummary(
        kbis=kbis,
        platform_initiatives=platform_initiatives,
        recurring_ops=recurring_ops,
        hours_by_category=hours_by_category,
        hours_by_engineer=sorted(breakdown_by_engineer.values(), key=lambda b: b.engineer_name),
    )
