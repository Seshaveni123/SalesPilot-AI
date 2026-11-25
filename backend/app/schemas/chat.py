from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class RetrievedSourceSchema(BaseModel):
    document_name: str
    chunk_id: str
    score: float
    excerpt: str


class LeadContextSchema(BaseModel):
    """Customer context maintained in conversation memory and CRM."""

    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    company_size: Optional[str] = None
    product_interest: Optional[str] = None
    budget: Optional[str] = None
    requirements: Optional[str] = None
    timeline: Optional[str] = None
    lead_score: Optional[int] = None
    lead_category: Optional[str] = None
    sentiment: Optional[str] = None
    objections: List[str] = Field(default_factory=list)


class StructuredAgentOutput(BaseModel):
    """Structured schema enforced on the AI agent's final turn output."""

    reply: str = Field(description="Natural, concise, grounded sales assistant response to the prospect.")
    extracted_name: Optional[str] = Field(default=None, description="Prospect's name if stated.")
    extracted_email: Optional[str] = Field(default=None, description="Prospect's email if stated.")
    extracted_phone: Optional[str] = Field(default=None, description="Prospect's phone if stated.")
    extracted_company: Optional[str] = Field(default=None, description="Prospect's company name if stated.")
    extracted_company_size: Optional[str] = Field(default=None, description="Company size or headcount if stated.")
    extracted_product_interest: Optional[str] = Field(default=None, description="Product or plan the prospect asked about.")
    extracted_budget: Optional[str] = Field(default=None, description="Budget range if stated.")
    extracted_requirements: Optional[str] = Field(default=None, description="Summary of prospect needs/requirements.")
    extracted_timeline: Optional[str] = Field(default=None, description="Purchase timeline if stated.")
    follow_up_intent: Optional[str] = Field(
        default=None,
        description="Immediate sales goal for the next turn (e.g., clarify_requirements, answer_product, offer_demo).",
    )


class ChatRequest(BaseModel):
    """Incoming user message payload for /api/agent/chat."""

    session_id: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=1, max_length=4000)
    channel: Literal["voice", "text"] = "text"


class ChatResponse(BaseModel):
    """Structured response returned to VoiceAgentPage."""

    session_id: str
    reply: str
    tools_used: List[str] = Field(default_factory=list)
    retrieved_sources: List[RetrievedSourceSchema] = Field(default_factory=list)
    lead_context: LeadContextSchema
    follow_up_intent: Optional[str] = None


class ConversationSessionResponse(BaseModel):
    session_id: str
    lead_id: Optional[int] = None
    lead_name: Optional[str] = None
    company: Optional[str] = None
    channel: str
    sentiment: Optional[str] = None
    message_count: int
    started_at: datetime
    last_message_at: datetime


class ConversationMessageResponse(BaseModel):
    id: int
    session_id: str
    role: str
    content: str
    tools_used: List[str] = Field(default_factory=list)
    retrieved_sources: List[RetrievedSourceSchema] = Field(default_factory=list)
    created_at: datetime
