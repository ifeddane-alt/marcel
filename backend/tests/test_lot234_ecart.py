"""Backend tests for MARCEL Lot 2 (project form simplified), Lot 3 (tabs, deep-link)
and ÉCART (portfolio consistency alerts)."""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / "frontend" / ".env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = "admin@altair.fr"
ADMIN_PWD = "Admin2026!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture
def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ─── LOT2-C : POST projects sans jh_planned ni capex/opex → 201 ────────────
class TestLot2ProjectCreationMinimal:
    def test_create_minimal_project_no_budget(self, auth):
        payload = {
            "name": "TEST_LOT2_Minimal",
            "methodology": "agile",
            "status_rag": "green",
            "start_date": "2026-09-01",
            "end_date_baseline": "2026-12-31",
            "end_date_forecast": "2026-12-31",
        }
        r = requests.post(f"{BASE_URL}/api/projects", json=payload, headers=auth, timeout=15)
        assert r.status_code == 201, r.text
        proj = r.json()
        assert proj["name"] == "TEST_LOT2_Minimal"
        assert proj.get("jh_planned", 0) == 0
        pid = proj["project_id"]

        # Verify persistence
        g = requests.get(f"{BASE_URL}/api/projects/{pid}", headers=auth, timeout=15)
        assert g.status_code == 200
        assert g.json()["name"] == "TEST_LOT2_Minimal"

        # Cleanup
        d = requests.delete(f"{BASE_URL}/api/projects/{pid}", headers=auth, timeout=15)
        assert d.status_code in (200, 204)


# ─── ÉCART-A : GET /api/projects/consistency ───────────────────────────────
class TestConsistencyAlerts:
    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/projects/consistency", timeout=15)
        assert r.status_code in (401, 403)

    def test_consistency_shape_and_values(self, auth):
        r = requests.get(f"{BASE_URL}/api/projects/consistency", headers=auth, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 3, f"Expected ≥3 alerts, got {len(data)}"

        # Shape validation on first item
        item = data[0]
        for k in ("project_id", "name", "task_count", "gaps", "max_gap_pct"):
            assert k in item, f"missing {k}"
        assert isinstance(item["gaps"], list) and len(item["gaps"]) > 0
        g0 = item["gaps"][0]
        for k in ("field", "label", "declared", "tasks_sum", "gap_pct"):
            assert k in g0

        # Sorted desc by max_gap_pct
        gaps = [a["max_gap_pct"] for a in data]
        assert gaps == sorted(gaps, reverse=True), f"not sorted desc: {gaps}"

        # PRJ-006 expected 100%
        by_code = {a.get("code"): a for a in data if a.get("code")}
        if "PRJ-006" in by_code:
            assert by_code["PRJ-006"]["max_gap_pct"] >= 90

    def test_consistency_route_before_project_id(self, auth):
        # Ensure /consistency is NOT interpreted as a project_id — should return list, not 404
        r = requests.get(f"{BASE_URL}/api/projects/consistency", headers=auth, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ─── LOT2-D : indicator preset P1 ──────────────────────────────────────────
class TestIndicatorPresetP1:
    def test_preset_p1_dashboard(self, auth):
        # Save current selection to restore
        cur = requests.get(f"{BASE_URL}/api/indicator-catalog/selections/dashboard",
                           headers=auth, timeout=15)
        prev = cur.json() if cur.status_code == 200 else None

        r = requests.post(f"{BASE_URL}/api/indicator-catalog/selections/dashboard/preset-p1",
                          headers=auth, timeout=15)
        assert r.status_code in (200, 201), r.text
        # After preset, selection should be non-empty
        after = requests.get(f"{BASE_URL}/api/indicator-catalog/selections/dashboard",
                             headers=auth, timeout=15)
        assert after.status_code == 200
        sel = after.json()
        # Response could be list or {items:[...]}
        items = sel if isinstance(sel, list) else sel.get("indicator_ids", sel.get("items", sel.get("selection", [])))
        assert len(items) > 0, f"P1 preset did not populate selection: {sel}"

        # restore best-effort (if API supports PUT)
        if prev is not None:
            try:
                requests.put(f"{BASE_URL}/api/indicator-catalog/selections/dashboard",
                             json=prev if isinstance(prev, dict) else {"items": prev},
                             headers=auth, timeout=15)
            except Exception:
                pass
