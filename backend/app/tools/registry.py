import json
from typing import Any, Dict, List, Optional

from google.genai import types
from sqlalchemy.orm import Session

from app.rag.vector_store import FAISSVectorStore
from app.services import appointment_service, crm_service, summary_service
from app.services.appointment_service import (
    AppointmentConflictError,
    AppointmentValidationError,
)
from app.services.conversation_manager import ConversationManager
from app.services.date_service import SchedulingDateError, resolve_scheduling_date
from app.services.qualification_service import score_lead_profile
from app.services.sentiment_service import analyze_customer_text


def get_gemini_tool_declarations() -> List[types.Tool]:
    """Return Gemini FunctionDeclarations for autonomous agentic tool selection."""
    declarations = [
        types.FunctionDeclaration(
            name="get_customer_context",
            description="Retrieve remembered customer details (name, company, requirements, budget, product interest, timeline) for the current conversation session.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={},
            ),
        ),
        types.FunctionDeclaration(
            name="save_lead_to_crm",
            description="Persist or update the prospect's contact details, company, requirements, budget, and timeline into the CRM database.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "name": types.Schema(type=types.Type.STRING, description="Prospect full name"),
                    "email": types.Schema(type=types.Type.STRING, description="Prospect email address"),
                    "phone": types.Schema(type=types.Type.STRING, description="Prospect phone number"),
                    "company": types.Schema(type=types.Type.STRING, description="Company name"),
                    "company_size": types.Schema(type=types.Type.STRING, description="Company headcount or tier"),
                    "product_interest": types.Schema(type=types.Type.STRING, description="Product or plan of interest"),
                    "budget": types.Schema(type=types.Type.STRING, description="Stated budget"),
                    "requirements": types.Schema(type=types.Type.STRING, description="Prospect requirements summary"),
                    "timeline": types.Schema(type=types.Type.STRING, description="Target purchase timeline"),
                },
            ),
        ),
        types.FunctionDeclaration(
            name="search_knowledge_base",
            description="Search indexed company product documentation, pricing, security, and FAQ to ground factual answers.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "query": types.Schema(type=types.Type.STRING, description="Semantic search query"),
                },
                required=["query"],
            ),
        ),
        types.FunctionDeclaration(
            name="qualify_lead",
            description="Evaluate and score the prospect as HOT, WARM, or COLD using deterministic prototype qualification rules.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={},
            ),
        ),
        types.FunctionDeclaration(
            name="analyze_sentiment",
            description="Analyze text-based customer sentiment, objections, purchase interest, and urgency from the conversation.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "utterance": types.Schema(type=types.Type.STRING, description="Latest customer statement"),
                },
                required=["utterance"],
            ),
        ),
        types.FunctionDeclaration(
            name="check_available_slots",
            description="Check non-conflicting appointment dates and times in the scheduling database.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "date": types.Schema(type=types.Type.STRING, description="Target date in YYYY-MM-DD format"),
                },
                required=["date"],
            ),
        ),
        types.FunctionDeclaration(
            name="book_appointment",
            description="Book a confirmed appointment slot in SQLite ONLY after explicit customer confirmation.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "date": types.Schema(type=types.Type.STRING, description="Confirmed date YYYY-MM-DD"),
                    "time": types.Schema(type=types.Type.STRING, description="Confirmed time HH:MM"),
                    "topic": types.Schema(type=types.Type.STRING, description="Appointment topic"),
                },
                required=["date", "time"],
            ),
        ),
        types.FunctionDeclaration(
            name="generate_call_summary",
            description="Generate and persist a structured call summary for the current sales session.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "next_action": types.Schema(type=types.Type.STRING, description="Recommended follow-up step"),
                },
            ),
        ),
    ]
    return [types.Tool(function_declarations=declarations)]


