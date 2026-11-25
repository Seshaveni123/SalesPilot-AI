import json
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.agents.orchestrator import SalesAgentOrchestrator
from app.api.routes import get_orchestrator, get_vector_store
from app.config import PROJECT_ROOT, Settings, get_settings
from app.database.session import Base, get_db
from app.main import create_app
from app.rag.document_loader import chunk_text, load_knowledge_documents
from app.rag.vector_store import FAISSVectorStore
from app.services.conversation_manager import ConversationManager
from app.services.qualification_service import score_lead_profile
from app.services.sentiment_service import analyze_customer_text
from app.tools.registry import AgentToolDispatcher


class KeywordDeterministicEmbedder:
    """Offline deterministic embedder for fast unit testing of FAISS cosine retrieval."""

    TERMS = [
        "pricing",
        "starter",
        "growth",
        "enterprise",
        "299",
        "899",
        "2400",
        "security",
        "soc",
        "encryption",
        "gdpr",
        "crm",
        "hubspot",
        "salesforce",
        "voice",
        "onboarding",
        "demo",
        "qualification",
    ]

    def encode(self, texts):
        rows = []
        for text in texts:
            lowered = text.lower()
            vec = [float(lowered.count(term)) for term in self.TERMS]
            # Small base component to avoid all-zero vectors when unrelated
            vec.append(0.05)
            rows.append(vec)
        return np.asarray(rows, dtype=np.float32)


@pytest.fixture()
def stage3_env(tmp_path):
    db_file = tmp_path / "test_stage3.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
    Base.metadata.create_all(bind=engine)

    kb_dir = PROJECT_ROOT / "knowledge_base"
    index_dir = tmp_path / "faiss_index"
    vector_store = FAISSVectorStore(
        index_dir=index_dir,
        kb_dir=kb_dir,
        embedder=KeywordDeterministicEmbedder(),
        chunk_size=500,
        chunk_overlap=80,
    )
    vector_store.build_index()

    test_settings = Settings(
        gemini_api_key="",
        database_url=f"sqlite:///{db_file.as_posix()}",
        faiss_index_path=str(index_dir),
        knowledge_base_dir=str(kb_dir),
    )

    app = create_app()

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_vector_store] = lambda: vector_store

    with TestClient(app) as client:
        yield client, app, vector_store, TestingSessionLocal


def test_document_loading_and_chunking():
    kb_dir = PROJECT_ROOT / "knowledge_base"
    docs, chunks = load_knowledge_documents(kb_dir, chunk_size=400, chunk_overlap=60)
    assert len(docs) == 4
    assert len(chunks) >= 8
    assert all(len(c.content) <= 450 for c in chunks)
    assert chunk_text("Hello world " * 5, chunk_size=30, chunk_overlap=10)


def test_faiss_vector_store_persists_and_retrieves_sources(stage3_env):
    client, _app, vector_store, _session_local = stage3_env
    assert vector_store.is_persisted()

    # Health reports rag_indexed=True
    health = client.get("/api/health").json()
    assert health["rag_indexed"] is True

    # Document listing returns all 4 company docs
    docs_resp = client.get("/api/knowledge/documents")
    assert docs_resp.status_code == 200
    assert len(docs_resp.json()) == 4

    # Pricing query retrieves pricing_tiers.md
    search_resp = client.post(
        "/api/knowledge/search",
        json={"query": "Growth plan pricing 899 starter"},
    )
    assert search_resp.status_code == 200
    payload = search_resp.json()
    assert payload["available"] is True
    assert any(s["document_name"] == "pricing_tiers.md" for s in payload["sources"])

    # Unrelated query admits unavailability
    no_match = vector_store.search("quantum blockchain espresso machine", min_score=0.6)
    assert no_match["available"] is False
    assert no_match["sources"] == []


def test_qualification_scoring_tiers_and_disclaimer():
    hot = score_lead_profile(
        {
            "name": "Rohan",
            "email": "rohan@globex.com",
            "company": "Globex",
            "company_size": "120 employees",
            "product_interest": "Enterprise Plan",
            "budget": "$2,400/month approved",
            "requirements": "Need voice qualification synced to Salesforce",
            "timeline": "This month",
        }
    )
    assert hot.lead_score >= 70
    assert hot.lead_category == "HOT"
    assert "prototype" in hot.model_disclaimer.lower()

    warm = score_lead_profile(
        {
            "name": "Sara",
            "company": "BetaCo",
            "product_interest": "Growth Plan",
            "requirements": "Looking to automate inbound lead capture",
            "timeline": "Within 3 months",
        }
    )
    assert 40 <= warm.lead_score < 70
    assert warm.lead_category == "WARM"

    cold = score_lead_profile({"name": "Alex"})
    assert cold.lead_score < 40
    assert cold.lead_category == "COLD"


def test_text_sentiment_and_objection_extraction():
    pos = analyze_customer_text(
        "This sounds great! We are very interested and ready to schedule a demo this week."
    )
    assert pos.sentiment == "Positive"
    assert pos.purchase_interest == "High"
    assert pos.urgency == "Immediate"
    assert pos.analysis_method == "text_only_lexicon"

    neg = analyze_customer_text(
        "It feels too expensive for our budget and I am worried about SOC 2 security."
    )
    assert neg.sentiment == "Negative"
    assert "Pricing / Budget" in neg.objections
    assert "Security / Compliance" in neg.objections

    negated = analyze_customer_text("We are not interested right now.")
    assert negated.sentiment == "Negative"


