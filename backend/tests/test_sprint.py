from datetime import date

from app.services.sprint import (
    CYCLE_END,
    SPRINT_EPOCH,
    max_sprint_number,
    sprint_bounds,
    sprint_label,
    sprint_number_for_date,
)


def test_epoch_is_first_wednesday_of_july_2026():
    assert SPRINT_EPOCH == date(2026, 7, 1)
    assert SPRINT_EPOCH.weekday() == 2  # Wednesday


def test_sprint_bounds_s1_is_a_14_day_window_from_the_epoch():
    start, end = sprint_bounds(1)
    assert start == date(2026, 7, 1)
    assert end == date(2026, 7, 14)


def test_sprint_bounds_s2_starts_the_day_after_s1_ends():
    _, s1_end = sprint_bounds(1)
    s2_start, _ = sprint_bounds(2)
    assert s2_start == date(2026, 7, 15)
    assert s2_start > s1_end


def test_sprint_number_for_date_within_s1():
    assert sprint_number_for_date(date(2026, 7, 1)) == 1
    assert sprint_number_for_date(date(2026, 7, 14)) == 1
    assert sprint_number_for_date(date(2026, 7, 15)) == 2


def test_sprint_number_for_date_before_epoch_clamps_to_s1():
    assert sprint_number_for_date(date(2020, 1, 1)) == 1


def test_sprint_number_for_date_after_cycle_end_clamps_to_max():
    assert sprint_number_for_date(date(2030, 1, 1)) == max_sprint_number()


def test_max_sprint_number_bounds_land_on_or_before_cycle_end():
    n = max_sprint_number()
    start, _ = sprint_bounds(n)
    next_start, _ = sprint_bounds(n + 1)
    assert start <= CYCLE_END
    assert next_start > CYCLE_END


def test_sprint_label_format():
    assert sprint_label(1) == "S1"
    assert sprint_label(14) == "S14"
