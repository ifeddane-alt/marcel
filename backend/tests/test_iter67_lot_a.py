"""
Iteration 67 — Lot A regression + permissions tests.
Focus: lifecycle gates permissions, skills, custom fields, saved views,
snapshots, thresholds, business capacities, PB weighted.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://project-sync-61.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin":  ("admin@altair.fr",  "Admin2026!"),
    "pmo":    ("pmo@altair.fr",    "Pmo1234!"),
    "archi":  ("archi@altair.fr",  "Archi2026!"),
    "rssi":   ("rssi@altair.fr",   "Rssi2026!"),
    "viewer": ("viewer@altair.fr", "View1234!"),
}

WATERFALL_PROJECT_ID = "c4b43099-c705-4729-abfa-1af07f3ca22f"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def tokens():
    return {k: _login(*v) for k, v in CREDS.items()}


def _h(tok): return {"Authorization": f"Bearer {tok}"}


# --- Regression: login + basic reads ---
class TestRegressionAuth:
    def test_all_logins_ok(self, tokens):
        assert set(tokens.keys()) == set(CREDS.keys())

    def test_me_admin(self, tokens):
        r = requests.get(f"{API}/auth/me", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        assert r.json()["email"] == "admin@altair.fr"


# --- Lifecycle ---
class TestLifecycle:
    def test_referential(self, tokens):
        r = requests.get(f"{API}/lifecycle/referential", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        d = r.json()
        # 6 phases expected
        assert "phases" in d
        assert len(d["phases"]) >= 6

    def test_project_lifecycle(self, tokens):
        r = requests.get(f"{API}/projects/{WATERFALL_PROJECT_ID}/lifecycle",
                         headers=_h(tokens["admin"]))
        assert r.status_code == 200
        d = r.json()
        assert "gates" in d or "current_phase" in d

    def test_viewer_cannot_request_gate(self, tokens):
        payload = {
            "target_phase": "recette",
            "target_date": "2026-12-01",
            "gov_instance_id": None,
            "deliverables": [],
        }
        r = requests.post(f"{API}/projects/{WATERFALL_PROJECT_ID}/lifecycle/gates",
                          headers=_h(tokens["viewer"]), json=payload)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_portfolio_gates(self, tokens):
        r = requests.get(f"{API}/lifecycle/portfolio", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_my_reviews_archi(self, tokens):
        r = requests.get(f"{API}/lifecycle/my-reviews", headers=_h(tokens["archi"]))
        assert r.status_code == 200

    def test_my_reviews_rssi(self, tokens):
        r = requests.get(f"{API}/lifecycle/my-reviews", headers=_h(tokens["rssi"]))
        assert r.status_code == 200


# --- Skills ---
class TestSkills:
    def test_skills_referential(self, tokens):
        r = requests.get(f"{API}/resources/skills", headers=_h(tokens["admin"]))
        assert r.status_code == 200, r.text
        data = r.json()
        # Expect at least SAP FI or Gestion de projet in seed
        names = [s.get("name") for s in (data if isinstance(data, list) else data.get("skills", []))]
        assert any("SAP" in (n or "") or "Gestion" in (n or "") for n in names), f"seed skills missing: {names}"


# --- Custom fields ---
class TestCustomFields:
    def test_list_defs(self, tokens):
        r = requests.get(f"{API}/projects/custom-fields", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, (list, dict))

    def test_route_order_not_confused_with_id(self, tokens):
        """Ensure /projects/custom-fields is NOT interpreted as /projects/{id}"""
        r = requests.get(f"{API}/projects/custom-fields", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        # Should NOT be a project object with .id == "custom-fields"
        d = r.json()
        if isinstance(d, dict) and "id" in d and "name" in d:
            assert d.get("id") != "custom-fields"


# --- Saved views ---
class TestSavedViews:
    def test_list_views(self, tokens):
        r = requests.get(f"{API}/views?page=portfolio", headers=_h(tokens["admin"]))
        assert r.status_code == 200

    def test_create_and_delete_view(self, tokens):
        payload = {"name": "TEST_view_iter67", "page": "portfolio",
                   "filters": {"rag": "red"}}
        r = requests.post(f"{API}/views", headers=_h(tokens["admin"]), json=payload)
        assert r.status_code in (200, 201), r.text
        vid = r.json().get("view_id") or r.json().get("id")
        assert vid
        # cleanup
        d = requests.delete(f"{API}/views/{vid}", headers=_h(tokens["admin"]))
        assert d.status_code in (200, 204)


# --- Snapshots ---
class TestSnapshots:
    def test_list_snapshots(self, tokens):
        r = requests.get(f"{API}/portfolio/snapshots", headers=_h(tokens["admin"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d, (list, dict))


# --- Thresholds ---
class TestThresholds:
    def test_get_thresholds(self, tokens):
        r = requests.get(f"{API}/indicators/thresholds", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        d = r.json()
        assert "cpi_amber" in d or any("cpi" in k for k in d.keys())

    def test_viewer_cannot_update_thresholds(self, tokens):
        r = requests.put(f"{API}/indicators/thresholds", headers=_h(tokens["viewer"]),
                         json={"cpi_amber": 0.99})
        assert r.status_code in (401, 403), f"expected forbidden, got {r.status_code}"


# --- Business capacities (client-side aggregation from applications) ---
class TestCapacities:
    def test_applications_have_business_capabilities(self, tokens):
        r = requests.get(f"{API}/applications", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        apps = r.json()
        assert isinstance(apps, list) and len(apps) >= 1
        # At least one app has business_capabilities populated
        has_caps = any(a.get("business_capabilities") for a in apps)
        assert has_caps, "no application has business_capabilities in seed"


# --- PB weighted ---
class TestPBWeighted:
    def test_pb_sessions_list(self, tokens):
        r = requests.get(f"{API}/pb/sessions", headers=_h(tokens["admin"]))
        assert r.status_code == 200
