import json
from typing import Any, Dict, List

from google.genai import types
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.agents.gemini_client import GeminiClientWrapper
from app.schemas.chat import (
    ChatResponse,
    LeadContextSchema,
    RetrievedSourceSchema,
    StructuredAgentOutput,
)
from app.services import crm_service
from app.services.conversation_manager import ConversationManager
from app.services.date_service import get_scheduling_date_context
from app.services.sentiment_service import analyze_customer_text
from app.tools.registry import AgentToolDispatcher, get_gemini_tool_declarations

SALES_AGENT_SYSTEM_PROMPT = """You are SalesPilot AI, an autonomous B2B enterprise sales assistant.
Rules:
1. Be concise, polite, consultative, and sales-oriented. Ask focused discovery questions when customer requirements, budget, or timeline are missing.
2. You have access to tools. Decide autonomously when to call tools:
   - Call get_customer_context() if you need remembered session facts.
   - Call save_lead_to_crm(...) whenever the customer shares their name, email, phone, company, company size, product interest, budget, requirements, or timeline.
   - Call search_knowledge_base(query) before answering factual product, pricing, or security questions.
   - Call check_available_slots(date) / book_appointment(date, time, topic) when scheduling is requested.
3. Never invent product features, prices, or policies. If a tool reports information is unavailable, state clearly what is not available.
4. Never claim an appointment is booked unless book_appointment() explicitly confirms database persistence.
"""

STRUCTURED_EXTRACTION_PROMPT = """Convert the sales assistant draft response and latest conversation turn into the required JSON schema.
Preserve the assistant's reply faithfully and extract any explicitly stated customer fields (do not guess unstated values)."""


