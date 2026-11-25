import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.entities import (
    Appointment,
    CallSummary,
    ConversationMessage,
    ConversationSession,
    Lead,
)
from app.services.qualification_service import score_lead_profile
from app.schemas.chat import (
    ConversationMessageResponse,
    ConversationSessionResponse,
    RetrievedSourceSchema,
)
from app.schemas.crm import (
    ActivityItem,
    AnalyticsOverviewResponse,
    AppointmentResponse,
    CallSummaryResponse,
    LeadCreate,
    LeadDetailsResponse,
    LeadResponse,
    LeadUpdate,
    SentimentDistribution,
)


def _safe_json_list(raw: Optional[str]) -> List[Any]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return []


def lead_to_response(lead: Lead) -> LeadResponse:
    return LeadResponse(
        id=lead.id,
        name=lead.name,
        email=lead.email,
        phone=lead.phone,
        company=lead.company,
        company_size=lead.company_size,
        product_interest=lead.product_interest,
        budget=lead.budget,
        requirements=lead.requirements,
        timeline=lead.timeline,
        lead_score=lead.lead_score,
        lead_category=lead.lead_category,
        sentiment=lead.sentiment,
        urgency=lead.urgency,
        objections=_safe_json_list(lead.objections_json),
        created_at=lead.created_at,
        updated_at=lead.updated_at,
    )


def list_leads(db: Session) -> List[LeadResponse]:
    leads = db.query(Lead).order_by(Lead.updated_at.desc(), Lead.id.desc()).all()
    return [lead_to_response(lead) for lead in leads]


def get_lead(db: Session, lead_id: int) -> Optional[LeadResponse]:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    return lead_to_response(lead) if lead else None


def create_lead(db: Session, payload: LeadCreate) -> LeadResponse:
    data = payload.model_dump()
    qual = score_lead_profile(data)
    lead = Lead(
        **data,
        lead_score=qual.lead_score,
        lead_category=qual.lead_category,
        urgency=qual.urgency,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead_to_response(lead)


def get_lead_details(db: Session, lead_id: int) -> Optional[LeadDetailsResponse]:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        return None
    qual = score_lead_profile(
        {
            "name": lead.name,
            "email": lead.email,
            "company": lead.company,
            "company_size": lead.company_size,
            "product_interest": lead.product_interest,
            "budget": lead.budget,
            "requirements": lead.requirements,
            "timeline": lead.timeline,
        }
    )
    appts = [
        AppointmentResponse(
            id=row.id,
            lead_id=row.lead_id,
            lead_name=lead.name,
            company=lead.company,
            scheduled_date=row.scheduled_date,
            scheduled_time=row.scheduled_time,
            topic=row.topic,
            status=row.status,
            created_at=row.created_at,
        )
        for row in sorted(lead.appointments, key=lambda a: (a.scheduled_date, a.scheduled_time))
    ]
    sums = [
        CallSummaryResponse(
            id=row.id,
            session_id=row.session_id,
            lead_id=row.lead_id,
            customer_name=row.customer_name,
            company=row.company,
            requirements=row.requirements,
            product_interest=row.product_interest,
            budget=row.budget,
            sentiment=row.sentiment,
            lead_score=row.lead_score,
            lead_category=row.lead_category,
            objections=_safe_json_list(row.objections_json),
            next_action=row.next_action,
            appointment_status=row.appointment_status,
            created_at=row.created_at,
        )
        for row in sorted(lead.summaries, key=lambda s: s.created_at, reverse=True)
    ]
    return LeadDetailsResponse(
        lead=lead_to_response(lead),
        qualification_breakdown=qual.breakdown,
        model_disclaimer=qual.model_disclaimer,
        appointments=appts,
        summaries=sums,
    )


def update_lead(db: Session, lead_id: int, payload: LeadUpdate) -> Optional[LeadResponse]:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        return None
    updates = payload.model_dump(exclude_unset=True)
    objections = updates.pop("objections", None)
    for field, value in updates.items():
        setattr(lead, field, value)
    if objections is not None:
        lead.objections_json = json.dumps(objections)
    lead.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return lead_to_response(lead)


def upsert_lead_from_memory(
    db: Session, session_id: str, data: Dict[str, Any]
) -> LeadResponse:
    """Create or update a CRM Lead associated with a conversation session."""
    session = (
        db.query(ConversationSession)
        .filter(ConversationSession.session_id == session_id)
        .first()
    )
    lead: Optional[Lead] = None
    if session and session.lead_id:
        lead = db.query(Lead).filter(Lead.id == session.lead_id).first()
    if lead is None and data.get("email"):
        lead = db.query(Lead).filter(Lead.email == data["email"]).first()
    if lead is None:
        lead = Lead()
        db.add(lead)

    allowed_fields = (
        "name",
        "email",
        "phone",
        "company",
        "company_size",
        "product_interest",
        "budget",
        "requirements",
        "timeline",
    )
    for field in allowed_fields:
        val = data.get(field)
        if val:
            setattr(lead, field, val)

    # Recompute explainable prototype qualification score whenever lead profile updates
    profile_snapshot = {
        "name": lead.name,
        "email": lead.email,
        "company": lead.company,
        "company_size": lead.company_size,
        "product_interest": lead.product_interest,
        "budget": lead.budget,
        "requirements": lead.requirements,
        "timeline": lead.timeline,
    }
    qual = score_lead_profile(profile_snapshot)
    lead.lead_score = qual.lead_score
    lead.lead_category = qual.lead_category
    if not lead.urgency:
        lead.urgency = qual.urgency

    lead.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)

    if session and session.lead_id != lead.id:
        session.lead_id = lead.id
        db.commit()

    return lead_to_response(lead)


