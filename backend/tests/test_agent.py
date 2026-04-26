"""Tests for Agent IA PMO module — chat, recommendations, alert-rules, sessions."""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# ── Auth fixture ──────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@altair.fr",
        "password": "Admin2026!"
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]

@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ── Recommendations ───────────────────────────────────────────────────────────

class TestRecommendations:
    """GET /api/agent/recommendations"""

    def test_returns_list(self, headers):
        resp = requests.get(f"{BASE_URL}/api/agent/recommendations", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list), "Expected a list"
        print(f"Recommendations count: {len(data)}")

    def test_minimum_5_recommendations(self, headers):
        resp = requests.get(f"{BASE_URL}/api/agent/recommendations", headers=headers)
        data = resp.json()
        assert len(data) >= 5, f"Expected >=5, got {len(data)}"

    def test_severity_field_valid(self, headers):
        resp = requests.get(f"{BASE_URL}/api/agent/recommendations", headers=headers)
        data = resp.json()
        valid_severities = {"critical", "warning", "info"}
        for rec in data:
            assert rec.get("severity") in valid_severities, f"Invalid severity: {rec.get('severity')}"
            assert "type" in rec
            assert "title" in rec
            assert "description" in rec
        print(f"All {len(data)} recommendations have valid structure")


# ── Chat ──────────────────────────────────────────────────────────────────────

class TestChat:
    """POST /api/agent/chat"""

    def test_basic_chat_response(self, headers):
        resp = requests.post(f"{BASE_URL}/api/agent/chat", headers=headers, json={
            "question": "Quels sont les projets en cours?"
        }, timeout=60)
        assert resp.status_code == 200, f"Chat failed: {resp.text}"
        data = resp.json()
        assert "answer" in data
        assert "session_id" in data
        assert "verified" in data
        assert "is_simulation" in data
        assert "warnings" in data
        assert len(data["answer"]) > 10
        print(f"Chat response OK, session_id={data['session_id']}, verified={data['verified']}")
        return data["session_id"]

    def test_response_fields_types(self, headers):
        resp = requests.post(f"{BASE_URL}/api/agent/chat", headers=headers, json={
            "question": "Résume le portefeuille."
        }, timeout=60)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["answer"], str)
        assert isinstance(data["session_id"], str)
        assert isinstance(data["verified"], bool)
        assert isinstance(data["is_simulation"], bool)
        assert isinstance(data["warnings"], list)
        assert data["is_simulation"] is False

    def test_what_if_detection(self, headers):
        """Question with 'si on annule' should return is_simulation=True"""
        resp = requests.post(f"{BASE_URL}/api/agent/chat", headers=headers, json={
            "question": "Que se passe-t-il si on annule le projet Phoenix?"
        }, timeout=60)
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_simulation"] is True, f"Expected is_simulation=True, got {data['is_simulation']}"
        print(f"What-if detected correctly: is_simulation={data['is_simulation']}")

    def test_session_continuity(self, headers):
        """Sending with same session_id should keep context"""
        # First message
        resp1 = requests.post(f"{BASE_URL}/api/agent/chat", headers=headers, json={
            "question": "Combien de projets sont dans le portefeuille?"
        }, timeout=60)
        assert resp1.status_code == 200
        session_id = resp1.json()["session_id"]

        # Follow-up with same session
        resp2 = requests.post(f"{BASE_URL}/api/agent/chat", headers=headers, json={
            "question": "Et combien sont en rouge?",
            "session_id": session_id
        }, timeout=60)
        assert resp2.status_code == 200
        assert resp2.json()["session_id"] == session_id
        print(f"Session continuity OK: {session_id}")


# ── Sessions ──────────────────────────────────────────────────────────────────

class TestSessions:
    """GET /api/agent/sessions and GET /api/agent/sessions/{id}/history"""

    def test_list_sessions(self, headers):
        resp = requests.get(f"{BASE_URL}/api/agent/sessions", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"Sessions count: {len(data)}")

    def test_session_fields(self, headers):
        resp = requests.get(f"{BASE_URL}/api/agent/sessions", headers=headers)
        data = resp.json()
        if len(data) > 0:
            s = data[0]
            assert "session_id" in s
            assert "first_message" in s
            assert "last_activity" in s
            assert "message_count" in s

    def test_session_history(self, headers):
        # Get sessions first
        resp = requests.get(f"{BASE_URL}/api/agent/sessions", headers=headers)
        sessions = resp.json()
        if not sessions:
            pytest.skip("No sessions available")
        sid = sessions[0]["session_id"]
        resp2 = requests.get(f"{BASE_URL}/api/agent/sessions/{sid}/history", headers=headers)
        assert resp2.status_code == 200
        history = resp2.json()
        assert isinstance(history, list)
        if history:
            assert "question" in history[0]
            assert "response" in history[0]
        print(f"Session history: {len(history)} entries for session {sid}")


# ── Alert Rules CRUD ──────────────────────────────────────────────────────────

class TestAlertRules:
    """CRUD /api/agent/alert-rules"""

    created_rule_id = None

    def test_create_alert_rule(self, headers):
        resp = requests.post(f"{BASE_URL}/api/agent/alert-rules", headers=headers, json={
            "metric": "budget_overrun_pct",
            "threshold": 10.0,
            "scope": "portfolio",
            "enabled": True,
            "label": "TEST_Alerte budget >10%"
        })
        assert resp.status_code == 200, f"Create failed: {resp.text}"
        data = resp.json()
        assert "rule_id" in data
        assert data["metric"] == "budget_overrun_pct"
        assert data["threshold"] == 10.0
        TestAlertRules.created_rule_id = data["rule_id"]
        print(f"Created rule_id={data['rule_id']}")

    def test_list_alert_rules(self, headers):
        resp = requests.get(f"{BASE_URL}/api/agent/alert-rules", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        # Verify our created rule is in the list
        if TestAlertRules.created_rule_id:
            ids = [r["rule_id"] for r in data]
            assert TestAlertRules.created_rule_id in ids, "Created rule not found in list"
        print(f"Alert rules count: {len(data)}")

    def test_update_alert_rule_toggle(self, headers):
        if not TestAlertRules.created_rule_id:
            pytest.skip("No rule_id from create")
        rule_id = TestAlertRules.created_rule_id
        resp = requests.put(f"{BASE_URL}/api/agent/alert-rules/{rule_id}", headers=headers, json={
            "enabled": False
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["enabled"] is False
        print(f"Rule toggled to disabled: {data['enabled']}")

    def test_delete_alert_rule(self, headers):
        if not TestAlertRules.created_rule_id:
            pytest.skip("No rule_id from create")
        rule_id = TestAlertRules.created_rule_id
        resp = requests.delete(f"{BASE_URL}/api/agent/alert-rules/{rule_id}", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("deleted") is True

        # Verify deletion
        resp2 = requests.get(f"{BASE_URL}/api/agent/alert-rules", headers=headers)
        ids = [r["rule_id"] for r in resp2.json()]
        assert rule_id not in ids, "Rule should have been deleted"
        print(f"Rule {rule_id} deleted and verified")
