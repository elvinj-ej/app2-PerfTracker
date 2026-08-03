"""Populates a handful of engineers, the platform category lookup, and sample
initiatives/tasks/time entries spanning the current fiscal year, for local dev/demo use.
Safe to re-run: it clears and reseeds rather than appending duplicates.
"""

from datetime import date, timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import (
    AiBreakdownRequest,
    Engineer,
    Initiative,
    InitiativeEngineer,
    PlatformInitiativeCategory,
    PlatformInitiativeDetail,
    RecurringOpsDetail,
    Task,
    TimeEntry,
    UpgradeUnit,
)
from app.models.enums import (
    Complexity,
    InitiativeStatus,
    InitiativeType,
    Priority,
    RecurrenceType,
    TaskStage,
    TaskStatus,
    UpgradeUnitStatus,
)
from app.services.fiscal_year import week_start


def _clear_all(db: Session) -> None:
    for model in (
        TimeEntry,
        UpgradeUnit,
        Task,
        InitiativeEngineer,
        AiBreakdownRequest,
        PlatformInitiativeDetail,
        RecurringOpsDetail,
        Initiative,
        PlatformInitiativeCategory,
        Engineer,
    ):
        db.execute(delete(model))
    db.commit()


def seed(db: Session) -> None:
    _clear_all(db)

    engineers = [
        Engineer(name="Priya Nandakumar", email="priya.nandakumar@example.com", title="Senior Systems Engineer"),
        Engineer(name="Marcus Fell", email="marcus.fell@example.com", title="Senior Systems Engineer"),
        Engineer(name="Aisha Okonkwo", email="aisha.okonkwo@example.com", title="Senior Systems Engineer"),
    ]
    db.add_all(engineers)
    db.flush()
    priya, marcus, aisha = engineers

    categories = [
        PlatformInitiativeCategory(name="SQL Upgrade", is_upgrade_type=True, sort_order=1),
        PlatformInitiativeCategory(name="Windows Server Upgrade", is_upgrade_type=True, sort_order=2),
        PlatformInitiativeCategory(name="VMware Upgrade", is_upgrade_type=True, sort_order=3),
        PlatformInitiativeCategory(name="Ops Manager Upgrade", is_upgrade_type=True, sort_order=4),
        PlatformInitiativeCategory(name="Improvement", is_upgrade_type=False, sort_order=5),
        PlatformInitiativeCategory(
            name="Out-of-Cycle Vulnerability Management", is_upgrade_type=False, sort_order=6
        ),
        PlatformInitiativeCategory(name="Automation", is_upgrade_type=False, sort_order=7),
    ]
    db.add_all(categories)
    db.flush()
    sql_upgrade_category = categories[0]
    automation_category = categories[6]

    today = date.today()

    # --- Sample KBI ---
    kbi = Initiative(
        type=InitiativeType.KBI,
        title="Customer Portal Migration to New Data Center",
        description="Migrate the customer-facing portal's backend infrastructure to the new data center.",
        business_goal="Reduce hosting costs and improve regional latency for APAC customers.",
        jira_number="CLOUD-1042",
        start_date=today - timedelta(days=30),
        expected_delivery_date=today + timedelta(days=60),
        priority=Priority.HIGH,
        complexity=Complexity.HIGH,
        status=InitiativeStatus.IN_PROGRESS,
    )
    db.add(kbi)
    db.flush()
    db.add_all(
        [
            InitiativeEngineer(initiative_id=kbi.id, engineer_id=priya.id),
            InitiativeEngineer(initiative_id=kbi.id, engineer_id=marcus.id),
        ]
    )

    kbi_tasks = [
        Task(
            initiative_id=kbi.id,
            title="High-Level Design for migration",
            stage=TaskStage.HLD,
            owner_engineer_id=priya.id,
            forecast_duration_days=5,
            status=TaskStatus.COMPLETE,
            sequence_order=0,
        ),
        Task(
            initiative_id=kbi.id,
            title="Low-Level Design: network + storage layout",
            stage=TaskStage.LLD,
            owner_engineer_id=priya.id,
            forecast_duration_days=8,
            status=TaskStatus.COMPLETE,
            sequence_order=1,
        ),
        Task(
            initiative_id=kbi.id,
            title="Solution Design approval sign-off",
            stage=TaskStage.SOLUTION_DESIGN_APPROVAL,
            owner_engineer_id=marcus.id,
            forecast_duration_days=3,
            status=TaskStatus.IN_PROGRESS,
            sequence_order=2,
        ),
        Task(
            initiative_id=kbi.id,
            title="Non-prod deployment and validation",
            stage=TaskStage.NON_PROD_DEPLOYMENT,
            owner_engineer_id=marcus.id,
            forecast_duration_days=10,
            status=TaskStatus.NOT_STARTED,
            sequence_order=3,
        ),
        Task(
            initiative_id=kbi.id,
            title="Production deployment and cutover",
            stage=TaskStage.PROD_DEPLOYMENT,
            owner_engineer_id=priya.id,
            forecast_duration_days=6,
            status=TaskStatus.NOT_STARTED,
            sequence_order=4,
        ),
    ]
    db.add_all(kbi_tasks)
    db.flush()

    week1 = week_start(today - timedelta(days=14))
    week2 = week_start(today - timedelta(days=7))
    for wk in (week1, week2):
        db.add(
            TimeEntry(
                task_id=kbi_tasks[0].id,
                engineer_id=priya.id,
                week_start_date=wk,
                fiscal_year_label=_fy_label(wk),
                hours=16,
            )
        )
        db.add(
            TimeEntry(
                task_id=kbi_tasks[2].id,
                engineer_id=marcus.id,
                week_start_date=wk,
                fiscal_year_label=_fy_label(wk),
                hours=10,
            )
        )

    # --- Sample Platform Initiative (upgrade type) ---
    platform = Initiative(
        type=InitiativeType.PLATFORM,
        title="Q3 SQL Server Fleet Upgrade",
        description="Upgrade all production SQL Server instances to the latest supported version.",
        business_goal="Maintain vendor support and close known CVEs.",
        start_date=today - timedelta(days=10),
        expected_delivery_date=today + timedelta(days=40),
        priority=Priority.MEDIUM,
        complexity=Complexity.MEDIUM,
        status=InitiativeStatus.IN_PROGRESS,
    )
    db.add(platform)
    db.flush()
    db.add(PlatformInitiativeDetail(initiative_id=platform.id, category_id=sql_upgrade_category.id))
    db.add(InitiativeEngineer(initiative_id=platform.id, engineer_id=aisha.id))

    db.add_all(
        [
            UpgradeUnit(initiative_id=platform.id, system_name="SQL-PROD-01", system_type="SQL Server 2019",
                        status=UpgradeUnitStatus.COMPLETE, completed_date=today - timedelta(days=5)),
            UpgradeUnit(initiative_id=platform.id, system_name="SQL-PROD-02", system_type="SQL Server 2019",
                        status=UpgradeUnitStatus.IN_PROGRESS),
            UpgradeUnit(initiative_id=platform.id, system_name="SQL-PROD-03", system_type="SQL Server 2019",
                        status=UpgradeUnitStatus.NOT_STARTED),
            UpgradeUnit(initiative_id=platform.id, system_name="SQL-PROD-04", system_type="SQL Server 2019",
                        status=UpgradeUnitStatus.NOT_STARTED),
        ]
    )
    platform_task = Task(
        initiative_id=platform.id,
        title="Coordinate maintenance windows with app owners",
        stage=TaskStage.OTHER,
        owner_engineer_id=aisha.id,
        forecast_duration_days=2,
        status=TaskStatus.COMPLETE,
        sequence_order=0,
    )
    db.add(platform_task)
    db.flush()
    db.add(
        TimeEntry(
            task_id=platform_task.id,
            engineer_id=aisha.id,
            week_start_date=week2,
            fiscal_year_label=_fy_label(week2),
            hours=6,
        )
    )

    # --- Sample Platform Initiative (automation, non-upgrade) ---
    automation = Initiative(
        type=InitiativeType.PLATFORM,
        title="Automate Patch Compliance Reporting",
        description="Build an automated pipeline that reports patch compliance status across the fleet weekly.",
        business_goal="Cut manual reporting effort and improve audit readiness.",
        start_date=today - timedelta(days=5),
        expected_delivery_date=today + timedelta(days=45),
        priority=Priority.MEDIUM,
        complexity=Complexity.LOW,
        status=InitiativeStatus.OPEN,
    )
    db.add(automation)
    db.flush()
    db.add(PlatformInitiativeDetail(initiative_id=automation.id, category_id=automation_category.id))
    db.add(InitiativeEngineer(initiative_id=automation.id, engineer_id=marcus.id))

    # --- Sample Recurring Ops initiatives ---
    monthly_patching = Initiative(
        type=InitiativeType.RECURRING_OPS,
        title="Monthly Patching - Windows Fleet",
        description="Routine monthly OS patching across the Windows server fleet.",
        status=InitiativeStatus.OPEN,
    )
    db.add(monthly_patching)
    db.flush()
    db.add(
        RecurringOpsDetail(
            initiative_id=monthly_patching.id,
            recurrence_type=RecurrenceType.MONTHLY,
            recurrence_interval=1,
        )
    )
    db.add(InitiativeEngineer(initiative_id=monthly_patching.id, engineer_id=aisha.id))
    patch_task = Task(
        initiative_id=monthly_patching.id,
        title=f"Patch cycle - {today.strftime('%B %Y')}",
        owner_engineer_id=aisha.id,
        status=TaskStatus.IN_PROGRESS,
        sequence_order=0,
    )
    db.add(patch_task)
    db.flush()
    db.add(
        TimeEntry(
            task_id=patch_task.id,
            engineer_id=aisha.id,
            week_start_date=week2,
            fiscal_year_label=_fy_label(week2),
            hours=8,
        )
    )

    annual_reset = Initiative(
        type=InitiativeType.RECURRING_OPS,
        title="Annual Password Reset",
        description="Enforced annual password rotation for privileged service accounts.",
        status=InitiativeStatus.OPEN,
    )
    db.add(annual_reset)
    db.flush()
    db.add(
        RecurringOpsDetail(
            initiative_id=annual_reset.id,
            recurrence_type=RecurrenceType.ANNUAL,
            recurrence_interval=1,
            anchor_month=7,
            anchor_day=1,
        )
    )
    db.add(InitiativeEngineer(initiative_id=annual_reset.id, engineer_id=priya.id))

    db.commit()


def _fy_label(d: date) -> str:
    from app.services.fiscal_year import fiscal_year_label

    return fiscal_year_label(d)


def main() -> None:
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        seed(db)
        print("Seed data loaded.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
