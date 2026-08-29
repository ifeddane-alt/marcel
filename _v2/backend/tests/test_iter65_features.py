"""Backend tests for iteration 65: AI Status Report, Jira connector, Home objectives drift."""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://project-sync-61.preview.emergentagent.com").rstrip("/")
PROJECT_ID = "21fa6d43-0ce8-4ee7-8e06-114ef3199006"
OBJECTIVE_ID = "63284d2c-bdad-470e-a853-03ccdf89cab6"


def _login(email, pw):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login('admin@altair.fr', 'Admin2026!')}"}


@pytest.fixture(scope="module")
def viewer_headers():
    return {"Authorization": f"Bearer {_login('viewer@altair.fr', 'View1234!')}"}


# ---------- AI Status Report ----------
class TestAIReport:
    def test_list_reports(self, admin_headers):
        r = requests.get(f"{BASE}/api/projects/{PROJECT_ID}/ai-reports", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "expected at least one existing AI report"
        self.__class__.existing_report_id = data[0].get("id") or data[0].get("report_id")

    def test_download_pdf(self, admin_headers):
        rid = getattr(self.__class__, "existing_report_id", None)
        assert rid
        r = requests.get(f"{BASE}/api/projects/{PROJECT_ID}/ai-report/{rid}/pdf", headers=admin_headers, timeout=60)
        assert r.status_code == 200
        assert "pdf" in r.headers.get("content-type", "").lower()
        assert r.content[:4] == b"%PDF"

    def test_viewer_forbidden_list(self, viewer_headers):
        r = requests.get(f"{BASE}/api/projects/{PROJECT_ID}/ai-reports", headers=viewer_headers, timeout=30)
        assert r.status_code == 403

    def test_viewer_forbidden_generate(self, viewer_headers):
        r = requests.post(f"{BASE}/api/projects/{PROJECT_ID}/ai-report", headers=viewer_headers, timeout=30)
        assert r.status_code == 403

    def test_viewer_forbidden_pdf(self, viewer_headers):
        rid = getattr(TestAIReport, "existing_report_id", None) or "any"
        r = requests.get(f"{BASE}/api/projects/{PROJECT_ID}/ai-report/{rid}/pdf", headers=viewer_headers, timeout=30)
        assert r.status_code == 403

    def test_generate_ai_report(self, admin_headers):
        r = requests.post(f"{BASE}/api/projects/{PROJECT_ID}/ai-report", headers=admin_headers, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "report_id" in data or "id" in data
        assert "week_label" in data
        content = data.get("content") or {}
        for k in ("synthese", "faits_marquants", "alertes", "prochaines_etapes", "tendance"):
            assert k in content, f"missing key {k}"
        assert isinstance(content["faits_marquants"], list)


# ---------- Jira Connector ----------
class TestJira:
    def test_config_get_masked(self, admin_headers):
        r = requests.get(f"{BASE}/api/connectors/jira/config", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        cfg = r.json()
        token = cfg.get("api_token") or cfg.get("credentials", {}).get("api_token", "")
        assert "•" in str(token) or token == "" or "***" in str(token), f"api_token not masked: {token}"

    def test_connection(self, admin_headers):
        r = requests.post(f"{BASE}/api/connectors/jira/test", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True
        # display name should mention Robot MARCEL
        text = str(d).lower()
        assert "marcel" in text or "robot" in text

    def test_remote_projects(self, admin_headers):
        r = requests.get(f"{BASE}/api/connectors/jira/remote-projects", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        items = r.json()
        keys = [i.get("key") for i in items]
        assert "WEB" in keys and "MOB" in keys

    def test_sync(self, admin_headers):
        r = requests.post(f"{BASE}/api/connectors/jira/sync", headers=admin_headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") == "success"
        assert d.get("items_updated", 0) >= 1

    def test_project_has_jira_sync(self, admin_headers):
        r = requests.get(f"{BASE}/api/projects/{PROJECT_ID}", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        p = r.json()
        js = p.get("jira_sync") or {}
        assert js.get("jira_key") == "WEB"
        assert js.get("issues_done") == 34
        assert js.get("issues_total") == 50
        assert js.get("progress_pct") == 68

    def test_viewer_forbidden_config(self, viewer_headers):
        r = requests.get(f"{BASE}/api/connectors/jira/config", headers=viewer_headers, timeout=30)
        assert r.status_code == 403

    def test_viewer_forbidden_sync(self, viewer_headers):
        r = requests.post(f"{BASE}/api/connectors/jira/sync", headers=viewer_headers, timeout=30)
        assert r.status_code == 403


# ---------- Home objectives drift ----------
class TestObjectivesDrift:
    def test_drift_flow(self, admin_headers):
        # Set value to 9 -> drift expected
        r = requests.post(f"{BASE}/api/objectives/{OBJECTIVE_ID}/target-value",
                          headers=admin_headers, json={"value": 9}, timeout=30)
        assert r.status_code in (200, 201), r.text

        r = requests.get(f"{BASE}/api/home/summary", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        summary = r.json()
        drift = summary.get("objectives_drift") or []
        found = [d for d in drift if d.get("id") == OBJECTIVE_ID or d.get("objective_id") == OBJECTIVE_ID]
        assert found, f"objective not in drift list: {drift}"
        item = found[0]
        assert item.get("current") == 9 or item.get("current_value") == 9
        assert item.get("previous") == 11 or item.get("previous_value") == 11

    def test_restore_value(self, admin_headers):
        r = requests.post(f"{BASE}/api/objectives/{OBJECTIVE_ID}/target-value",
                          headers=admin_headers, json={"value": 11}, timeout=30)
        assert r.status_code in (200, 201)

        r = requests.get(f"{BASE}/api/home/summary", headers=admin_headers, timeout=30)
        summary = r.json()
        drift = summary.get("objectives_drift") or []
        found = [d for d in drift if (d.get("id") == OBJECTIVE_ID or d.get("objective_id") == OBJECTIVE_ID)]
        assert not found, f"drift should be gone after restore, still: {found}"
