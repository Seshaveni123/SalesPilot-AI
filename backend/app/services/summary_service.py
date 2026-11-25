import json
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.entities import Appointment, CallSummary, ConversationSession, Lead
from app.schemas.crm import CallSummaryResponse


def generate_and_save_summary(
    db: Session,
    session_id: str,
    next_action: Optional[str] = None,
) -> CallSummaryResponse:
    """Assemble a structured call summary from session memory, CRM lead, and appointments."""
    session = (
        db.query(ConversationSession)
        .filter(ConversationSession.session_id == session_id)
        .first()
    )
    if not session:
        raise ValueError(f"Conversation session '{session_id}' not found.")

    try:
        memory = json.loads(session.memory_json or "{}")
    except json.JSONDecodeError:
        memory = {}

    lead: Optional[Lead] = None
    if session.lead_id:
        lead = db.query(Lead).filter(Lead.id == session.lead_id).first()

    objections: List[str] = []
    if lead and lead.objections_json:
        try:
            parsed = json.loads(lead.objections_json)
            if isinstance(parsed, list):
                objections = [str(item) for item in parsed]
        except json.JSONDecodeError:
            objections = []

    appointment_status = "Not scheduled"
    if lead:
        latest_appt = (
            db.query(Appointment)
            .filter(Appointment.lead_id == lead.id)
            .order_by(Appointment.created_at.desc())
            .first()
        )
        if latest_appt:
            appointment_status = (
                f"{latest_appt.status} ({latest_appt.scheduled_date} {latest_appt.scheduled_time})"
            )

    resolved_next_action = next_action
    if not resolved_next_action:
        if appointment_status.startswith("Confirmed"):
            resolved_next_action = "Send calendar invite & pre-demo product brief."
        elif lead and lead.lead_category == "HOT":
            resolved_next_action = "Follow up promptly to schedule an executive demo."
        else:
            resolved_next_action = "Share product documentation and qualify budget/timeline."

    summary = CallSummary(
        session_id=session_id,
        lead_id=lead.id if lead else None,
        customer_name=(lead.name if lead else None) or memory.get("name"),
        company=(lead.company if lead else None) or memory.get("company"),
        requirements=(lead.requirements if lead else None) or memory.get("requirements"),
        product_interest=(lead.product_interest if lead else None) or memory.get("product_interest"),
        budget=(lead.budget if lead else None) or memory.get("budget"),
        sentiment=(lead.sentiment if lead else None) or session.sentiment,
        lead_score=lead.lead_score if lead else None,
        lead_category=lead.lead_category if lead else None,
        objections_json=json.dumps(objections),
        next_action=resolved_next_action,
        appointment_status=appointment_status,
    )
    db.add(summary)
    db.commit()
    db.refresh(summary)

    return CallSummaryResponse(
        id=summary.id,
        session_id=summary.session_id,
        lead_id=summary.lead_id,
        customer_name=summary.customer_name,
        company=summary.company,
        requirements=summary.requirements,
        product_interest=summary.product_interest,
        budget=summary.budget,
        sentiment=summary.sentiment,
        lead_score=summary.lead_score,
        lead_category=summary.lead_category,
        objections=objections,
        next_action=summary.next_action,
        appointment_status=summary.appointment_status,
        created_at=summary.created_at,
    )
