"""Timezone-aware dates shared by conversation and appointment scheduling."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo


class SchedulingDateError(ValueError):
    """Raised when a scheduling date is not today, tomorrow, or ISO-8601."""


@dataclass(frozen=True)
class SchedulingDateContext:
    timezone: str
    today: date
    tomorrow: date


def get_scheduling_date_context(
    timezone_name: str, now: datetime | None = None
) -> SchedulingDateContext:
    """Calculate calendar dates in the configured business timezone.

    Passing ``now`` keeps the calculation deterministic in tests. Naive values are
    treated as timestamps already expressed in the configured business timezone.
    """
    timezone = ZoneInfo(timezone_name)
    if now is None:
        local_now = datetime.now(timezone)
    elif now.tzinfo is None:
        local_now = now.replace(tzinfo=timezone)
    else:
        local_now = now.astimezone(timezone)

    today = local_now.date()
    return SchedulingDateContext(
        timezone=timezone_name,
        today=today,
        tomorrow=today + timedelta(days=1),
    )


def resolve_scheduling_date(
    value: str, timezone_name: str, now: datetime | None = None
) -> str:
    """Resolve relative scheduling dates to ISO dates in one shared timezone."""
    normalized = (value or "").strip().lower()
    context = get_scheduling_date_context(timezone_name, now=now)
    if normalized == "today":
        return context.today.isoformat()
    if normalized == "tomorrow":
        return context.tomorrow.isoformat()

    try:
        parsed = date.fromisoformat(normalized)
    except ValueError as exc:
        raise SchedulingDateError(
            "Date must be 'today', 'tomorrow', or YYYY-MM-DD."
        ) from exc
    if parsed.isoformat() != normalized:
        raise SchedulingDateError("Date must be 'today', 'tomorrow', or YYYY-MM-DD.")
    return parsed.isoformat()
