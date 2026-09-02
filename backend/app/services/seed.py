"""Loads the Hosting & Platform team's real FY26-27 Ask catalog (see
`app/data/fy2627_asks.py`) as the tool's starting data: the named engineers, the
category lookups derived from the catalog, and every Ask as an unclaimed, marketplace-
ready initiative. Deliberately carries no seeded outcomes or opt-ins - engineers pick
their own Asks (and define their own Outcomes) from the Marketplace. Safe to re-run: it
clears and reloads rather than appending duplicates.

FY26-27 runs July 2026 - June 2027 (Cochlear's fiscal year). The catalog's "By Date"
column is free text ("by end of quarter", "by end of half year", ...) rather than a
concrete date, so the assumptions below turn it into a real one. They're intentionally
visible here (not buried) since a manager reviewing the loaded data will want to correct
any of them via the UI - every date this script assigns is editable afterward:

- Run Operations rows (recurring, no single deadline) get a RecurrenceType instead of a
  date: day->DAILY, month->MONTHLY, quarter->QUARTERLY, half year->HALF_YEARLY,
  year->ANNUAL.
- Change Platform / Change Business rows (one-time Asks) get a concrete
  `expected_delivery_date`:
    "by end of quarter"    -> FY26-27 Q1 end   (2026-09-30) - nearest quarter, since the
                                                                sheet doesn't say which one
    "by end of half year"  -> FY26-27 H1 end   (2026-12-31) - nearest half, same reasoning
    "by end of year"       -> FY26-27 end      (2027-06-30)
    "by Feb"                -> 2027-02-28       - the only February inside FY26-27
    anything else / blank  -> FY26-27 end      (2027-06-30), the catch-all backlog date
  A couple of rows carry a sub-detail note in column C instead of a date phrase (e.g.
  "ChengDu Go Live") - those fall into the blank/catch-all case and the note is folded
  into the description instead of parsed as a deadline.
- Priority is inferred from keywords in the category/Ask text: security, compliance,
  access-review, DR/backup/restore language -> CRITICAL; upgrade/retire/renewal/go-live/
  cost-control language -> HIGH; "evaluate"/"re-assess"/exploratory language -> LOW;
  everything else -> MEDIUM. This is a heuristic, not a judgment call from the business -
  re-prioritize freely once loaded.
"""

from datetime import date

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.data.fy2627_asks import BUSINESS_ROWS, PLATFORM_ROWS, RUN_ROWS
from app.models import (
    AiBreakdownRequest,
    Engineer,
    Initiative,
    InitiativeEngineer,
    KbiCategory,
    KbiDetail,
    PlatformInitiativeCategory,
    PlatformInitiativeDetail,
    RecurringOpsCategory,
    RecurringOpsDetail,
    Task,
    TimeEntry,
    UpgradeUnit,
)
from app.models.enums import InitiativeStatus, InitiativeType, Priority, RecurrenceType

FY_Q1_END = date(2026, 9, 30)
FY_H1_END = date(2026, 12, 31)
FY_END = date(2027, 6, 30)
FY_FEB_END = date(2027, 2, 28)

_RUN_CADENCE_BY_PHRASE = {
    "by end of day": RecurrenceType.DAILY,
    "by end of month": RecurrenceType.MONTHLY,
    "by end of quarter": RecurrenceType.QUARTERLY,
    "by end of half year": RecurrenceType.HALF_YEARLY,
    "by end of year": RecurrenceType.ANNUAL,
}

_CHANGE_DATE_BY_PHRASE = {
    "by end of quarter": FY_Q1_END,
    "by end of half year": FY_H1_END,
    "by end of year": FY_END,
    "by feb": FY_FEB_END,
}

_LOW_PRIORITY_KEYWORDS = ("evaluate", "re-asses", "re-assess", "set-up and deploy patterns")
_CRITICAL_PRIORITY_KEYWORDS = (
    "security",
    "vulnerab",
    "compliance",
    "sailpoint",
    "access review",
    "password reset",
    "dr test",
    "disaster",
    "backup",
    "restore",
    "audit",
)
_HIGH_PRIORITY_KEYWORDS = (
    "upgrade",
    "upgrde",
    "update of",
    "retire",
    "retirement",
    "renewal",
    "go live",
    "finops",
    "cost control",
    "patching",
)


def _parse_run_cadence(by_date: str | None) -> RecurrenceType:
    if by_date:
        cadence = _RUN_CADENCE_BY_PHRASE.get(by_date.strip().lower())
        if cadence is not None:
            return cadence
    return RecurrenceType.AD_HOC


def _parse_change_delivery(by_date: str | None) -> tuple[date, str | None]:
    """Returns (expected_delivery_date, extra_note). extra_note is folded into the
    initiative's description when column C held a sub-detail rather than a date phrase.
    """
    if not by_date:
        return FY_END, None
    known = _CHANGE_DATE_BY_PHRASE.get(by_date.strip().lower())
    if known is not None:
        return known, None
    return FY_END, by_date


