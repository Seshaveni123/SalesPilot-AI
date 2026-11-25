import re
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.entities import Appointment, Lead
from app.schemas.crm import AppointmentResponse

STANDARD_SLOTS = ["09:00", "10:30", "13:00", "14:30", "16:00"]


class AppointmentConflictError(Exception):
    """Raised when a requested appointment slot is already confirmed."""


class AppointmentValidationError(Exception):
    """Raised when date, time, or lead association is invalid."""


def _validate_date_time(scheduled_date: str, scheduled_time: str) -> None:
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", scheduled_date or ""):
        raise AppointmentValidationError("Date must be in YYYY-MM-DD format.")
    if scheduled_time not in STANDARD_SLOTS:
        raise AppointmentValidationError(
            f"Time '{scheduled_time}' is outside supported slots: {', '.join(STANDARD_SLOTS)}"
        )


def get_available_slots(db: Session, scheduled_date: str) -> List[str]:
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", scheduled_date or ""):
        raise AppointmentValidationError("Date must be in YYYY-MM-DD format.")

    booked_rows = (
        db.query(Appointment.scheduled_time)
        .filter(
            Appointment.scheduled_date == scheduled_date,
            Appointment.status == "Confirmed",
        )
        .all()
    )
    booked_times = {row[0] for row in booked_rows}
    return [slot for slot in STANDARD_SLOTS if slot not in booked_times]


def book_appointment(
    db: Session,
    lead_id: int,
    scheduled_date: str,
    scheduled_time: str,
    topic: Optional[str] = None,
) -> AppointmentResponse:
    """Persist a confirmed appointment in SQLite after verifying no double booking."""
    _validate_date_time(scheduled_date, scheduled_time)

    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise AppointmentValidationError(f"Lead {lead_id} does not exist.")

    existing = (
        db.query(Appointment)
        .filter(
            Appointment.scheduled_date == scheduled_date,
            Appointment.scheduled_time == scheduled_time,
            Appointment.status == "Confirmed",
        )
        .first()
    )
    if existing:
        raise AppointmentConflictError(
            f"Slot {scheduled_date} at {scheduled_time} is already booked."
        )

    appt = Appointment(
        lead_id=lead_id,
        scheduled_date=scheduled_date,
        scheduled_time=scheduled_time,
        topic=topic or "SalesPilot AI Product Consultation & Demo",
        status="Confirmed",
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)

    return AppointmentResponse(
        id=appt.id,
        lead_id=appt.lead_id,
        lead_name=lead.name,
        company=lead.company,
        scheduled_date=appt.scheduled_date,
        scheduled_time=appt.scheduled_time,
        topic=appt.topic,
        status=appt.status,
        created_at=appt.created_at,
    )
