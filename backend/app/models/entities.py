from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Lead(Base):
    """CRM Lead record capturing prospect profile, qualification, and sentiment."""

    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    company_size: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    product_interest: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    budget: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timeline: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    lead_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lead_category: Mapped[str] = mapped_column(String(24), default="UNQUALIFIED", nullable=False)
    sentiment: Mapped[Optional[str]] = mapped_column(String(24), nullable=True)
    urgency: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    objections_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    sessions: Mapped[list["ConversationSession"]] = relationship(back_populates="lead")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="lead")
    summaries: Mapped[list["CallSummary"]] = relationship(back_populates="lead")


class ConversationSession(Base):
    """Conversation session tracking channel, linked lead, and structured customer memory."""

    __tablename__ = "conversation_sessions"

    session_id: Mapped[str] = mapped_column(String(80), primary_key=True, index=True)
    lead_id: Mapped[Optional[int]] = mapped_column(ForeignKey("leads.id"), nullable=True)
    channel: Mapped[str] = mapped_column(String(20), default="text", nullable=False)
    sentiment: Mapped[Optional[str]] = mapped_column(String(24), nullable=True)
    memory_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    lead: Mapped[Optional["Lead"]] = relationship(back_populates="sessions")
    messages: Mapped[list["ConversationMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ConversationMessage.id",
    )
    summaries: Mapped[list["CallSummary"]] = relationship(back_populates="session")


class ConversationMessage(Base):
    """Individual turn in a sales conversation session."""

    __tablename__ = "conversation_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("conversation_sessions.session_id"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tools_used_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    retrieved_sources_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    session: Mapped["ConversationSession"] = relationship(back_populates="messages")


class Appointment(Base):
    """Scheduled product demo or sales consultation linked to a lead."""

    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), nullable=False, index=True)
    scheduled_date: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    scheduled_time: Mapped[str] = mapped_column(String(20), nullable=False)
    topic: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(24), default="Confirmed", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    lead: Mapped["Lead"] = relationship(back_populates="appointments")


class CallSummary(Base):
    """Persisted structured call summary generated after sales conversations."""

    __tablename__ = "call_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("conversation_sessions.session_id"), nullable=False, index=True
    )
    lead_id: Mapped[Optional[int]] = mapped_column(ForeignKey("leads.id"), nullable=True)
    customer_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    product_interest: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    budget: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    sentiment: Mapped[Optional[str]] = mapped_column(String(24), nullable=True)
    lead_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    lead_category: Mapped[Optional[str]] = mapped_column(String(24), nullable=True)
    objections_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    next_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    appointment_status: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    session: Mapped["ConversationSession"] = relationship(back_populates="summaries")
    lead: Mapped[Optional["Lead"]] = relationship(back_populates="summaries")
