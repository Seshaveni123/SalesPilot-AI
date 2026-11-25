import json
from types import SimpleNamespace

from tests.test_stage3_rag_and_automation import KeywordDeterministicEmbedder
from app.agents.orchestrator import SalesAgentOrchestrator
from app.api.routes import get_orchestrator, get_vector_store
from app.config import PROJECT_ROOT, Settings, get_settings
from app.database.session import Base, get_db
from app.main import create_app
from app.rag.vector_store import FAISSVectorStore
from app.services.conversation_manager import ConversationManager
from app.tools.registry import AgentToolDispatcher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def test_complete_multi_turn_voice_sales_workflow_and_conflict_handling(tmp_path):
    """
    End-to-end Stage 5 workflow test simulating a 3-turn voice conversation:
    - Turn 1: Prospect introduces company & asks about Enterprise pricing & SOC 2 (RAG + CRM save)
    - Turn 2: Prospect raises budget/timing concern and asks for slots (Memory retained + Sentiment + Slots)
    - Turn 3: Prospect confirms slot -> DB appointment booked -> Duplicate slot rejected -> Call summary persisted -> Analytics updated
    """
    db_file = tmp_path / "e2e_stage5.db"
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

    class MultiTurnScriptedGemini:
        def __init__(self):
            self.turn = 0
            self.sub_call = 0

        def ensure_configured(self):
            return None

        def generate_with_tools(self, contents, system_instruction, tools):
            self.sub_call += 1
            # Odd sub_calls trigger tools, even sub_calls return text response
            if self.sub_call % 2 == 1:
                self.turn += 1
                candidate = SimpleNamespace(content=SimpleNamespace(role="model", parts=[]))
                if self.turn == 1:
                    calls = [
                        SimpleNamespace(
                            name="search_knowledge_base",
                            args={"query": "enterprise pricing 2400 soc 2 security"},
                        ),
                        SimpleNamespace(
                            name="save_lead_to_crm",
                            args={
                                "name": "Karan Verma",
                                "email": "karan@apexfin.com",
                                "company": "ApexFin",
                                "company_size": "150 employees",
                                "product_interest": "Enterprise Plan",
                                "requirements": "Voice sales qualification with SOC 2 compliance",
                            },
                        ),
                    ]
                    return SimpleNamespace(function_calls=calls, candidates=[candidate], text="")

                if self.turn == 2:
                    calls = [
                        SimpleNamespace(name="get_customer_context", args={}),
                        SimpleNamespace(
                            name="analyze_sentiment",
                            args={"utterance": "Pricing feels slightly expensive, can we see demo slots on 2026-12-22?"},
                        ),
                        SimpleNamespace(
                            name="save_lead_to_crm",
                            args={"budget": "$2,400/month", "timeline": "This month"},
                        ),
                        SimpleNamespace(name="qualify_lead", args={}),
                        SimpleNamespace(
                            name="check_available_slots",
                            args={"date": "2026-12-22"},
                        ),
                    ]
                    return SimpleNamespace(function_calls=calls, candidates=[candidate], text="")

                calls = [
                    SimpleNamespace(
                        name="book_appointment",
                        args={
                            "date": "2026-12-22",
                            "time": "10:30",
                            "topic": "Enterprise Security & ROI Demo",
                        },
                    ),
                    # Attempt duplicate booking inside tool dispatcher to verify conflict guard
                    SimpleNamespace(
                        name="book_appointment",
                        args={
                            "date": "2026-12-22",
                            "time": "10:30",
                            "topic": "Duplicate Attempt",
                        },
                    ),
                    SimpleNamespace(
                        name="generate_call_summary",
                        args={"next_action": "Send SOC 2 package before Dec 22 demo"},
                    ),
                ]
                return SimpleNamespace(function_calls=calls, candidates=[candidate], text="")

            if self.turn == 1:
                return SimpleNamespace(
                    function_calls=[],
                    candidates=[],
                    text="Our Enterprise Plan starts at $2,400/month and includes SOC 2 Type II compliance.",
                )
            if self.turn == 2:
                return SimpleNamespace(
                    function_calls=[],
                    candidates=[],
                    text="I understand budget matters, Karan. For 2026-12-22, open slots are 09:00, 10:30, 13:00, 14:30, and 16:00. Which would you like me to confirm?",
                )
            return SimpleNamespace(
                function_calls=[],
                candidates=[],
                text="Confirmed for 2026-12-22 at 10:30! I have saved your summary.",
            )

        def generate_structured(self, prompt, system_instruction, response_schema):
            if self.turn == 1:
                return json.dumps(
                    {
                        "reply": "Our Enterprise Plan starts at $2,400/month and includes SOC 2 Type II compliance.",
                        "extracted_name": "Karan Verma",
                        "extracted_company": "ApexFin",
                        "follow_up_intent": "qualify_budget_timeline",
                    }
                )
            if self.turn == 2:
                return json.dumps(
                    {
                        "reply": "I understand budget matters, Karan. For 2026-12-22, open slots are 09:00, 10:30, 13:00, 14:30, and 16:00. Which would you like me to confirm?",
                        "extracted_budget": "$2,400/month",
                        "extracted_timeline": "This month",
                        "follow_up_intent": "await_booking_confirmation",
                    }
                )
            return json.dumps(
                {
                    "reply": "Confirmed for 2026-12-22 at 10:30! I have saved your summary.",
                    "follow_up_intent": "wrap_up",
                }
            )

    conv_mgr = ConversationManager()
    dispatcher = AgentToolDispatcher(
        conversation_manager=conv_mgr, vector_store=vector_store, rag_top_k=3
    )
    orchestrator = SalesAgentOrchestrator(
        gemini_client=MultiTurnScriptedGemini(),
        conversation_manager=conv_mgr,
        tool_dispatcher=dispatcher,
    )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_vector_store] = lambda: vector_store
    app.dependency_overrides[get_orchestrator] = lambda: orchestrator

    with TestClient(app) as client:
        session_id = "voice_sess_e2e"

        # Turn 1
        r1 = client.post(
            "/api/agent/chat",
            json={
                "session_id": session_id,
                "message": "Hi, I'm Karan Verma from ApexFin (150 employees). Does Enterprise support SOC 2?",
                "channel": "voice",
            },
        )
        assert r1.status_code == 200
        d1 = r1.json()
        assert "search_knowledge_base" in d1["tools_used"]
        assert len(d1["retrieved_sources"]) > 0
        assert d1["lead_context"]["name"] == "Karan Verma"

        # Turn 2
        r2 = client.post(
            "/api/agent/chat",
            json={
                "session_id": session_id,
                "message": "The price feels a bit expensive, though we have $2,400/month this month. What slots are open on 2026-12-22?",
                "channel": "voice",
            },
        )
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["lead_context"]["company"] == "ApexFin"  # Memory preserved across turns
        assert d2["lead_context"]["lead_category"] == "HOT"
        assert "Pricing / Budget" in d2["lead_context"]["objections"]

        # Turn 3
        r3 = client.post(
            "/api/agent/chat",
            json={
                "session_id": session_id,
                "message": "Yes, please confirm 2026-12-22 at 10:30.",
                "channel": "voice",
            },
        )
        assert r3.status_code == 200

        # Verify database state across all CRM tables
        appts = client.get("/api/appointments").json()
        assert len(appts) == 1  # Duplicate attempt inside Turn 3 was blocked!
        assert appts[0]["scheduled_time"] == "10:30"

        slots = client.get("/api/appointments/slots?date=2026-12-22").json()
        assert "10:30" not in slots["available_slots"]

        summaries = client.get("/api/summaries").json()
        assert len(summaries) == 1
        assert summaries[0]["customer_name"] == "Karan Verma"
        assert "Confirmed (2026-12-22 10:30)" in summaries[0]["appointment_status"]

        messages = client.get(f"/api/conversations/{session_id}/messages").json()
        assert len(messages) == 6  # 3 user + 3 assistant turns

        analytics = client.get("/api/analytics/overview").json()
        assert analytics["total_leads"] == 1
        assert analytics["hot_leads"] == 1
        assert analytics["confirmed_appointments"] == 1
        assert analytics["total_conversations"] == 1
        assert analytics["conversion_rate"] == 100.0