class AgentToolDispatcher:
    """Executes deterministic Python tool functions requested by the Gemini agent."""

    def __init__(
        self,
        conversation_manager: ConversationManager,
        vector_store: Optional[FAISSVectorStore] = None,
        rag_top_k: int = 4,
        timezone_name: str = "Asia/Kolkata",
    ):
        self.conversation_manager = conversation_manager
        self.vector_store = vector_store
        self.rag_top_k = rag_top_k
        self.timezone_name = timezone_name

    def execute(
        self,
        db: Session,
        session_id: str,
        tool_name: str,
        arguments: Dict[str, Any],
    ) -> Dict[str, Any]:
        if tool_name == "get_customer_context":
            memory = self.conversation_manager.get_session_memory(db, session_id)
            lead = self.conversation_manager.get_lead_for_session(db, session_id)
            return {
                "status": "ok",
                "session_memory": memory,
                "lead_id": lead.id if lead else None,
            }

        if tool_name == "save_lead_to_crm":
            cleaned = {k: v for k, v in arguments.items() if v is not None and v != ""}
            self.conversation_manager.update_session_memory(db, session_id, cleaned)
            lead = crm_service.upsert_lead_from_memory(db, session_id, cleaned)
            return {
                "status": "ok",
                "lead_id": lead.id,
                "lead_score": lead.lead_score,
                "lead_category": lead.lead_category,
                "saved_fields": list(cleaned.keys()),
            }

        if tool_name == "search_knowledge_base":
            query = str(arguments.get("query") or "").strip()
            if not self.vector_store:
                return {
                    "status": "unavailable",
                    "sources": [],
                    "message": "Knowledge base vector store is not configured.",
                }
            search_result = self.vector_store.search(query, top_k=self.rag_top_k)
            if not search_result["available"]:
                return {
                    "status": "no_match",
                    "sources": [],
                    "message": (
                        "No relevant information was found in the company knowledge base. "
                        "Admit to the prospect that this specific information is unavailable."
                    ),
                }
            return {
                "status": "ok",
                "sources": search_result["sources"],
            }

        if tool_name == "qualify_lead":
            memory = self.conversation_manager.get_session_memory(db, session_id)
            lead = self.conversation_manager.get_lead_for_session(db, session_id)
            profile = dict(memory)
            if lead:
                for key in (
                    "name",
                    "email",
                    "company",
                    "company_size",
                    "product_interest",
                    "budget",
                    "requirements",
                    "timeline",
                ):
                    val = getattr(lead, key, None)
                    if val:
                        profile[key] = val
            qual = score_lead_profile(profile)
            if lead:
                lead.lead_score = qual.lead_score
                lead.lead_category = qual.lead_category
                lead.urgency = qual.urgency
                db.commit()
            return {
                "status": "ok",
                "lead_score": qual.lead_score,
                "lead_category": qual.lead_category,
                "urgency": qual.urgency,
                "breakdown": qual.breakdown,
                "note": qual.model_disclaimer,
            }

        if tool_name == "analyze_sentiment":
            utterance = str(arguments.get("utterance") or "")
            res = analyze_customer_text(utterance)
            crm_service.apply_sentiment_to_session_and_lead(
                db=db,
                session_id=session_id,
                sentiment=res.sentiment,
                urgency=res.urgency,
                new_objections=res.objections,
            )
            return {
                "status": "ok",
                "sentiment": res.sentiment,
                "purchase_interest": res.purchase_interest,
                "urgency": res.urgency,
                "objections": res.objections,
                "analysis_method": res.analysis_method,
            }

        if tool_name == "check_available_slots":
            try:
                date_str = resolve_scheduling_date(
                    str(arguments.get("date") or ""), self.timezone_name
                )
            except SchedulingDateError as exc:
                return {"status": "error", "message": str(exc)}
            try:
                slots = appointment_service.get_available_slots(db, date_str)
                return {
                    "status": "ok",
                    "date": date_str,
                    "available_slots": slots,
                }
            except AppointmentValidationError as exc:
                return {"status": "error", "message": str(exc)}

        if tool_name == "book_appointment":
            try:
                date_str = resolve_scheduling_date(
                    str(arguments.get("date") or ""), self.timezone_name
                )
            except SchedulingDateError as exc:
                return {"status": "error", "message": str(exc)}
            time_str = str(arguments.get("time") or "").strip()
            topic = arguments.get("topic")
            lead = self.conversation_manager.get_lead_for_session(db, session_id)
            if not lead:
                memory = self.conversation_manager.get_session_memory(db, session_id)
                saved = crm_service.upsert_lead_from_memory(db, session_id, memory)
                lead_id = saved.id
            else:
                lead_id = lead.id
            try:
                appt = appointment_service.book_appointment(
                    db=db,
                    lead_id=lead_id,
                    scheduled_date=date_str,
                    scheduled_time=time_str,
                    topic=str(topic) if topic else None,
                )
                return {
                    "status": "confirmed",
                    "appointment_id": appt.id,
                    "lead_id": appt.lead_id,
                    "scheduled_date": appt.scheduled_date,
                    "scheduled_time": appt.scheduled_time,
                }
            except AppointmentConflictError as exc:
                return {"status": "conflict", "message": str(exc)}
            except AppointmentValidationError as exc:
                return {"status": "error", "message": str(exc)}

        if tool_name == "generate_call_summary":
            next_action = arguments.get("next_action")
            try:
                summary = summary_service.generate_and_save_summary(
                    db=db,
                    session_id=session_id,
                    next_action=str(next_action) if next_action else None,
                )
                return {
                    "status": "ok",
                    "summary_id": summary.id,
                    "lead_category": summary.lead_category,
                    "appointment_status": summary.appointment_status,
                }
            except ValueError as exc:
                return {"status": "error", "message": str(exc)}

        return {"status": "error", "message": f"Unknown tool: {tool_name}"}
