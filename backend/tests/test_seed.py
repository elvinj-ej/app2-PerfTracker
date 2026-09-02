from datetime import date

from app.models import Initiative, KbiCategory, PlatformInitiativeCategory, RecurringOpsCategory
from app.models.enums import InitiativeType, Priority, RecurrenceType
from app.services.initiatives import query_by_type, to_kbi_read, to_platform_read, to_recurring_ops_read
from app.services.outcome_dates import validate_within_ask_timeline
from app.services.ask_parsing import (
    FY_END,
    FY_FEB_END,
    FY_H1_END,
    FY_Q1_END,
    infer_priority,
    parse_change_delivery,
    parse_run_cadence,
)
from app.services.seed import seed


def test_parse_run_cadence_maps_known_phrases():
    assert parse_run_cadence("By end of day") == RecurrenceType.DAILY
    assert parse_run_cadence("By end of month") == RecurrenceType.MONTHLY
    assert parse_run_cadence("By end of quarter") == RecurrenceType.QUARTERLY
    assert parse_run_cadence("By end of half year") == RecurrenceType.HALF_YEARLY
    assert parse_run_cadence("By end of year") == RecurrenceType.ANNUAL


def test_parse_run_cadence_falls_back_to_ad_hoc():
    assert parse_run_cadence(None) == RecurrenceType.AD_HOC
    assert parse_run_cadence("some unrelated note") == RecurrenceType.AD_HOC


def test_parse_change_delivery_maps_known_phrases_to_fy26_27_dates():
    assert parse_change_delivery("By end of quarter") == (FY_Q1_END, None)
    assert parse_change_delivery("By end of half year") == (FY_H1_END, None)
    assert parse_change_delivery("By end of year") == (FY_END, None)
    assert parse_change_delivery("By Feb") == (FY_FEB_END, None)


def test_parse_change_delivery_falls_back_to_fy_end_and_keeps_notes():
    assert parse_change_delivery(None) == (FY_END, None)
    assert parse_change_delivery("ChengDu Go Live") == (FY_END, "ChengDu Go Live")


def test_infer_priority_keyword_rules():
    assert infer_priority("Run IAM", "Half Year Access review of Hosting Platforms") == Priority.CRITICAL
    assert infer_priority("Change Platform - OS WINDOWS", "Update of Windows 2016 & 2019 Servers to 2025") == Priority.HIGH
    assert infer_priority("Change Platform - CommVault", 'Evaluate "updating immutability policy"') == Priority.LOW
    assert infer_priority("Change Business", "Sales Customer 360") == Priority.MEDIUM


def test_seed_loads_the_fy26_27_catalog_fully_unclaimed(db_session):
    seed(db_session)

    initiatives = db_session.query(Initiative).all()
    assert len(initiatives) == 84
    assert all(len(i.engineer_links) == 0 for i in initiatives)
    assert all(len(i.tasks) == 0 for i in initiatives)

    by_type = {t: 0 for t in InitiativeType}
    for i in initiatives:
        by_type[i.type] += 1
    assert by_type[InitiativeType.RECURRING_OPS] == 29
    assert by_type[InitiativeType.PLATFORM] == 31
    assert by_type[InitiativeType.KBI] == 24

    assert db_session.query(KbiCategory).count() > 0
    assert db_session.query(PlatformInitiativeCategory).count() > 0
    assert db_session.query(RecurringOpsCategory).count() > 0

    for kbi in (i for i in initiatives if i.type == InitiativeType.KBI):
        assert kbi.expected_delivery_date is not None
        validate_within_ask_timeline(None, None, kbi.start_date, kbi.expected_delivery_date)

    for platform in (i for i in initiatives if i.type == InitiativeType.PLATFORM):
        assert platform.expected_delivery_date is not None


def test_seed_is_safe_to_rerun(db_session):
    seed(db_session)
    seed(db_session)
    assert db_session.query(Initiative).count() == 84


def test_seeded_initiatives_all_serialize_through_their_read_schema(db_session):
    """Regression test: every seeded row must actually convert through the same
    to_*_read() path the API routers use - catches schema/service field mismatches
    (e.g. a required Read field the service forgets to populate) that a model-only
    check wouldn't."""
    seed(db_session)

    for i in query_by_type(db_session, InitiativeType.KBI).all():
        to_kbi_read(i)
    for i in query_by_type(db_session, InitiativeType.PLATFORM).all():
        to_platform_read(i)
    for i in query_by_type(db_session, InitiativeType.RECURRING_OPS).all():
        to_recurring_ops_read(i)