class SalesAgentOrchestrator:
    """Coordinates Gemini tool calling, conversation memory, and structured responses."""

    def __init__(
        self,
        gemini_client: GeminiClientWrapper,
        conversation_manager: ConversationManager,
        tool_dispatcher: AgentToolDispatcher,
        max_tool_rounds: int = 4,
        timezone_name: str = "Asia/Kolkata",
    ):
        self.gemini_client = gemini_client
        self.conversation_manager = conversation_manager
        self.tool_dispatcher = tool_dispatcher
        self.max_tool_rounds = max_tool_rounds
        self.timezone_name = timezone_name

    def handle_turn(
        self,
        db: Session,
        session_id: str,
        user_message: str,
        channel: str = "text",
    ) -> ChatResponse:
        # Fail fast if GEMINI_API_KEY is not configured; never fabricate AI replies.
        self.gemini_client.ensure_configured()

        self.conversation_manager.get_or_create_session(db, session_id, channel=channel)
        history = self.conversation_manager.get_history(db, session_id, limit=16)
        memory = self.conversation_manager.get_session_memory(db, session_id)

        # Persist incoming user turn
        self.conversation_manager.append_message(
            db=db, session_id=session_id, role="user", content=user_message
        )

        contents = self._build_contents(history, memory, user_message)
        tools = get_gemini_tool_declarations()
        date_context = get_scheduling_date_context(self.timezone_name)
        today_str = date_context.today.strftime("%Y-%m-%d (%A, %B %d, %Y)")
        tomorrow_str = date_context.tomorrow.strftime("%Y-%m-%d (%A, %B %d, %Y)")
        system_prompt = (
            f"{SALES_AGENT_SYSTEM_PROMPT}\n"
            f"Business Timezone: {date_context.timezone}. Today is {today_str}; tomorrow is {tomorrow_str}. "
            "For scheduling, convert 'today' and 'tomorrow' to those exact YYYY-MM-DD values before "
            "calling check_available_slots or book_appointment. Preserve an explicitly stated YYYY-MM-DD date."
        )

        tools_used: List[str] = []
        retrieved_sources: List[RetrievedSourceSchema] = []
        draft_reply = ""

        for _ in range(self.max_tool_rounds):
            response = self.gemini_client.generate_with_tools(
                contents=contents,
                system_instruction=system_prompt,
                tools=tools,
            )

            function_calls = getattr(response, "function_calls", None) or []
            if not function_calls:
                draft_reply = (getattr(response, "text", None) or "").strip()
                break

            # Append model turn requesting tool execution
            candidates = getattr(response, "candidates", None) or []
            if candidates and getattr(candidates[0], "content", None):
                contents.append(candidates[0].content)

            function_response_parts: List[types.Part] = []
            for fc in function_calls:
                tool_name = fc.name
                tool_args = dict(fc.args) if fc.args else {}
                tools_used.append(tool_name)
                result = self.tool_dispatcher.execute(
                    db=db, session_id=session_id, tool_name=tool_name, arguments=tool_args
                )
                if tool_name == "search_knowledge_base" and isinstance(
                    result.get("sources"), list
                ):
                    for src in result["sources"]:
                        if isinstance(src, dict):
                            retrieved_sources.append(RetrievedSourceSchema(**src))

                function_response_parts.append(
                    types.Part.from_function_response(name=tool_name, response=result)
                )

            contents.append(types.Content(role="user", parts=function_response_parts))

        if not draft_reply:
            # Final text generation pass if loop hit max_tool_rounds
            final_resp = self.gemini_client.generate_with_tools(
                contents=contents,
                system_instruction=system_prompt,
                tools=[],
            )
            draft_reply = (getattr(final_resp, "text", None) or "").strip()

        structured = self._finalize_structured_output(
            user_message=user_message,
            draft_reply=draft_reply,
            memory=memory,
        )

        extracted_updates = {
            "name": structured.extracted_name,
            "email": structured.extracted_email,
            "phone": structured.extracted_phone,
            "company": structured.extracted_company,
            "company_size": structured.extracted_company_size,
            "product_interest": structured.extracted_product_interest,
            "budget": structured.extracted_budget,
            "requirements": structured.extracted_requirements,
            "timeline": structured.extracted_timeline,
        }
        updated_memory = self.conversation_manager.update_session_memory(
            db, session_id, extracted_updates
        )

        # Ensure CRM lead & prototype score stay synchronized when any customer field is known
        if any(updated_memory.get(k) for k in ("name", "email", "company", "product_interest", "budget", "requirements", "timeline")):
            crm_service.upsert_lead_from_memory(db, session_id, updated_memory)

        # Update deterministic text-based sentiment & objections from the customer's turn
        sentiment_res = analyze_customer_text(user_message)
        crm_service.apply_sentiment_to_session_and_lead(
            db=db,
            session_id=session_id,
            sentiment=sentiment_res.sentiment,
            urgency=sentiment_res.urgency,
            new_objections=sentiment_res.objections,
        )

        self.conversation_manager.append_message(
            db=db,
            session_id=session_id,
            role="assistant",
            content=structured.reply,
            tools_used=tools_used,
            retrieved_sources=[s.model_dump() for s in retrieved_sources],
        )

        lead = self.conversation_manager.get_lead_for_session(db, session_id)
        lead_context = self._build_lead_context(updated_memory, lead)

        return ChatResponse(
            session_id=session_id,
            reply=structured.reply,
            tools_used=tools_used,
            retrieved_sources=retrieved_sources,
            lead_context=lead_context,
            follow_up_intent=structured.follow_up_intent,
        )

    def _build_contents(
        self,
        history: List[Any],
        memory: Dict[str, Any],
        user_message: str,
    ) -> List[types.Content]:
        contents: List[types.Content] = []
        if memory:
            contents.append(
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(
                            text=f"[Session Memory Context]: {json.dumps(memory)}"
                        )
                    ],
                )
            )
        for msg in history:
            role = "model" if msg.role == "assistant" else "user"
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=msg.content)])
            )
        contents.append(
            types.Content(role="user", parts=[types.Part.from_text(text=user_message)])
        )
        return contents

    def _finalize_structured_output(
        self,
        user_message: str,
        draft_reply: str,
        memory: Dict[str, Any],
    ) -> StructuredAgentOutput:
        prompt = (
            f"Customer message: {user_message}\n"
            f"Existing session memory: {json.dumps(memory)}\n"
            f"Assistant draft reply: {draft_reply}"
        )
        raw_json = self.gemini_client.generate_structured(
            prompt=prompt,
            system_instruction=STRUCTURED_EXTRACTION_PROMPT,
            response_schema=StructuredAgentOutput,
        )
        if raw_json:
            try:
                return StructuredAgentOutput.model_validate_json(raw_json)
            except ValidationError:
                pass
        return StructuredAgentOutput(
            reply=draft_reply or "I received your message. Could you share a bit more about your requirements?"
        )

    @staticmethod
    def _build_lead_context(memory: Dict[str, Any], lead: Any) -> LeadContextSchema:
        objections: List[str] = []
        if lead and getattr(lead, "objections_json", None):
            try:
                parsed = json.loads(lead.objections_json)
                if isinstance(parsed, list):
                    objections = [str(x) for x in parsed]
            except json.JSONDecodeError:
                objections = []
        return LeadContextSchema(
            name=(lead.name if lead else None) or memory.get("name"),
            email=(lead.email if lead else None) or memory.get("email"),
            phone=(lead.phone if lead else None) or memory.get("phone"),
            company=(lead.company if lead else None) or memory.get("company"),
            company_size=(lead.company_size if lead else None) or memory.get("company_size"),
            product_interest=(lead.product_interest if lead else None)
            or memory.get("product_interest"),
            budget=(lead.budget if lead else None) or memory.get("budget"),
            requirements=(lead.requirements if lead else None) or memory.get("requirements"),
            timeline=(lead.timeline if lead else None) or memory.get("timeline"),
            lead_score=lead.lead_score if lead else None,
            lead_category=lead.lead_category if lead else None,
            sentiment=lead.sentiment if lead else None,
            objections=objections,
        )
