from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.services.date_service import (
    SchedulingDateError,
    get_scheduling_date_context,
    resolve_scheduling_date,
)
from app.tools.registry import AgentToolDispatcher


def test_today_and_tomorrow_use_asia_kolkata_calendar_date():
    # 11:30 IST on November 25: tomorrow must be November 26, not November 27.
    instant = datetime(2026, 11, 25, 6, 0, tzinfo=timezone.utc)
    context = get_scheduling_date_context("Asia/Kolkata", now=instant)

    assert context.today.isoformat() == "2026-11-25"
    assert context.tomorrow.isoformat() == "2026-11-26"
    assert resolve_scheduling_date("today", "Asia/Kolkata", now=instant) == "2026-11-25"
    assert resolve_scheduling_date("tomorrow", "Asia/Kolkata", now=instant) == "2026-11-26"


def test_timezone_boundary_and_explicit_dates_are_preserved():
    # This UTC instant is already November 26 in Kolkata.
    instant = datetime(2026, 11, 25, 18, 45, tzinfo=timezone.utc)
    assert resolve_scheduling_date("tomorrow", "Asia/Kolkata", now=instant) == "2026-11-27"
    assert resolve_scheduling_date("2026-12-15", "Asia/Kolkata", now=instant) == "2026-12-15"


@pytest.mark.parametrize("value", ["", "next week", "2026/11/26", "2026-02-30"])
def test_invalid_scheduling_dates_are_rejected(value):
    with pytest.raises(SchedulingDateError):
        resolve_scheduling_date(value, "Asia/Kolkata")


def test_availability_and_booking_tools_resolve_the_same_relative_date(monkeypatch):
    dispatcher = AgentToolDispatcher(
        conversation_manager=SimpleNamespace(
            get_lead_for_session=lambda _db, _session_id: SimpleNamespace(id=42)
        ),
        timezone_name="Asia/Kolkata",
    )
    captured_dates = []

    def fake_slots(_db, scheduled_date):
        captured_dates.append(scheduled_date)
        return ["09:00"]

    def fake_booking(db, lead_id, scheduled_date, scheduled_time, topic):
        captured_dates.append(scheduled_date)
        return SimpleNamespace(
            id=7,
            lead_id=lead_id,
            scheduled_date=scheduled_date,
            scheduled_time=scheduled_time,
        )

    monkeypatch.setattr("app.tools.registry.appointment_service.get_available_slots", fake_slots)
    monkeypatch.setattr("app.tools.registry.appointment_service.book_appointment", fake_booking)
    # Freeze the resolver at a November 25 Kolkata business date for this tool test.
    monkeypatch.setattr(
        "app.tools.registry.resolve_scheduling_date",
        lambda value, _tz: resolve_scheduling_date(
            value, _tz, now=datetime(2026, 11, 25, 6, 0, tzinfo=timezone.utc)
        ),
    )

    availability = dispatcher.execute(None, "session", "check_available_slots", {"date": "tomorrow"})
    booking = dispatcher.execute(
        None, "session", "book_appointment", {"date": "tomorrow", "time": "09:00"}
    )

    assert availability["date"] == "2026-11-26"
    assert booking["scheduled_date"] == "2026-11-26"
    assert captured_dates == ["2026-11-26", "2026-11-26"]
