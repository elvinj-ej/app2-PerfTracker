"""Date rules for Outcomes (the engineer/AI-defined breakdown of a KBI's "Ask").

Every Outcome's start_date and delivery_date must land on a Wednesday, and a delivery
must follow within two weeks of its start - if a piece of work is too big for that, the
engineer is expected to split it into multiple sequential two-week Outcomes rather than
extend the window.
"""

from datetime import date, timedelta

MAX_DELIVERY_SPAN_DAYS = 14
_WEDNESDAY = 2  # date.weekday(): Monday=0 ... Sunday=6


class OutcomeDateError(ValueError):
    pass


def _validate_wednesday(d: date, field_name: str) -> None:
    if d.weekday() != _WEDNESDAY:
        raise OutcomeDateError(f"{field_name} must fall on a Wednesday")


def validate_delivery_span(start_date: date | None, delivery_date: date | None) -> None:
    """Validates whichever of start_date/delivery_date is present. Both are optional -
    Recurring Ops outcomes and not-yet-scheduled outcomes may have neither - but the
    two-week span is only checked when both are given.
    """
    if start_date is not None:
        _validate_wednesday(start_date, "start_date")
    if delivery_date is not None:
        _validate_wednesday(delivery_date, "delivery_date")
    if start_date is not None and delivery_date is not None:
        span = (delivery_date - start_date).days
        if span < 0:
            raise OutcomeDateError("delivery_date must be on or after start_date")
        if span > MAX_DELIVERY_SPAN_DAYS:
            raise OutcomeDateError(
                f"delivery_date must be within {MAX_DELIVERY_SPAN_DAYS} days of start_date - "
                "split this outcome into smaller two-week deliveries instead"
            )


def next_wednesday_on_or_after(d: date) -> date:
    return d + timedelta(days=(_WEDNESDAY - d.weekday()) % 7)


def sequential_wednesday_windows(anchor_date: date, count: int) -> list[tuple[date, date]]:
    """Deterministically assigns `count` sequential, non-overlapping two-week
    Wednesday-to-Wednesday windows starting on or after anchor_date. Used to give
    AI-generated outcomes valid dates without trusting the LLM to do date math.
    """
    start = next_wednesday_on_or_after(anchor_date)
    windows = []
    for _ in range(count):
        delivery = start + timedelta(days=MAX_DELIVERY_SPAN_DAYS)
        windows.append((start, delivery))
        start = delivery
    return windows
