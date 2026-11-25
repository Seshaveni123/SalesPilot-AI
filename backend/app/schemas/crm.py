from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


LeadCategoryLiteral = Literal["HOT", "WARM", "COLD", "UNQUALIFIED"]
SentimentLiteral = Literal["Positive", "Neutral", "Negative"]
AppointmentStatusLiteral = Literal["Confirmed", "Completed", "Cancelled"]


class LeadCreate(BaseModel):
    """Request payload for creating a CRM lead."""

    name: Optional[str] = Field(default=None, max_length=120)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    company: Optional[str] = Field(default=None, max_length=160)
    company_size: Optional[str] = Field(default=None, max_length=80)
    product_interest: Optional[str] = Field(default=None, max_length=160)
    budget: Optional[str] = Field(default=None, max_length=120)
    requirements: Optional[str] = None
    timeline: Optional[str] = Field(default=None, max_length=120)


class LeadUpdate(LeadCreate):
    """Partial update payload for modifying an existing lead."""

    lead_score: Optional[int] = Field(default=None, ge=0, le=100)
    lead_category: Optional[LeadCategoryLiteral] = None
    sentiment: Optional[SentimentLiteral] = None
    urgency: Optional[str] = Field(default=None, max_length=40)
    objections: Optional[List[str]] = None


class LeadResponse(BaseModel):
    """Serialized CRM lead returned to frontend clients."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    company_size: Optional[str] = None
    product_interest: Optional[str] = None
    budget: Optional[str] = None
    requirements: Optional[str] = None
    timeline: Optional[str] = None
    lead_score: int = 0
    lead_category: str = "UNQUALIFIED"
    sentiment: Optional[str] = None
    urgency: Optional[str] = None
    objections: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class AppointmentCreate(BaseModel):
    """Request payload for booking a confirmed appointment."""

    lead_id: int = Field(gt=0)
    scheduled_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    scheduled_time: str = Field(min_length=4, max_length=20)
    topic: Optional[str] = Field(default=None, max_length=255)


class AppointmentResponse(BaseModel):
    """Serialized appointment record."""

    id: int
    lead_id: int
    lead_name: Optional[str] = None
    company: Optional[str] = None
    scheduled_date: str
    scheduled_time: str
    topic: Optional[str] = None
    status: str
    created_at: datetime


class AppointmentSlotsResponse(BaseModel):
    """Available time slots for a target date."""

    date: str
    available_slots: List[str]


class CallSummaryResponse(BaseModel):
    """Serialized structured call summary."""

    id: int
    session_id: str
    lead_id: Optional[int] = None
    customer_name: Optional[str] = None
    company: Optional[str] = None
    requirements: Optional[str] = None
    product_interest: Optional[str] = None
    budget: Optional[str] = None
    sentiment: Optional[str] = None
    lead_score: Optional[int] = None
    lead_category: Optional[str] = None
    objections: List[str] = Field(default_factory=list)
    next_action: Optional[str] = None
    appointment_status: Optional[str] = None
    created_at: datetime


class SentimentDistribution(BaseModel):
    positive: int = 0
    neutral: int = 0
    negative: int = 0


class LeadDetailsResponse(BaseModel):
    """360-degree lead profile with qualification breakdown and linked records."""

    lead: LeadResponse
    qualification_breakdown: List[str] = Field(default_factory=list)
    model_disclaimer: str
    appointments: List[AppointmentResponse] = Field(default_factory=list)
    summaries: List[CallSummaryResponse] = Field(default_factory=list)


class ActivityItem(BaseModel):
    id: str
    type: Literal["lead", "appointment", "conversation", "summary"]
    description: str
    timestamp: datetime


class AnalyticsOverviewResponse(BaseModel):
    """Real database-derived analytics overview."""

    total_leads: int = 0
    hot_leads: int = 0
    warm_leads: int = 0
    cold_leads: int = 0
    total_appointments: int = 0
    confirmed_appointments: int = 0
    total_conversations: int = 0
    conversion_rate: float = 0.0
    average_lead_score: float = 0.0
    sentiment_distribution: SentimentDistribution = Field(default_factory=SentimentDistribution)
    recent_activity: List[ActivityItem] = Field(default_factory=list)