def apply_sentiment_to_session_and_lead(
    db: Session,
    session_id: str,
    sentiment: str,
    urgency: str,
    new_objections: List[str],
) -> None:
    """Persist text-based sentiment and merged objections to session and linked lead."""
    session = (
        db.query(ConversationSession)
        .filter(ConversationSession.session_id == session_id)
        .first()
    )
    if session:
        session.sentiment = sentiment
        if session.lead_id:
            lead = db.query(Lead).filter(Lead.id == session.lead_id).first()
            if lead:
                lead.sentiment = sentiment
                lead.urgency = urgency
                existing_obj = _safe_json_list(lead.objections_json)
                merged = list(dict.fromkeys([*existing_obj, *new_objections]))
                lead.objections_json = json.dumps(merged)
                lead.updated_at = datetime.now(timezone.utc)
        db.commit()


def list_conversations(db: Session) -> List[ConversationSessionResponse]:
    sessions = (
        db.query(ConversationSession)
        .order_by(ConversationSession.last_message_at.desc())
        .all()
    )
    results: List[ConversationSessionResponse] = []
    for sess in sessions:
        msg_count = (
            db.query(func.count(ConversationMessage.id))
            .filter(ConversationMessage.session_id == sess.session_id)
            .scalar()
            or 0
        )
        lead_name = sess.lead.name if sess.lead else None
        company = sess.lead.company if sess.lead else None
        if not lead_name or not company:
            try:
                mem = json.loads(sess.memory_json or "{}")
                lead_name = lead_name or mem.get("name")
                company = company or mem.get("company")
            except json.JSONDecodeError:
                pass
        results.append(
            ConversationSessionResponse(
                session_id=sess.session_id,
                lead_id=sess.lead_id,
                lead_name=lead_name,
                company=company,
                channel=sess.channel,
                sentiment=sess.sentiment,
                message_count=int(msg_count),
                started_at=sess.started_at,
                last_message_at=sess.last_message_at,
            )
        )
    return results


def get_conversation_messages(
    db: Session, session_id: str
) -> List[ConversationMessageResponse]:
    rows = (
        db.query(ConversationMessage)
        .filter(ConversationMessage.session_id == session_id)
        .order_by(ConversationMessage.id.asc())
        .all()
    )
    return [
        ConversationMessageResponse(
            id=row.id,
            session_id=row.session_id,
            role=row.role,
            content=row.content,
            tools_used=_safe_json_list(row.tools_used_json),
            retrieved_sources=[
                RetrievedSourceSchema(**src)
                for src in _safe_json_list(row.retrieved_sources_json)
                if isinstance(src, dict)
            ],
            created_at=row.created_at,
        )
        for row in rows
    ]