def _infer_priority(category: str, ask: str) -> Priority:
    text = f"{category} {ask}".lower()
    if any(k in text for k in _LOW_PRIORITY_KEYWORDS):
        return Priority.LOW
    if any(k in text for k in _CRITICAL_PRIORITY_KEYWORDS):
        return Priority.CRITICAL
    if any(k in text for k in _HIGH_PRIORITY_KEYWORDS):
        return Priority.HIGH
    return Priority.MEDIUM


def _clear_all(db: Session) -> None:
    for model in (
        TimeEntry,
        UpgradeUnit,
        Task,
        InitiativeEngineer,
        AiBreakdownRequest,
        KbiDetail,
        PlatformInitiativeDetail,
        RecurringOpsDetail,
        Initiative,
        KbiCategory,
        PlatformInitiativeCategory,
        RecurringOpsCategory,
        Engineer,
    ):
        db.execute(delete(model))
    db.commit()


def _get_or_create_category(db: Session, cache: dict[str, object], model, name: str):
    category = cache.get(name)
    if category is None:
        category = model(name=name, sort_order=len(cache) + 1)
        db.add(category)
        db.flush()
        cache[name] = category
    return category


def seed(db: Session) -> None:
    _clear_all(db)

    engineers = [
        Engineer(name="David Raddoux", email="david.raddoux@example.com", title="Senior Systems Engineer"),
        Engineer(name="Junling Yu", email="junling.yu@example.com", title="Senior Systems Engineer"),
        Engineer(name="Luke Winters", email="luke.winters@example.com", title="Senior Systems Engineer"),
        Engineer(name="Mark Whittaker", email="mark.whittaker@example.com", title="Senior Systems Engineer"),
        Engineer(name="Mary Ghasemi", email="mary.ghasemi@example.com", title="Senior Systems Engineer"),
        Engineer(name="Mung Cheong Soh", email="mung.cheong.soh@example.com", title="Senior Systems Engineer"),
        Engineer(name="Ravi Shanker", email="ravi.shanker@example.com", title="Senior Systems Engineer"),
        Engineer(name="Stanley Lim", email="stanley.lim@example.com", title="Senior Systems Engineer"),
        Engineer(name="Jeff Tan", email="jeff.tan@example.com", title="Senior Systems Engineer"),
        Engineer(name="Nagalingam Subramaniam", email="nagalingam.subramaniam@example.com", title="Senior Systems Engineer"),
        Engineer(name="Kok Seong Ching", email="kok.seong.ching@example.com", title="Senior Systems Engineer"),
        Engineer(name="Huong Ping Ting", email="huong.ping.ting@example.com", title="Senior Systems Engineer"),
        Engineer(name="Hazwan Abd Wahid", email="hazwan.abd.wahid@example.com", title="Senior Systems Engineer"),
        Engineer(name="Syed Ferouq", email="syed.ferouq@example.com", title="Senior Systems Engineer"),
    ]
    db.add_all(engineers)
    db.flush()

    run_categories: dict[str, RecurringOpsCategory] = {}
    for category_name, ask, by_date in RUN_ROWS:
        category = _get_or_create_category(db, run_categories, RecurringOpsCategory, category_name)
        initiative = Initiative(
            type=InitiativeType.RECURRING_OPS,
            title=ask,
            priority=_infer_priority(category_name, ask),
            status=InitiativeStatus.OPEN,
        )
        db.add(initiative)
        db.flush()
        db.add(
            RecurringOpsDetail(
                initiative_id=initiative.id,
                category_id=category.id,
                recurrence_type=_parse_run_cadence(by_date),
                recurrence_interval=1,
            )
        )

    platform_categories: dict[str, PlatformInitiativeCategory] = {}
    for category_name, ask, by_date in PLATFORM_ROWS:
        category = _get_or_create_category(db, platform_categories, PlatformInitiativeCategory, category_name)
        delivery_date, note = _parse_change_delivery(by_date)
        initiative = Initiative(
            type=InitiativeType.PLATFORM,
            title=ask,
            description=note,
            expected_delivery_date=delivery_date,
            priority=_infer_priority(category_name, ask),
            status=InitiativeStatus.OPEN,
        )
        db.add(initiative)
        db.flush()
        db.add(PlatformInitiativeDetail(initiative_id=initiative.id, category_id=category.id))

    kbi_categories: dict[str, KbiCategory] = {}
    for category_name, ask, by_date in BUSINESS_ROWS:
        category = _get_or_create_category(db, kbi_categories, KbiCategory, category_name)
        delivery_date, note = _parse_change_delivery(by_date)
        initiative = Initiative(
            type=InitiativeType.KBI,
            title=ask,
            description=note,
            expected_delivery_date=delivery_date,
            priority=_infer_priority(category_name, ask),
            status=InitiativeStatus.OPEN,
        )
        db.add(initiative)
        db.flush()
        db.add(KbiDetail(initiative_id=initiative.id, category_id=category.id))

    db.commit()


def main() -> None:
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        seed(db)
        print("FY26-27 Ask catalog loaded.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
