"""RBAC security audit validation (MARCEL V2).

Validates the authorization fixes:
 - arbitrage writes require arbitrage.edit / arbitrage.simulate
 - connectors test + profiles seed require admin.config
 - apply-template / engagement attest require projects.edit(_own)
 - non-regression on core CRUD (projects / risks / tasks)
"""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("admin@altair.fr", "Admin2026!"),
    "manager": ("manager@altair.fr", "Altair2026!"),
    "viewer": ("viewer@altair.fr", "View1234!"),
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {email}: {r.status_code} {r.text[:300]}")
    data = r.json()
    return data["access_token"], data.get("permissions", [])


@pytest.fixture(scope="session")
def tokens():
    out = {}
    for k, (e, p) in CREDS.items():
        tok, perms = _login(e, p)
        out[k] = {"token": tok, "perms": perms, "email": e}
    return out


def H(tokens, who):
    return {"Authorization": f"Bearer {tokens[who]['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def project_id(tokens):
    r = requests.get(f"{API}/projects", headers=H(tokens, "admin"), timeout=30)
    assert r.status_code == 200, r.text[:300]
    items = r.json()
    if isinstance(items, dict):
        items = items.get("items") or items.get("projects") or []
    assert items, "No project available for tests"
    return items[0]["project_id"]


# ── Permission preconditions ────────────────────────────────────────────────
class TestPermissionPreconditions:
    def test_admin_wildcard(self, tokens):
        assert "*" in tokens["admin"]["perms"]

    def test_manager_perms(self, tokens):
        p = tokens["manager"]["perms"]
        assert "arbitrage.edit" in p
        assert "arbitrage.simulate" in p
        assert "projects.edit" in p
        assert "admin.config" not in p and "*" not in p

    def test_viewer_perms(self, tokens):
        p = tokens["viewer"]["perms"]
        assert "arbitrage.edit" not in p
        assert "arbitrage.simulate" not in p
        assert "projects.edit" not in p
        assert "*" not in p


# ── AUTHZ DENY: arbitrage writes for viewer (no arbitrage.edit) ─────────────
class TestArbitrageDenyViewer:
    def test_put_weights_denied(self, tokens):
        cur = requests.get(f"{API}/arbitrage/weights", headers=H(tokens, "viewer"), timeout=30)
        assert cur.status_code == 200, f"GET weights for viewer: {cur.status_code} {cur.text[:200]}"
        body = {k: cur.json().get(k, 1) for k in ("w1", "w2", "w3", "w4", "w5", "w6")}
        r = requests.put(f"{API}/arbitrage/weights", headers=H(tokens, "viewer"), json=body, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_patch_scoring_denied(self, tokens, project_id):
        r = requests.patch(f"{API}/arbitrage/projects/{project_id}/scoring",
                           headers=H(tokens, "viewer"), json={"strategic_alignment": 5}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_post_envelope_denied(self, tokens):
        r = requests.post(f"{API}/arbitrage/envelopes", headers=H(tokens, "viewer"),
                          json={"year": 2098, "capex_envelope": 1, "opex_envelope": 1}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_delete_envelope_denied(self, tokens):
        r = requests.delete(f"{API}/arbitrage/envelopes/whatever", headers=H(tokens, "viewer"), timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_post_scenario_denied(self, tokens):
        r = requests.post(f"{API}/arbitrage/scenarios", headers=H(tokens, "viewer"),
                          json={"name": "TEST_t", "modifications": []}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_apply_scenario_denied(self, tokens):
        r = requests.post(f"{API}/arbitrage/scenarios/whatever/apply", headers=H(tokens, "viewer"), timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_delete_scenario_denied(self, tokens):
        r = requests.delete(f"{API}/arbitrage/scenarios/whatever", headers=H(tokens, "viewer"), timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"


# ── AUTHZ ALLOW: arbitrage writes for manager (has arbitrage.edit) ──────────
class TestArbitrageAllowManager:
    def test_put_weights_allowed(self, tokens):
        cur = requests.get(f"{API}/arbitrage/weights", headers=H(tokens, "manager"), timeout=30)
        assert cur.status_code == 200, cur.text[:300]
        body = {k: cur.json().get(k, 1) for k in ("w1", "w2", "w3", "w4", "w5", "w6")}
        r = requests.put(f"{API}/arbitrage/weights", headers=H(tokens, "manager"), json=body, timeout=30)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:300]}"

    def test_envelope_create_and_cleanup(self, tokens):
        r = requests.post(f"{API}/arbitrage/envelopes", headers=H(tokens, "manager"),
                          json={"year": 2098, "label": "TEST_env", "capex_envelope": 1, "opex_envelope": 1},
                          timeout=30)
        assert r.status_code == 201, f"expected 201, got {r.status_code}: {r.text[:300]}"
        env_id = r.json().get("envelope_id")
        assert isinstance(env_id, str) and env_id
        # verify persistence
        g = requests.get(f"{API}/arbitrage/envelopes", headers=H(tokens, "manager"), timeout=30)
        assert g.status_code == 200
        assert any(e.get("envelope_id") == env_id for e in g.json())
        # cleanup
        d = requests.delete(f"{API}/arbitrage/envelopes/{env_id}", headers=H(tokens, "manager"), timeout=30)
        assert d.status_code in (200, 204), f"cleanup delete: {d.status_code} {d.text[:200]}"
        g2 = requests.get(f"{API}/arbitrage/envelopes", headers=H(tokens, "manager"), timeout=30)
        assert not any(e.get("envelope_id") == env_id for e in g2.json())

    def test_scenario_create_apply_delete(self, tokens):
        r = requests.post(f"{API}/arbitrage/scenarios", headers=H(tokens, "manager"),
                          json={"name": "TEST_scenario_rbac", "modifications": []}, timeout=30)
        assert r.status_code in (200, 201), f"expected 2xx, got {r.status_code}: {r.text[:300]}"
        sid = r.json().get("scenario_id")
        assert sid
        d = requests.delete(f"{API}/arbitrage/scenarios/{sid}", headers=H(tokens, "manager"), timeout=30)
        assert d.status_code in (200, 204), f"delete scenario: {d.status_code} {d.text[:200]}"

    def test_patch_scoring_allowed(self, tokens, project_id):
        r = requests.patch(f"{API}/arbitrage/projects/{project_id}/scoring",
                           headers=H(tokens, "manager"), json={"business_value": 4}, timeout=30)
        assert r.status_code in (200, 201), f"expected 200, got {r.status_code}: {r.text[:300]}"


# ── AUTHZ: admin.config gated endpoints ────────────────────────────────────
class TestAdminConfigGates:
    def test_connectors_jira_test_denied_manager(self, tokens):
        r = requests.post(f"{API}/connectors/jira/test", headers=H(tokens, "manager"), json={}, timeout=60)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_connectors_jira_test_not_denied_admin(self, tokens):
        r = requests.post(f"{API}/connectors/jira/test", headers=H(tokens, "admin"), json={}, timeout=60)
        assert r.status_code != 403, f"admin got 403 (regression): {r.text[:300]}"

    def test_profiles_seed_denied_manager(self, tokens):
        r = requests.post(f"{API}/profiles/seed", headers=H(tokens, "manager"), json={}, timeout=60)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_profiles_seed_full_denied_manager(self, tokens):
        r = requests.post(f"{API}/profiles/seed-full", headers=H(tokens, "manager"), json={}, timeout=60)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_profiles_seed_denied_viewer(self, tokens):
        r = requests.post(f"{API}/profiles/seed", headers=H(tokens, "viewer"), json={}, timeout=60)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_profiles_seed_allowed_admin(self, tokens):
        r = requests.post(f"{API}/profiles/seed", headers=H(tokens, "admin"), json={}, timeout=90)
        assert r.status_code in (200, 201), f"expected 2xx, got {r.status_code}: {r.text[:300]}"


# ── AUTHZ: apply-template requires projects.edit ───────────────────────────
class TestApplyTemplate:
    def test_denied_viewer(self, tokens, project_id):
        r = requests.post(f"{API}/projects/{project_id}/apply-template", headers=H(tokens, "viewer"),
                          json={"template_id": "TEST_none", "selected_phases": None}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_not_denied_manager(self, tokens, project_id):
        r = requests.post(f"{API}/projects/{project_id}/apply-template", headers=H(tokens, "manager"),
                          json={"template_id": "TEST_none", "selected_phases": None}, timeout=30)
        assert r.status_code != 403, f"manager got 403 (regression): {r.text[:300]}"
        assert r.status_code in (200, 201, 400, 404), f"unexpected {r.status_code}: {r.text[:300]}"


# ── AUTHZ: engagement attest requires projects.edit ────────────────────────
class TestEngagementAttest:
    def test_denied_viewer(self, tokens, project_id):
        r = requests.post(f"{API}/projects/{project_id}/engagement/attest", headers=H(tokens, "viewer"),
                          json={"criterion_id": "x", "checked": True}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_allowed_manager(self, tokens, project_id):
        r = requests.post(f"{API}/projects/{project_id}/engagement/attest", headers=H(tokens, "manager"),
                          json={"criterion_id": "x", "checked": True}, timeout=30)
        assert r.status_code in (200, 201), f"expected 200, got {r.status_code}: {r.text[:300]}"


# ── NON-REGRESSION: core CRUD ──────────────────────────────────────────────
class TestCoreCrudNonRegression:
    created = {"projects": [], "risks": [], "tasks": []}

    def test_admin_create_project(self, tokens):
        payload = {
            "name": "TEST_RBAC_Project",
            "methodology": "agile",
            "start_date": "2026-01-01",
            "end_date_baseline": "2026-12-31",
            "end_date_forecast": "2026-12-31",
        }
        r = requests.post(f"{API}/projects", headers=H(tokens, "admin"), json=payload, timeout=30)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"
        pid = r.json()["project_id"]
        self.created["projects"].append(pid)
        g = requests.get(f"{API}/projects/{pid}", headers=H(tokens, "admin"), timeout=30)
        assert g.status_code == 200
        assert g.json()["name"] == "TEST_RBAC_Project"

    def test_admin_update_project(self, tokens):
        pid = self.created["projects"][0]
        r = requests.put(f"{API}/projects/{pid}", headers=H(tokens, "admin"),
                         json={"name": "TEST_RBAC_Project_upd"}, timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        g = requests.get(f"{API}/projects/{pid}", headers=H(tokens, "admin"), timeout=30)
        assert g.json()["name"] == "TEST_RBAC_Project_upd"

    def test_admin_create_risk(self, tokens):
        pid = self.created["projects"][0]
        payload = {"project_id": pid, "title": "TEST_RBAC_Risk", "category": "technique",
                   "probability": 3, "impact": 3}
        r = requests.post(f"{API}/risks", headers=H(tokens, "admin"), json=payload, timeout=30)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"
        rid = r.json()["risk_id"]
        self.created["risks"].append(rid)
        g = requests.get(f"{API}/risks", headers=H(tokens, "admin"), params={"project_id": pid}, timeout=30)
        assert g.status_code == 200
        assert any(x.get("risk_id") == rid for x in g.json())

    def test_admin_create_task(self, tokens):
        pid = self.created["projects"][0]
        payload = {"project_id": pid, "name": "TEST_RBAC_Task", "type": "development"}
        r = requests.post(f"{API}/tasks", headers=H(tokens, "admin"), json=payload, timeout=30)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"
        tid = r.json()["task_id"]
        self.created["tasks"].append(tid)
        g = requests.get(f"{API}/tasks", headers=H(tokens, "admin"), params={"project_id": pid}, timeout=30)
        assert g.status_code == 200
        assert any(x.get("task_id") == tid for x in g.json())

    def test_manager_can_create_project(self, tokens):
        payload = {
            "name": "TEST_RBAC_Project_Mgr",
            "methodology": "agile",
            "start_date": "2026-01-01",
            "end_date_baseline": "2026-12-31",
            "end_date_forecast": "2026-12-31",
        }
        r = requests.post(f"{API}/projects", headers=H(tokens, "manager"), json=payload, timeout=30)
        assert r.status_code in (200, 201), f"manager blocked: {r.status_code} {r.text[:300]}"
        self.created["projects"].append(r.json()["project_id"])

    def test_viewer_cannot_create_project(self, tokens):
        payload = {
            "name": "TEST_RBAC_Project_Viewer",
            "methodology": "agile",
            "start_date": "2026-01-01",
            "end_date_baseline": "2026-12-31",
            "end_date_forecast": "2026-12-31",
        }
        r = requests.post(f"{API}/projects", headers=H(tokens, "viewer"), json=payload, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_viewer_cannot_create_risk(self, tokens):
        pid = self.created["projects"][0]
        r = requests.post(f"{API}/risks", headers=H(tokens, "viewer"),
                          json={"project_id": pid, "title": "TEST_x", "category": "technique",
                                "probability": 2, "impact": 2}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_viewer_cannot_create_task(self, tokens):
        pid = self.created["projects"][0]
        r = requests.post(f"{API}/tasks", headers=H(tokens, "viewer"),
                          json={"project_id": pid, "name": "TEST_x", "type": "development"}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_zz_cleanup(self, tokens):
        h = H(tokens, "admin")
        for tid in self.created["tasks"]:
            requests.delete(f"{API}/tasks/{tid}", headers=h, timeout=30)
        for rid in self.created["risks"]:
            requests.delete(f"{API}/risks/{rid}", headers=h, timeout=30)
        for pid in self.created["projects"]:
            d = requests.delete(f"{API}/projects/{pid}", headers=h, timeout=30)
            assert d.status_code in (200, 204, 404), f"cleanup project {pid}: {d.status_code}"
            g = requests.get(f"{API}/projects/{pid}", headers=h, timeout=30)
            assert g.status_code == 404, f"project {pid} still exists after delete"
