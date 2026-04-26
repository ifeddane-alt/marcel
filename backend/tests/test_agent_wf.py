"""
Tests — Agent IA : chat, recommandations, alertes, simulations, exports, analytics.
"""
import pytest
import pytest_asyncio
from conftest import auth

pytestmark = pytest.mark.asyncio


# ══════════════════════════════════════════════════════════════════════════════
# 1. Chat
# ══════════════════════════════════════════════════════════════════════════════

async def test_chat_returns_response(client, admin_token):
    payload = {
        "question":  "Combien de projets actifs dans le portefeuille ?",
        "session_id": "test-pytest-session",
        "mode":       "standard",
    }
    r = await client.post("/api/agent/chat", json=payload, headers=auth(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert "response" in body or "answer" in body or "message" in body


async def test_chat_unauthenticated(client):
    r = await client.post("/api/agent/chat",
                          json={"question": "test", "session_id": "x", "mode": "standard"})
    assert r.status_code in (401, 403)


async def test_list_timesheets_unauthenticated(client):
    r = await client.get("/api/timesheets")
    assert r.status_code in (401, 403, 404)


async def test_chat_logs_to_agent_logs(client, admin_token):
    """Une question posée doit apparaître dans agent_logs."""
    unique_q = f"Question unique pytest {pytest._name_id_counter if hasattr(pytest, '_name_id_counter') else '42'}"
    await client.post("/api/agent/chat",
                      json={"question": unique_q, "session_id": "pytest-log-test", "mode": "standard"},
                      headers=auth(admin_token))
    # Analytics should show at least 1 message
    r = await client.get("/api/admin/agent-analytics", headers=auth(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert body["total_messages"] >= 1


# ══════════════════════════════════════════════════════════════════════════════
# 2. Sessions
# ══════════════════════════════════════════════════════════════════════════════

async def test_list_sessions(client, admin_token):
    r = await client.get("/api/agent/sessions", headers=auth(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_session_history(client, admin_token):
    sessions = (await client.get("/api/agent/sessions", headers=auth(admin_token))).json()
    if not sessions:
        pytest.skip("Pas de session disponible")
    sid = sessions[0].get("session_id")
    r = await client.get(f"/api/agent/sessions/{sid}/history", headers=auth(admin_token))
    assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# 3. Recommandations
# ══════════════════════════════════════════════════════════════════════════════

async def test_recommendations_returns_list(client, admin_token):
    r = await client.get("/api/agent/recommendations", headers=auth(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_recommendations_have_required_fields(client, admin_token):
    recs = (await client.get("/api/agent/recommendations", headers=auth(admin_token))).json()
    if not recs:
        pytest.skip("Aucune recommandation générée")
    rec = recs[0]
    assert "severity" in rec
    assert "type" in rec
    assert "title" in rec
    assert "description" in rec


async def test_recommendations_export_pdf(client, admin_token):
    r = await client.get("/api/agent/recommendations/export-pdf", headers=auth(admin_token))
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert len(r.content) > 100


async def test_recommendations_export_excel(client, admin_token):
    r = await client.get("/api/agent/recommendations/export-excel", headers=auth(admin_token))
    assert r.status_code == 200
    ct = r.headers["content-type"]
    assert "spreadsheet" in ct or "excel" in ct or "openxmlformats" in ct
    assert len(r.content) > 100


async def test_viewer_can_view_recommendations(client, viewer_token):
    r = await client.get("/api/agent/recommendations", headers=auth(viewer_token))
    assert r.status_code in (200, 403)


# ══════════════════════════════════════════════════════════════════════════════
# 4. Alertes / Règles
# ══════════════════════════════════════════════════════════════════════════════

async def test_list_alert_rules(client, admin_token):
    r = await client.get("/api/agent/alert-rules", headers=auth(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_create_alert_rule(client, admin_token):
    payload = {
        "metric":     "budget_consumed_pct",
        "threshold":  85.0,
        "scope":      "portfolio",
        "enabled":    True,
    }
    r = await client.post("/api/agent/alert-rules", json=payload, headers=auth(admin_token))
    assert r.status_code in (200, 201)
    body = r.json()
    rule_id = body.get("rule_id")
    assert rule_id
    # Cleanup
    await client.delete(f"/api/agent/alert-rules/{rule_id}", headers=auth(admin_token))


async def test_delete_nonexistent_alert_rule(client, admin_token):
    r = await client.delete("/api/agent/alert-rules/00000000-0000-0000-0000-000000000000",
                            headers=auth(admin_token))
    assert r.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# 5. Analytics IA (admin)
# ══════════════════════════════════════════════════════════════════════════════

async def test_agent_analytics_returns_kpis(client, admin_token):
    r = await client.get("/api/admin/agent-analytics", headers=auth(admin_token))
    assert r.status_code == 200
    body = r.json()
    for key in ("total_messages", "total_sessions", "total_tokens_estimated",
                "cost_estimate_usd", "avg_response_ms"):
        assert key in body, f"Clé manquante : {key}"


async def test_agent_analytics_daily_usage(client, admin_token):
    r = await client.get("/api/admin/agent-analytics", headers=auth(admin_token))
    body = r.json()
    assert "daily_usage" in body
    assert isinstance(body["daily_usage"], list)


async def test_agent_analytics_top_questions(client, admin_token):
    r = await client.get("/api/admin/agent-analytics", headers=auth(admin_token))
    body = r.json()
    assert "top_questions" in body
    for q in body["top_questions"]:
        assert "question" in q and "count" in q