def test_appointment_booking_and_double_booking_prevention(stage3_env):
    client, _app, _vector_store, _session_local = stage3_env

    lead_id = client.post(
        "/api/leads", json={"name": "Meera", "company": "Zeta Corp"}
    ).json()["id"]

    slots_before = client.get("/api/appointments/slots?date=2026-12-10").json()
    assert "10:30" in slots_before["available_slots"]

    book_resp = client.post(
        "/api/appointments",
        json={
            "lead_id": lead_id,
            "scheduled_date": "2026-12-10",
            "scheduled_time": "10:30",
            "topic": "Enterprise Demo",
        },
    )
    assert book_resp.status_code == 201
    assert book_resp.json()["status"] == "Confirmed"

    slots_after = client.get("/api/appointments/slots?date=2026-12-10").json()
    assert "10:30" not in slots_after["available_slots"]

    # Attempting to book same date & time must return 409 Conflict
    dup_resp = client.post(
        "/api/appointments",
        json={
            "lead_id": lead_id,
            "scheduled_date": "2026-12-10",
            "scheduled_time": "10:30",
        },
    )
    assert dup_resp.status_code == 409


def test_end_to_end_agent_tools_rag_booking_and_call_summary(stage3_env):
    client, app, vector_store, _session_local = stage3_env

    class MockAgentGemini:
        def __init__(self):
            self.step = 0

        def ensure_configured(self):
            return None

        def generate_with_tools(self, contents, system_instruction, tools):
            self.step += 1
            if self.step == 1:
                calls = [
                    SimpleNamespace(
                        name="search_knowledge_base",
                        args={"query": "Growth plan pricing 899"},
                    ),
                    SimpleNamespace(
                        name="save_lead_to_crm",
                        args={
                            "name": "Vikram Rao",
                            "email": "vikram@finscale.io",
                            "company": "FinScale",
                            "company_size": "80",
                            "product_interest": "Growth Plan",
                            "budget": "$899/month",
                            "requirements": "Automate inbound sales voice calls with HubSpot sync",
                            "timeline": "This month",
                        },
                    ),
                    SimpleNamespace(
                        name="book_appointment",
                        args={
                            "date": "2026-12-15",
                            "time": "14:30",
                            "topic": "Growth Plan Pilot Walkthrough",
                        },
                    ),
                    SimpleNamespace(
                        name="generate_call_summary",
                        args={"next_action": "Send Growth Plan pilot checklist before 14:30 demo"},
                    ),
                ]
                candidate = SimpleNamespace(content=SimpleNamespace(role="model", parts=[]))
                return SimpleNamespace(function_calls=calls, candidates=[candidate], text="")

            return SimpleNamespace(
                function_calls=[],
                candidates=[],
                text="Our Growth Plan is $899/month for up to 2,500 conversations. I have confirmed your walkthrough on 2026-12-15 at 14:30.",
            )

        def generate_structured(self, prompt, system_instruction, response_schema):
            return json.dumps(
                {
                    "reply": "Our Growth Plan is $899/month for up to 2,500 conversations. I have confirmed your walkthrough on 2026-12-15 at 14:30.",
                    "extracted_name": "Vikram Rao",
                    "extracted_company": "FinScale",
                    "follow_up_intent": "confirm_demo",
                }
            )

    conv_mgr = ConversationManager()
    dispatcher = AgentToolDispatcher(
        conversation_manager=conv_mgr,
        vector_store=vector_store,
        rag_top_k=3,
    )
    app.dependency_overrides[get_orchestrator] = lambda: SalesAgentOrchestrator(
        gemini_client=MockAgentGemini(),
        conversation_manager=conv_mgr,
        tool_dispatcher=dispatcher,
    )

    chat_resp = client.post(
        "/api/agent/chat",
        json={
            "session_id": "sess_e2e_stage3",
            "message": "Hi, I'm Vikram Rao at FinScale (80 staff). We want Growth Plan ($899/month) this month—sounds great, please book 2026-12-15 at 14:30!",
            "channel": "voice",
        },
    )
    assert chat_resp.status_code == 200
    body = chat_resp.json()
    assert "search_knowledge_base" in body["tools_used"]
    assert "book_appointment" in body["tools_used"]
    assert len(body["retrieved_sources"]) > 0
    assert body["lead_context"]["lead_category"] == "HOT"
    assert body["lead_context"]["sentiment"] == "Positive"

    # Verify Appointment persisted
    appts = client.get("/api/appointments").json()
    assert len(appts) == 1
    assert appts[0]["scheduled_date"] == "2026-12-15"
    assert appts[0]["scheduled_time"] == "14:30"

    # Verify Call Summary persisted
    summaries = client.get("/api/summaries").json()
    assert len(summaries) == 1
    assert summaries[0]["customer_name"] == "Vikram Rao"
    assert "Confirmed (2026-12-15 14:30)" in summaries[0]["appointment_status"]

    # Verify Analytics calculated from SQLite
    analytics = client.get("/api/analytics/overview").json()
    assert analytics["total_leads"] == 1
    assert analytics["hot_leads"] == 1
    assert analytics["confirmed_appointments"] == 1
    assert analytics["conversion_rate"] == 100.0