def list_appointments(db: Session) -> List[AppointmentResponse]:
    rows = db.query(Appointment).order_by(Appointment.scheduled_date.asc(), Appointment.scheduled_time.asc()).all()
    return [
        AppointmentResponse(
            id=row.id,
            lead_id=row.lead_id,
            lead_name=row.lead.name if row.lead else None,
            company=row.lead.company if row.lead else None,
            scheduled_date=row.scheduled_date,
            scheduled_time=row.scheduled_time,
            topic=row.topic,
            status=row.status,
            created_at=row.created_at,
        )
        for row in rows
    ]


def list_summaries(db: Session) -> List[CallSummaryResponse]:
    rows = db.query(CallSummary).order_by(CallSummary.created_at.desc()).all()
    return [
        CallSummaryResponse(
            id=row.id,
            session_id=row.session_id,
            lead_id=row.lead_id,
            customer_name=row.customer_name,
            company=row.company,
            requirements=row.requirements,
            product_interest=row.product_interest,
            budget=row.budget,
            sentiment=row.sentiment,
            lead_score=row.lead_score,
            lead_category=row.lead_category,
            objections=_safe_json_list(row.objections_json),
            next_action=row.next_action,
            appointment_status=row.appointment_status,
            created_at=row.created_at,
        )
        for row in rows
    ]


def get_analytics_overview(db: Session) -> AnalyticsOverviewResponse:
    leads = db.query(Lead).all()
    appointments = db.query(Appointment).all()
    total_conversations = db.query(func.count(ConversationSession.session_id)).scalar() or 0

    total_leads = len(leads)
    hot_leads = sum(1 for l in leads if l.lead_category == "HOT")
    warm_leads = sum(1 for l in leads if l.lead_category == "WARM")
    cold_leads = sum(1 for l in leads if l.lead_category == "COLD")

    total_appointments = len(appointments)
    confirmed_appointments = sum(1 for a in appointments if a.status == "Confirmed")

    avg_score = (
        round(sum(l.lead_score for l in leads) / total_leads, 1) if total_leads > 0 else 0.0
    )
    conversion_rate = (
        round((confirmed_appointments / total_leads) * 100, 1) if total_leads > 0 else 0.0
    )

    pos = sum(1 for l in leads if l.sentiment == "Positive")
    neu = sum(1 for l in leads if l.sentiment == "Neutral")
    neg = sum(1 for l in leads if l.sentiment == "Negative")

    recent: List[ActivityItem] = []
    for lead in sorted(leads, key=lambda x: x.updated_at, reverse=True)[:5]:
        recent.append(
            ActivityItem(
                id=f"lead_{lead.id}",
                type="lead",
                description=f"Lead updated: {lead.name or f'Lead #{lead.id}'} ({lead.lead_category})",
                timestamp=lead.updated_at,
            )
        )
    for appt in sorted(appointments, key=lambda x: x.created_at, reverse=True)[:5]:
        recent.append(
            ActivityItem(
                id=f"appt_{appt.id}",
                type="appointment",
                description=f"Appointment {appt.status}: {appt.scheduled_date} at {appt.scheduled_time}",
                timestamp=appt.created_at,
            )
        )
    recent.sort(key=lambda item: item.timestamp, reverse=True)

    return AnalyticsOverviewResponse(
        total_leads=total_leads,
        hot_leads=hot_leads,
        warm_leads=warm_leads,
        cold_leads=cold_leads,
        total_appointments=total_appointments,
        confirmed_appointments=confirmed_appointments,
        total_conversations=int(total_conversations),
        conversion_rate=conversion_rate,
        average_lead_score=avg_score,
        sentiment_distribution=SentimentDistribution(
            positive=pos, neutral=neu, negative=neg
        ),
        recent_activity=recent[:8],
    )
