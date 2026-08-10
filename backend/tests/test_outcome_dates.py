from datetime import date

import pytest

from app.services.outcome_dates import (
    OutcomeDateError,
    next_wednesday_on_or_after,
    sequential_wednesday_windows,
    validate_delivery_span,
    validate_within_ask_timeline,
)

WEDNESDAY = date(2026, 8, 5)
THURSDAY = date(2026, 8, 6)


def test_validate_delivery_span_accepts_two_wednesdays_two_weeks_apart():
    validate_delivery_span(WEDNESDAY, date(2026, 8, 19))


def test_validate_delivery_span_rejects_non_wednesday_start():
    with pytest.raises(OutcomeDateError, match="start_date must fall on a Wednesday"):
        validate_delivery_span(THURSDAY, date(2026, 8, 19))


def test_validate_delivery_span_rejects_non_wednesday_delivery():
    with pytest.raises(OutcomeDateError, match="delivery_date must fall on a Wednesday"):
        validate_delivery_span(WEDNESDAY, date(2026, 8, 20))


def test_validate_delivery_span_rejects_span_over_two_weeks():
    with pytest.raises(OutcomeDateError, match="within 14 days"):
        validate_delivery_span(WEDNESDAY, date(2026, 8, 26))


def test_validate_delivery_span_rejects_delivery_before_start():
    with pytest.raises(OutcomeDateError, match="on or after start_date"):
        validate_delivery_span(date(2026, 8, 19), WEDNESDAY)


def test_validate_delivery_span_allows_missing_dates():
    validate_delivery_span(None, None)
    validate_delivery_span(WEDNESDAY, None)
    validate_delivery_span(None, WEDNESDAY)


def test_next_wednesday_on_or_after_wednesday_is_itself():
    assert next_wednesday_on_or_after(WEDNESDAY) == WEDNESDAY


def test_next_wednesday_on_or_after_thursday_rolls_to_next_week():
    assert next_wednesday_on_or_after(THURSDAY) == date(2026, 8, 12)


def test_sequential_wednesday_windows_are_chained_and_valid():
    windows = sequential_wednesday_windows(date(2026, 8, 3), 3)
    assert windows == [
        (date(2026, 8, 5), date(2026, 8, 19)),
        (date(2026, 8, 19), date(2026, 9, 2)),
        (date(2026, 9, 2), date(2026, 9, 16)),
    ]
    for start, delivery in windows:
        validate_delivery_span(start, delivery)


def test_validate_within_ask_timeline_accepts_dates_inside_the_ask_window():
    validate_within_ask_timeline(WEDNESDAY, date(2026, 8, 19), date(2026, 8, 1), date(2026, 9, 30))


def test_validate_within_ask_timeline_rejects_outcome_starting_before_the_ask():
    with pytest.raises(OutcomeDateError, match="can't be before the Ask's own start date"):
        validate_within_ask_timeline(WEDNESDAY, date(2026, 8, 19), date(2026, 8, 10), date(2026, 9, 30))


def test_validate_within_ask_timeline_rejects_outcome_delivered_after_the_ask():
    with pytest.raises(OutcomeDateError, match="can't be later than the Ask's own delivery date"):
        validate_within_ask_timeline(WEDNESDAY, date(2026, 8, 19), date(2026, 8, 1), date(2026, 8, 12))


def test_validate_within_ask_timeline_is_a_noop_when_the_ask_has_no_dates():
    validate_within_ask_timeline(WEDNESDAY, date(2026, 8, 19), None, None)
