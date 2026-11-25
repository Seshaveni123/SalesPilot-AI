import json
from types import SimpleNamespace

from app.agents.gemini_client import GeminiServiceError
from app.agents.orchestrator import SalesAgentOrchestrator
from app.api.routes import get_orchestrator
from app.services.conversation_manager import ConversationManager
from app.tools.registry import AgentToolDispatcher


def test_health_endpoint_reports_real_status_without_api_key(test_client):
    client, _app, _settings, _session_local = test_client
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["database_connected"] is True
    assert body["gemini_configured"] is False
    assert body["rag_indexed"] is False


def test_chat_fails_cleanly_when_gemini_key_missing(test_client):
    client, _app, _settings, _session_local = test_client
    resp = client.post(
        "/api/agent/chat",
        json={"session_id": "sess_missing_key", "message": "Hi, tell me about pricing."},
    )
    assert resp.status_code == 503
    body = resp.json()
    assert body["error_code"] == "GEMINI_API_KEY_MISSING"
    assert "GEMINI_API_KEY" in body["detail"]
    assert "setup_instructions" in body and body["setup_instructions"]


def test_chat_rejects_empty_message_with_validation_error(test_client):
    client, _app, _settings, _session_local = test_client
    resp = client.post(
        "/api/agent/chat",
        json={"session_id": "sess_invalid", "message": ""},
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["error_code"] == "VALIDATION_ERROR"


def test_leads_crud_and_real_analytics_calculation(test_client):
    client, _app, _settings, _session_local = test_client

    # Empty DB analytics must return zeros
    empty_analytics = client.get("/api/analytics/overview")
    assert empty_analytics.status_code == 200
    assert empty_analytics.json()["total_leads"] == 0

    # Create lead (auto-scored by prototype rubric)
    create_resp = client.post(
        "/api/leads",
        json={
            "name": "Aarav Mehta",
            "email": "aarav@acme.io",
            "company": "Acme Logistics",
            "product_interest": "Enterprise Voice Suite",
            "budget": "$25,000",
            "timeline": "This quarter",
        },
    )
    assert create_resp.status_code == 201
    lead = create_resp.json()
    lead_id = lead["id"]
    assert lead["name"] == "Aarav Mehta"
    assert lead["lead_score"] == 75
    assert lead["lead_category"] == "HOT"

    # Update lead qualification
    patch_resp = client.patch(
        f"/api/leads/{lead_id}",
        json={"lead_score": 88, "lead_category": "HOT", "sentiment": "Positive"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["lead_score"] == 88
    assert patch_resp.json()["lead_category"] == "HOT"

    # Analytics reflects real persisted lead
    analytics = client.get("/api/analytics/overview").json()
    assert analytics["total_leads"] == 1
    assert analytics["hot_leads"] == 1
    assert analytics["average_lead_score"] == 88.0
    assert analytics["sentiment_distribution"]["positive"] == 1

    # Missing lead returns 404
    assert client.get("/api/leads/99999").status_code == 404


def test_agent_orchestrator_tool_calling_memory_and_structured_output(test_client):
    client, app, _settings, _session_local = test_client

    class FakeGeminiClient:
        def __init__(self):
            self.calls = 0

        def ensure_configured(self):
            return None

        def generate_with_tools(self, contents, system_instruction, tools):
            self.calls += 1
            if self.calls == 1:
                fc = SimpleNamespace(
                    name="save_lead_to_crm",
                    args={
                        "name": "Priya Nair",
                        "company": "Northstar Cloud",
                        "product_interest": "SalesPilot Pro",
                        "budget": "$15,000/yr",
                    },
                )
                candidate = SimpleNamespace(content=SimpleNamespace(role="model", parts=[]))
                return SimpleNamespace(function_calls=[fc], candidates=[candidate], text="")
            return SimpleNamespace(
                function_calls=[],
                candidates=[],
                text="Thanks Priya! I have noted Northstar Cloud's interest in SalesPilot Pro. What timeline are you targeting?",
            )

        def generate_structured(self, prompt, system_instruction, response_schema):
            return json.dumps(
                {
                    "reply": "Thanks Priya! I have noted Northstar Cloud's interest in SalesPilot Pro. What timeline are you targeting?",
                    "extracted_name": "Priya Nair",
                    "extracted_company": "Northstar Cloud",
                    "extracted_product_interest": "SalesPilot Pro",
                    "extracted_budget": "$15,000/yr",
                    "follow_up_intent": "clarify_timeline",
                }
            )

    conv_mgr = ConversationManager()
    dispatcher = AgentToolDispatcher(conversation_manager=conv_mgr)
    fake_orchestrator = SalesAgentOrchestrator(
        gemini_client=FakeGeminiClient(),
        conversation_manager=conv_mgr,
        tool_dispatcher=dispatcher,
    )
    app.dependency_overrides[get_orchestrator] = lambda: fake_orchestrator

    chat_resp = client.post(
        "/api/agent/chat",
        json={
            "session_id": "sess_tool_test",
            "message": "Hi, I'm Priya Nair from Northstar Cloud. Interested in SalesPilot Pro with a $15,000/yr budget.",
            "channel": "voice",
        },
    )
    assert chat_resp.status_code == 200
    body = chat_resp.json()
    assert body["tools_used"] == ["save_lead_to_crm"]
    assert body["follow_up_intent"] == "clarify_timeline"
    assert body["lead_context"]["name"] == "Priya Nair"
    assert body["lead_context"]["company"] == "Northstar Cloud"

    # Verify conversation & messages persisted in SQLite
    sessions = client.get("/api/conversations").json()
    assert len(sessions) == 1
    assert sessions[0]["session_id"] == "sess_tool_test"
    assert sessions[0]["message_count"] == 2

    msgs = client.get("/api/conversations/sess_tool_test/messages").json()
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    assert msgs[1]["tools_used"] == ["save_lead_to_crm"]

    # Verify lead persisted in CRM
    leads = client.get("/api/leads").json()
    assert len(leads) == 1
    assert leads[0]["name"] == "Priya Nair"


def test_upstream_gemini_error_returns_502(test_client):
    client, app, _settings, _session_local = test_client

    class FailingGeminiClient:
        def ensure_configured(self):
            return None

        def generate_with_tools(self, contents, system_instruction, tools):
            raise GeminiServiceError("Simulated upstream failure")

    conv_mgr = ConversationManager()
    app.dependency_overrides[get_orchestrator] = lambda: SalesAgentOrchestrator(
        gemini_client=FailingGeminiClient(),
        conversation_manager=conv_mgr,
        tool_dispatcher=AgentToolDispatcher(conv_mgr),
    )

    resp = client.post(
        "/api/agent/chat",
        json={"session_id": "sess_err", "message": "Hello"},
    )
    assert resp.status_code == 502
    assert resp.json()["error_code"] == "GEMINI_UPSTREAM_ERROR"
