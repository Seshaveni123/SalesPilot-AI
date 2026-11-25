def test_manual_lead_creation_auto_scores_and_returns_360_details(test_client):
    client, _app, _settings, _session_local = test_client

    create_resp = client.post(
        "/api/leads",
        json={
            "name": "Neha Kapoor",
            "email": "neha@orbitlabs.io",
            "company": "Orbit Labs",
            "company_size": "75 employees",
            "product_interest": "Enterprise Plan",
            "budget": "$2,400/month approved",
            "requirements": "Autonomous sales voice agent with Salesforce sync",
            "timeline": "This month",
        },
    )
    assert create_resp.status_code == 201
    lead = create_resp.json()
    assert lead["lead_score"] >= 70
    assert lead["lead_category"] == "HOT"

    # Book an appointment linked to this lead
    appt_resp = client.post(
        "/api/appointments",
        json={
            "lead_id": lead["id"],
            "scheduled_date": "2026-12-20",
            "scheduled_time": "09:00",
            "topic": "Enterprise Architecture Review",
        },
    )
    assert appt_resp.status_code == 201

    # Verify 360-degree details endpoint
    details_resp = client.get(f"/api/leads/{lead['id']}/details")
    assert details_resp.status_code == 200
    details = details_resp.json()
    assert details["lead"]["id"] == lead["id"]
    assert len(details["qualification_breakdown"]) >= 5
    assert "prototype" in details["model_disclaimer"].lower()
    assert len(details["appointments"]) == 1
    assert details["appointments"][0]["scheduled_time"] == "09:00"
    assert client.get("/api/leads/99999/details").status_code == 404
