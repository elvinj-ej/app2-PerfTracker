from datetime import date

from app.services.fiscal_year import (
    current_fiscal_year_label,
    fiscal_year_bounds,
    fiscal_year_label,
    fiscal_week_index,
    week_start,
)


def test_july_first_starts_new_fiscal_year():
    assert fiscal_year_label(date(2025, 7, 1)) == "FY25-26"


def test_june_30_belongs_to_previous_fiscal_year_start():
    assert fiscal_year_label(date(2026, 6, 30)) == "FY25-26"


def test_july_1_and_june_30_are_different_fiscal_years_across_the_boundary():
    assert fiscal_year_label(date(2025, 6, 30)) != fiscal_year_label(date(2025, 7, 1))


def test_fiscal_year_bounds_roundtrip():
    start, end = fiscal_year_bounds("FY25-26")
    assert start == date(2025, 7, 1)
    assert end == date(2026, 6, 30)


def test_current_fiscal_year_label_uses_today_by_default():
    assert current_fiscal_year_label(date(2026, 8, 3)) == "FY26-27"


def test_week_start_is_monday_aligned():
    # 2026-08-03 is a Monday
    assert week_start(date(2026, 8, 5)) == date(2026, 8, 3)
    assert week_start(date(2026, 8, 3)) == date(2026, 8, 3)


def test_fiscal_week_index_first_week_is_1():
    assert fiscal_week_index(date(2025, 7, 1)) == 1
