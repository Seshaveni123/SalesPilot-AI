import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.entities import ConversationMessage, ConversationSession, Lead


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ConversationManager:
    """Manages persistent multi-turn conversation sessions and structured customer memory."""

    def get_or_create_session(
        self, db: Session, session_id: str, channel: str = "text"
    ) -> ConversationSession:
        session = (
            db.query(ConversationSession)
            .filter(ConversationSession.session_id == session_id)
            .first()
        )
        if session is None:
            session = ConversationSession(
                session_id=session_id,
                channel=channel,
                memory_json="{}",
            )
            db.add(session)
            db.commit()
            db.refresh(session)
        return session

    def get_session_memory(self, db: Session, session_id: str) -> Dict[str, Any]:
        session = (
            db.query(ConversationSession)
            .filter(ConversationSession.session_id == session_id)
            .first()
        )
        if not session:
            return {}
        try:
            data = json.loads(session.memory_json or "{}")
            return data if isinstance(data, dict) else {}
        except json.JSONDecodeError:
            return {}

    def update_session_memory(
        self, db: Session, session_id: str, updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        session = self.get_or_create_session(db, session_id)
        current = self.get_session_memory(db, session_id)
        for key, value in updates.items():
            if value is not None and value != "":
                current[key] = value
        session.memory_json = json.dumps(current)
        session.last_message_at = _utcnow()
        db.commit()
        db.refresh(session)
        return current

    def link_lead(self, db: Session, session_id: str, lead_id: int) -> None:
        session = self.get_or_create_session(db, session_id)
        session.lead_id = lead_id
        db.commit()

    def append_message(
        self,
        db: Session,
        session_id: str,
        role: str,
        content: str,
        tools_used: Optional[List[str]] = None,
        retrieved_sources: Optional[List[Dict[str, Any]]] = None,
    ) -> ConversationMessage:
        session = self.get_or_create_session(db, session_id)
        msg = ConversationMessage(
            session_id=session_id,
            role=role,
            content=content,
            tools_used_json=json.dumps(tools_used or []),
            retrieved_sources_json=json.dumps(retrieved_sources or []),
        )
        session.last_message_at = _utcnow()
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg

    def get_history(
        self, db: Session, session_id: str, limit: int = 20
    ) -> List[ConversationMessage]:
        rows = (
            db.query(ConversationMessage)
            .filter(ConversationMessage.session_id == session_id)
            .order_by(ConversationMessage.id.desc())
            .limit(limit)
            .all()
        )
        return list(reversed(rows))

    def get_lead_for_session(self, db: Session, session_id: str) -> Optional[Lead]:
        session = (
            db.query(ConversationSession)
            .filter(ConversationSession.session_id == session_id)
            .first()
        )
        if session and session.lead_id:
            return db.query(Lead).filter(Lead.id == session.lead_id).first()
        return None
