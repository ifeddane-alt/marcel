"""
Tests for LOT5 - OKR CRUD, WSJF scoring, Programme Dashboard
Also covers LOT3 (Vendors CSV export) and basic API checks for LOT1/2/4
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

@pytest.fixture(scope="module")
def auth_token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "cp@altair.fr", "password": "Altair2026!"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]

@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}

@pytest.fixture(scope="module")
def capability_id(headers):
    """Get first capability ID for WSJF tests"""
    resp = requests.get(f"{BASE_URL}/api/safe/capabilities", headers=headers)
    assert resp.status_code == 200, f"Capabilities failed: {resp.text}"
    caps = resp.json()
    assert len(caps) > 0, "No capabilities found"
    return caps[0]["capability_id"]

# ─── OKR CRUD ────────────────────────────────────────────────────────────────

class TestOKRCRUD:
    created_okr_id = None

    def test_list_okrs(self, headers):
        resp = requests.get(f"{BASE_URL}/api/okrs", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"  GET /okrs -> {len(data)} OKRs")

    def test_create_okr(self, headers):
        payload = {
            "objective": "TEST_OKR Améliorer la qualité du produit",
            "description": "Objectif de test",
            "status": "on_track",
            "key_results": [
                {"description": "Réduire les bugs critiques", "target_value": 10, "current_value": 3, "unit": "bugs"}
            ]
        }
        resp = requests.post(f"{BASE_URL}/api/okrs", json=payload, headers=headers)
        assert resp.status_code == 201, f"Create OKR failed: {resp.text}"
        data = resp.json()
        assert data["objective"] == payload["objective"]
        assert data["status"] == "on_track"
        assert "okr_id" in data
        assert len(data.get("key_results", [])) == 1
        TestOKRCRUD.created_okr_id = data["okr_id"]
        print(f"  POST /okrs -> okr_id={data['okr_id']}")

    def test_get_okr_persisted(self, headers):
        assert TestOKRCRUD.created_okr_id, "No okr_id from create test"
        resp = requests.get(f"{BASE_URL}/api/okrs", headers=headers)
        assert resp.status_code == 200
        okrs = resp.json()
        ids = [o["okr_id"] for o in okrs]
        assert TestOKRCRUD.created_okr_id in ids
        print(f"  GET /okrs confirmed created OKR present")

    def test_update_okr(self, headers):
        assert TestOKRCRUD.created_okr_id
        payload = {"status": "at_risk", "objective": "TEST_OKR Updated"}
        resp = requests.put(f"{BASE_URL}/api/okrs/{TestOKRCRUD.created_okr_id}", json=payload, headers=headers)
        assert resp.status_code == 200, f"Update OKR failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "at_risk"
        assert data["objective"] == "TEST_OKR Updated"
        print(f"  PUT /okrs/{TestOKRCRUD.created_okr_id} -> status=at_risk")

    def test_delete_okr(self, headers):
        assert TestOKRCRUD.created_okr_id
        resp = requests.delete(f"{BASE_URL}/api/okrs/{TestOKRCRUD.created_okr_id}", headers=headers)
        assert resp.status_code == 204, f"Delete OKR failed: {resp.text}"
        print(f"  DELETE /okrs/{TestOKRCRUD.created_okr_id} -> 204")

    def test_delete_okr_returns_404(self, headers):
        assert TestOKRCRUD.created_okr_id
        resp = requests.delete(f"{BASE_URL}/api/okrs/{TestOKRCRUD.created_okr_id}", headers=headers)
        assert resp.status_code == 404
        print(f"  DELETE non-existent OKR -> 404 OK")


# ─── Dashboard Programme ─────────────────────────────────────────────────────

class TestProgrammeDashboard:
    def test_dashboard_loads(self, headers):
        resp = requests.get(f"{BASE_URL}/api/programme/dashboard", headers=headers)
        assert resp.status_code == 200, f"Dashboard failed: {resp.text}"
        data = resp.json()
        assert "summary" in data
        assert "top_capabilities" in data
        assert "pi_velocity" in data
        s = data["summary"]
        assert s["total_trains"] > 0
        assert s["total_pis"] > 0
        assert s["total_capabilities"] > 0
        print(f"  Dashboard: trains={s['total_trains']}, pis={s['total_pis']}, caps={s['total_capabilities']}")

    def test_dashboard_caps_by_status(self, headers):
        resp = requests.get(f"{BASE_URL}/api/programme/dashboard", headers=headers)
        data = resp.json()
        assert "caps_by_status" in data
        cbs = data["caps_by_status"]
        assert set(cbs.keys()) >= {"identified", "committed", "in_progress", "done"}
        print(f"  caps_by_status={cbs}")


# ─── WSJF ────────────────────────────────────────────────────────────────────

class TestWSJF:
    def test_update_wsjf(self, headers, capability_id):
        payload = {"business_value": 8, "time_criticality": 5, "risk_reduction": 3, "job_size": 2}
        resp = requests.put(f"{BASE_URL}/api/capabilities/{capability_id}/wsjf", json=payload, headers=headers)
        assert resp.status_code == 200, f"WSJF update failed: {resp.text}"
        data = resp.json()
        assert data["wsjf"] is not None
        expected_wsjf = round((8 + 5 + 3) / 2, 2)  # 8.0
        assert data["wsjf"] == expected_wsjf, f"WSJF={data['wsjf']} expected {expected_wsjf}"
        print(f"  PUT /capabilities/{capability_id}/wsjf -> wsjf={data['wsjf']}")


# ─── LOT 3 - Vendors CSV export ──────────────────────────────────────────────

class TestVendorsCSV:
    def test_vendors_csv_export(self, headers):
        resp = requests.get(f"{BASE_URL}/api/vendors/export/csv", headers=headers)
        assert resp.status_code == 200, f"CSV export failed: {resp.status_code} {resp.text}"
        content_type = resp.headers.get("content-type", "")
        assert "csv" in content_type or "text" in content_type, f"Unexpected content-type: {content_type}"
        assert len(resp.content) > 0
        print(f"  GET /vendors/export/csv -> {len(resp.content)} bytes")


# ─── LOT 1/2 - Tasks with SAFe levels ────────────────────────────────────────

class TestTasksSAFe:
    def test_list_trains_for_context(self, headers):
        resp = requests.get(f"{BASE_URL}/api/safe/trains", headers=headers)
        assert resp.status_code == 200
        trains = resp.json()
        assert len(trains) > 0
        print(f"  Trains: {[t['name'] for t in trains]}")

    def test_list_sprints(self, headers):
        resp = requests.get(f"{BASE_URL}/api/safe/sprints", headers=headers)
        assert resp.status_code == 200
        sprints = resp.json()
        assert len(sprints) > 0
        print(f"  Sprints count: {len(sprints)}")
