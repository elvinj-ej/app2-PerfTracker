import io

import pytest
from openpyxl import Workbook

from app.models.enums import InitiativeType
from app.services.ask_catalog_import import (
    AskCatalogImportError,
    classify_category,
    parse_ask_catalog_workbook,
)


def _workbook_bytes(rows: list[list]) -> bytes:
    wb = Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


HEADER = ["Category", "Ask", "By Date", "Outcome 1", "Outcome 2"]


def test_classify_category_by_prefix():
    assert classify_category("Run Patching") == InitiativeType.RECURRING_OPS
    assert classify_category("Change Platform - UPS") == InitiativeType.PLATFORM
    assert classify_category("Change Business - Amplify") == InitiativeType.KBI
    assert classify_category("People") is None


def test_parses_valid_rows_with_outcomes():
    contents = _workbook_bytes(
        [
            HEADER,
            ["Run Patching", "Monthly - Windows OS patching", "By end of month", None, None],
            ["Change Platform - UPS", "Refresh UPSes", "By end of year", "UPS-01", "UPS-02"],
        ]
    )
    parsed = parse_ask_catalog_workbook(contents)
    assert len(parsed.valid_rows) == 2
    run_row, platform_row = parsed.valid_rows
    assert run_row.initiative_type == InitiativeType.RECURRING_OPS
    assert run_row.outcomes == []
    assert platform_row.initiative_type == InitiativeType.PLATFORM
    assert platform_row.outcomes == ["UPS-01", "UPS-02"]
    assert platform_row.expected_delivery_date is not None


def test_unclassified_category_is_flagged_not_created():
    contents = _workbook_bytes([HEADER, ["People", "Some Ask", None, None, None]])
    parsed = parse_ask_catalog_workbook(contents)
    assert len(parsed.valid_rows) == 0
    assert len(parsed.invalid_rows) == 1
    assert "skipped" in parsed.invalid_rows[0].warnings[0]


def test_section_header_sentinel_rows_are_skipped():
    contents = _workbook_bytes(
        [
            HEADER,
            ["RUN", "RUN", None, None, None],
            ["CHANGE PLATFORM", "CHANGE PLATFORM", None, None, None],
            ["Run Patching", "Real ask", "By end of month", None, None],
        ]
    )
    parsed = parse_ask_catalog_workbook(contents)
    assert len(parsed.rows) == 1
    assert parsed.rows[0].ask == "Real ask"


def test_blank_rows_are_skipped():
    contents = _workbook_bytes([HEADER, [None, None, None, None, None], ["Run Patching", "Real ask", None, None, None]])
    parsed = parse_ask_catalog_workbook(contents)
    assert len(parsed.rows) == 1


def test_missing_ask_is_flagged():
    contents = _workbook_bytes([HEADER, ["Run Patching", None, None, "orphan outcome", None]])
    parsed = parse_ask_catalog_workbook(contents)
    assert len(parsed.invalid_rows) == 1
    assert "Missing an Ask" in parsed.invalid_rows[0].warnings[0]


def test_duplicate_ask_titles_are_flagged_but_still_parsed():
    contents = _workbook_bytes(
        [
            HEADER,
            ["Run Patching", "Same ask", None, None, None],
            ["Run Patching", "Same ask", None, None, None],
        ]
    )
    parsed = parse_ask_catalog_workbook(contents)
    assert len(parsed.valid_rows) == 2
    assert parsed.valid_rows[0].warnings == []
    assert "Duplicate" in parsed.valid_rows[1].warnings[0]


def test_missing_required_headers_raises():
    contents = _workbook_bytes([["Foo", "Bar"], ["a", "b"]])
    with pytest.raises(AskCatalogImportError):
        parse_ask_catalog_workbook(contents)


def test_category_header_variant_is_recognized():
    contents = _workbook_bytes(
        [
            ["Category - Initiative", "Ask", "By Date"],
            ["Run Patching", "Real ask", "By end of quarter"],
        ]
    )
    parsed = parse_ask_catalog_workbook(contents)
    assert len(parsed.valid_rows) == 1
