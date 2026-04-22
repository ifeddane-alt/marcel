"""Tests for regulatory milestones endpoints: /api/milestones/regulatory"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_CREDS = {"email": "admin@altair.fr", "password": "Admin1234!"}
VIEWER_CREDS = {"email": "viewer@altair.fr", "password": "View1234!"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def viewer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=VIEWER_CREDS)
    assert r.status_code == 200, f"Viewer login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def viewer_headers(viewer_token):
    return {"Authorization": f"Bearer {viewer_token}"}


# ── 1. GET /api/milestones/regulatory ─────────────────────────────────────────

class TestRegulatoryList:
    """Test GET /api/milestones/regulatory"""

    def test_returns_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory", headers=admin_headers)
        assert r.status_code == 200

    def test_returns_list(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory", headers=admin_headers)
        data = r.json()
        assert isinstance(data, list)
        print(f"Total milestones: {len(data)}")

    def test_has_required_fields(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory", headers=admin_headers)
        data = r.json()
        if data:
            m = data[0]
            for field in ["project_name", "owner_name", "target_date", "days_remaining", "urgency_color"]:
                assert field in m, f"Missing field: {field}"

    def test_only_regulatory_or_decomm_types(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory", headers=admin_headers)
        data = r.json()
        for m in data:
            assert m.get("type") in ("regulatory", "decomm"), f"Unexpected type: {m.get('type')}"

    def test_sorted_by_target_date_asc(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory", headers=admin_headers)
        data = r.json()
        dates = [m.get("target_date") or "9999-12-31" for m in data]
        assert dates == sorted(dates), "Not sorted by target_date ascending"

    def test_11_milestones_seeded(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory", headers=admin_headers)
        data = r.json()
        assert len(data) == 11, f"Expected 11 milestones, got {len(data)}"


# ── 2. GET /api/milestones/regulatory/kpis ────────────────────────────────────

class TestRegulatoryKpis:
    """Test GET /api/milestones/regulatory/kpis"""

    def test_returns_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory/kpis", headers=admin_headers)
        assert r.status_code == 200

    def test_kpi_fields(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory/kpis", headers=admin_headers)
        data = r.json()
        for field in ["total", "within_90", "overdue", "crit_open"]:
            assert field in data, f"Missing KPI field: {field}"

    def test_kpi_total_11(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory/kpis", headers=admin_headers)
        data = r.json()
        assert data["total"] == 11, f"Expected total=11, got {data['total']}"

    def test_kpi_values_non_negative(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory/kpis", headers=admin_headers)
        data = r.json()
        for key in ["total", "within_90", "overdue", "crit_open"]:
            assert data[key] >= 0


# ── 3. Filter by type ─────────────────────────────────────────────────────────

class TestRegulatoryFilters:
    """Test filter parameters"""

    def test_filter_type_regulatory(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory?milestone_type=regulatory", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        for m in data:
            assert m["type"] == "regulatory", f"Expected regulatory, got {m['type']}"

    def test_filter_type_decomm(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory?milestone_type=decomm", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        for m in data:
            assert m["type"] == "decomm"

    def test_filter_attribute_critical(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory?attribute=critical", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        for m in data:
            assert m.get("attribute") == "critical"


# ── 4. Urgency color logic ────────────────────────────────────────────────────

class TestUrgencyColor:
    """Test urgency_color values"""

    def test_urgency_color_values_valid(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory", headers=admin_headers)
        data = r.json()
        valid_colors = {"overdue", "red", "orange", "green", "done", "grey"}
        for m in data:
            assert m["urgency_color"] in valid_colors, f"Invalid color: {m['urgency_color']}"

    def test_overdue_has_negative_days(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory", headers=admin_headers)
        data = r.json()
        for m in data:
            if m["urgency_color"] == "overdue":
                assert m["days_remaining"] < 0, f"Overdue but days_remaining={m['days_remaining']}"

    def test_red_has_days_0_to_30(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory", headers=admin_headers)
        data = r.json()
        for m in data:
            if m["urgency_color"] == "red":
                assert 0 <= m["days_remaining"] <= 30

    def test_orange_has_days_31_to_90(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory", headers=admin_headers)
        data = r.json()
        for m in data:
            if m["urgency_color"] == "orange":
                assert 31 <= m["days_remaining"] <= 90

    def test_green_has_days_over_90(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory", headers=admin_headers)
        data = r.json()
        for m in data:
            if m["urgency_color"] == "green":
                assert m["days_remaining"] > 90


# ── 5. CSV export ─────────────────────────────────────────────────────────────

class TestRegulatoryCSV:
    """Test GET /api/milestones/regulatory/csv"""

    def test_returns_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory/csv", headers=admin_headers)
        assert r.status_code == 200

    def test_csv_headers(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory/csv", headers=admin_headers)
        first_line = r.text.strip().split("\n")[0]
        expected_headers = ["Projet", "Type", "Libellé", "Date cible", "Owner", "Statut", "Jours restants", "Attribut", "Bloquant"]
        for h in expected_headers:
            assert h in first_line, f"Missing CSV header: {h}"

    def test_csv_has_rows(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory/csv", headers=admin_headers)
        lines = [l for l in r.text.strip().split("\n") if l]
        assert len(lines) > 1  # header + data rows


# ── 6. Viewer access ─────────────────────────────────────────────────────────

class TestViewerAccess:
    """Viewer (READ_ONLY) can access regulatory endpoints"""

    def test_viewer_can_access_list(self, viewer_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory", headers=viewer_headers)
        assert r.status_code == 200

    def test_viewer_can_access_kpis(self, viewer_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory/kpis", headers=viewer_headers)
        assert r.status_code == 200

    def test_viewer_can_access_csv(self, viewer_headers):
        r = requests.get(f"{BASE_URL}/api/milestones/regulatory/csv", headers=viewer_headers)
        assert r.status_code == 200
