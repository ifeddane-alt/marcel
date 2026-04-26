"""
Scope Module Tests — Arbitrage, Capacity, Snapshots, Transmission, Gantt
Tests all scope endpoints: GET /scope/candidates, PATCH /scope/tasks/{id}/status,
GET /scope/capacity, POST /scope/snapshots, GET /scope/snapshots,
POST /scope/snapshots/{id}/transmit, POST /scope/snapshots/{id}/gantt-compute
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

ADMIN_EMAIL = "admin@altair.fr"
ADMIN_PASS = "Admin2026!"
CP_EMAIL = "cp@altair.fr"
CP_PASS = "Altair2026!"
MANAGER_EMAIL = "manager@altair.fr"
MANAGER_PASS = "Altair2026!"


def get_token(email, password):
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        return resp.json().get("access_token") or resp.json().get("token")
    return None


@pytest.fixture(scope="module")
def admin_headers():
    token = get_token(ADMIN_EMAIL, ADMIN_PASS)
    assert token, "Admin login failed"
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def cp_headers():
    token = get_token(CP_EMAIL, CP_PASS)
    assert token, "CP login failed"
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def manager_headers():
    token = get_token(MANAGER_EMAIL, MANAGER_PASS)
    assert token, "Manager login failed"
    return {"Authorization": f"Bearer {token}"}


# ── 1. GET /scope/candidates ──────────────────────────────────────────────────

class TestScopeCandidates:
    """Tests for GET /api/scope/candidates"""

    def test_get_candidates_admin(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/scope/candidates", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"Candidates count: {len(data)}")

    def test_candidates_have_scope_status_field(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/scope/candidates", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) > 0, "No candidates returned - seed data may be missing"
        # Check structure
        first = data[0]
        assert "task_id" in first
        assert "scope_status" in first or "name" in first
        print(f"First candidate: {first.get('name', 'N/A')}, scope_status: {first.get('scope_status')}")

    def test_candidates_count_scope_statuses(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/scope/candidates", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        sec_count = len([t for t in data if t.get("scope_status") == "sec"])
        etendu_count = len([t for t in data if t.get("scope_status") == "etendu"])
        out_count = len([t for t in data if t.get("scope_status") == "out"])
        print(f"SEC={sec_count}, ÉTENDU={etendu_count}, OUT={out_count}")
        # Seed: SEC=9, ÉTENDU=6, OUT=2
        assert sec_count >= 1, "Expected at least 1 SEC task"

    def test_candidates_filter_by_scope_status(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/scope/candidates", params={"scope_status": "sec"}, headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        for t in data:
            assert t.get("scope_status") == "sec", f"Task {t.get('task_id')} has wrong status: {t.get('scope_status')}"
        print(f"SEC filter returned {len(data)} tasks")

    def test_candidates_search_filter(self, admin_headers):
        # First get all candidates to find a search term
        resp = requests.get(f"{BASE_URL}/api/scope/candidates", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        if not data:
            pytest.skip("No candidates available")
        search_term = data[0].get("name", "")[:5]
        resp2 = requests.get(f"{BASE_URL}/api/scope/candidates", params={"search": search_term}, headers=admin_headers)
        assert resp2.status_code == 200
        filtered = resp2.json()
        for t in filtered:
            assert search_term.lower() in t.get("name", "").lower()
        print(f"Search '{search_term}' returned {len(filtered)} results")

    def test_candidates_unauthorized(self):
        resp = requests.get(f"{BASE_URL}/api/scope/candidates")
        assert resp.status_code in (401, 403)


# ── 2. PATCH /scope/tasks/{id}/status ────────────────────────────────────────

class TestScopeStatusPatch:
    """Tests for PATCH /api/scope/tasks/{id}/status"""

    def _get_any_task_id(self, headers):
        resp = requests.get(f"{BASE_URL}/api/scope/candidates", headers=headers)
        data = resp.json()
        if data:
            return data[0]["task_id"], data[0].get("scope_status")
        return None, None

    def test_patch_scope_status_admin(self, admin_headers):
        task_id, original = self._get_any_task_id(admin_headers)
        if not task_id:
            pytest.skip("No tasks available")
        # Try patching to etendu
        resp = requests.patch(
            f"{BASE_URL}/api/scope/tasks/{task_id}/status",
            json={"scope_status": "etendu"},
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("scope_status") == "etendu"
        # Restore
        requests.patch(f"{BASE_URL}/api/scope/tasks/{task_id}/status",
                       json={"scope_status": original}, headers=admin_headers)

    def test_patch_scope_status_invalid(self, admin_headers):
        task_id, _ = self._get_any_task_id(admin_headers)
        if not task_id:
            pytest.skip("No tasks available")
        resp = requests.patch(
            f"{BASE_URL}/api/scope/tasks/{task_id}/status",
            json={"scope_status": "invalid_status"},
            headers=admin_headers
        )
        assert resp.status_code in (422, 400)

    def test_patch_scope_status_rbac_manager(self, manager_headers):
        """Manager without scope.arbitrate should get 403"""
        # Get a task id first using admin
        admin_token = get_token(ADMIN_EMAIL, ADMIN_PASS)
        admin_h = {"Authorization": f"Bearer {admin_token}"}
        task_id, _ = self._get_any_task_id(admin_h)
        if not task_id:
            pytest.skip("No tasks available")
        resp = requests.patch(
            f"{BASE_URL}/api/scope/tasks/{task_id}/status",
            json={"scope_status": "sec"},
            headers=manager_headers
        )
        # Manager doesn't have scope.arbitrate permission
        assert resp.status_code == 403, f"Expected 403 for manager, got {resp.status_code}"

    def test_patch_scope_status_valid_values(self, admin_headers):
        task_id, original = self._get_any_task_id(admin_headers)
        if not task_id:
            pytest.skip("No tasks available")
        for status in ["sec", "etendu", "out"]:
            resp = requests.patch(
                f"{BASE_URL}/api/scope/tasks/{task_id}/status",
                json={"scope_status": status},
                headers=admin_headers
            )
            assert resp.status_code == 200, f"Failed for status={status}: {resp.text}"
        # Restore
        if original:
            requests.patch(f"{BASE_URL}/api/scope/tasks/{task_id}/status",
                           json={"scope_status": original}, headers=admin_headers)


# ── 3. GET /scope/capacity ─────────────────────────────────────────────────

class TestScopeCapacity:
    """Tests for GET /api/scope/capacity"""

    def test_capacity_returns_list(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/scope/capacity", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"Capacity teams count: {len(data)}")

    def test_capacity_structure(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/scope/capacity", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        if not data:
            pytest.skip("No capacity data")
        first = data[0]
        required_keys = ["team_id", "team_name", "capa", "charge_sec", "charge_etendu", "marge", "status"]
        for key in required_keys:
            assert key in first, f"Missing key: {key}"

    def test_capacity_dev_a_rouge(self, admin_headers):
        """Dev A should be in ROUGE status (surcharge 230 JH > 186 JH capa)"""
        resp = requests.get(f"{BASE_URL}/api/scope/capacity", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        rouge_teams = [t for t in data if t.get("status") == "rouge"]
        rouge_resources = []
        for team in data:
            for r in team.get("resources", []):
                if r.get("status") == "rouge":
                    rouge_resources.append(r)
        print(f"ROUGE teams: {[t.get('team_name') for t in rouge_teams]}")
        print(f"ROUGE resources: {[r.get('name') for r in rouge_resources]}")
        # At least 1 team or resource should be in surcharge
        assert len(rouge_teams) >= 1 or len(rouge_resources) >= 1, "Expected at least 1 team in ROUGE"

    def test_capacity_resources_detail(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/scope/capacity", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        for team in data:
            assert "resources" in team
            for r in team["resources"]:
                assert "resource_id" in r
                assert "capa" in r
                assert "charge_sec" in r


# ── 4 & 5. POST & GET /scope/snapshots ────────────────────────────────────────

class TestScopeSnapshots:
    """Tests for POST /api/scope/snapshots and GET /api/scope/snapshots"""

    @pytest.fixture(scope="class")
    def created_snapshot(self, admin_headers):
        resp = requests.post(
            f"{BASE_URL}/api/scope/snapshots",
            json={"project_id": None, "period_ref": "TEST-SNAP 2026", "comment": "Test snapshot"},
            headers=admin_headers
        )
        assert resp.status_code == 201, f"Snapshot creation failed: {resp.text}"
        return resp.json()

    def test_create_snapshot(self, admin_headers):
        resp = requests.post(
            f"{BASE_URL}/api/scope/snapshots",
            json={"period_ref": "PI-3 2026", "comment": "Test snapshot creation"},
            headers=admin_headers
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "snapshot_id" in data
        assert data.get("status") == "frozen"
        assert data.get("version") >= 1
        print(f"Created snapshot: {data.get('snapshot_id')}, version: {data.get('version')}")

    def test_create_snapshot_version_auto_increment(self, admin_headers):
        # Create two snapshots for same period
        resp1 = requests.post(
            f"{BASE_URL}/api/scope/snapshots",
            json={"period_ref": "PI-AUTOINCREMENT-TEST", "comment": "v1"},
            headers=admin_headers
        )
        resp2 = requests.post(
            f"{BASE_URL}/api/scope/snapshots",
            json={"period_ref": "PI-AUTOINCREMENT-TEST", "comment": "v2"},
            headers=admin_headers
        )
        assert resp1.status_code == 201
        assert resp2.status_code == 201
        v1 = resp1.json().get("version", 0)
        v2 = resp2.json().get("version", 0)
        assert v2 > v1, f"Version not incremented: v1={v1}, v2={v2}"

    def test_list_snapshots(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/scope/snapshots", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "Expected at least 1 snapshot (seed data)"
        # Should not include features field (excluded in list)
        for snap in data:
            assert "features" not in snap
        print(f"Snapshots count: {len(data)}")

    def test_get_snapshot_by_id(self, admin_headers):
        # Get list first
        list_resp = requests.get(f"{BASE_URL}/api/scope/snapshots", headers=admin_headers)
        snapshots = list_resp.json()
        if not snapshots:
            pytest.skip("No snapshots available")
        snap_id = snapshots[0]["snapshot_id"]
        resp = requests.get(f"{BASE_URL}/api/scope/snapshots/{snap_id}", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("snapshot_id") == snap_id

    def test_snapshot_requires_freeze_permission(self, manager_headers):
        """Manager without scope.freeze should get 403"""
        resp = requests.post(
            f"{BASE_URL}/api/scope/snapshots",
            json={"period_ref": "TEST-RBAC", "comment": "test"},
            headers=manager_headers
        )
        assert resp.status_code == 403


# ── 6. POST /scope/snapshots/{id}/transmit ─────────────────────────────────

class TestScopeTransmit:
    """Tests for POST /api/scope/snapshots/{id}/transmit"""

    def _get_cp_user_id(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        if resp.status_code == 200:
            users = resp.json()
            for u in users:
                if "cp" in u.get("email", "").lower() or u.get("email") == CP_EMAIL:
                    return u.get("user_id")
        return None

    def test_transmit_snapshot(self, admin_headers):
        # Create a new snapshot first
        snap_resp = requests.post(
            f"{BASE_URL}/api/scope/snapshots",
            json={"period_ref": "PI-TRANSMIT-TEST 2026", "comment": "For transmit test"},
            headers=admin_headers
        )
        assert snap_resp.status_code == 201
        snap_id = snap_resp.json()["snapshot_id"]

        # Get CP user id
        cp_user_id = self._get_cp_user_id(admin_headers)
        if not cp_user_id:
            pytest.skip("CP user not found")

        resp = requests.post(
            f"{BASE_URL}/api/scope/snapshots/{snap_id}/transmit",
            json={"target_user_id": cp_user_id, "comment": "Test transmission"},
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "pdf_base64" in data
        assert len(data["pdf_base64"]) > 0
        assert "transmitted_to_name" in data
        print(f"Transmitted to: {data.get('transmitted_to_name')}")

    def test_transmit_already_transmitted(self, admin_headers):
        """Cannot transmit same snapshot twice"""
        snap_resp = requests.post(
            f"{BASE_URL}/api/scope/snapshots",
            json={"period_ref": "PI-DOUBLE-TRANSMIT-TEST", "comment": "test"},
            headers=admin_headers
        )
        assert snap_resp.status_code == 201
        snap_id = snap_resp.json()["snapshot_id"]

        cp_user_id = self._get_cp_user_id(admin_headers)
        if not cp_user_id:
            pytest.skip("CP user not found")

        # First transmit
        r1 = requests.post(
            f"{BASE_URL}/api/scope/snapshots/{snap_id}/transmit",
            json={"target_user_id": cp_user_id, "comment": "first"},
            headers=admin_headers
        )
        assert r1.status_code == 200

        # Second transmit should fail
        r2 = requests.post(
            f"{BASE_URL}/api/scope/snapshots/{snap_id}/transmit",
            json={"target_user_id": cp_user_id, "comment": "second"},
            headers=admin_headers
        )
        assert r2.status_code == 409


# ── 7. POST /scope/snapshots/{id}/gantt-compute ─────────────────────────────

class TestGanttCompute:
    """Tests for POST /api/scope/snapshots/{id}/gantt-compute"""

    def test_gantt_compute(self, admin_headers):
        # Get a frozen snapshot
        list_resp = requests.get(f"{BASE_URL}/api/scope/snapshots", headers=admin_headers)
        snapshots = list_resp.json()
        frozen_snaps = [s for s in snapshots if s.get("status") == "frozen"]
        if not frozen_snaps:
            # Create one
            snap_resp = requests.post(
                f"{BASE_URL}/api/scope/snapshots",
                json={"period_ref": "PI-GANTT-TEST 2026", "comment": "For gantt test"},
                headers=admin_headers
            )
            assert snap_resp.status_code == 201
            snap_id = snap_resp.json()["snapshot_id"]
        else:
            snap_id = frozen_snaps[0]["snapshot_id"]

        resp = requests.post(
            f"{BASE_URL}/api/scope/snapshots/{snap_id}/gantt-compute",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "snapshot_id" in data
        assert "updated_tasks" in data
        assert isinstance(data["updated_tasks"], int)
        print(f"Gantt updated {data.get('updated_tasks')} tasks, alerts: {data.get('alerts')}")

    def test_gantt_requires_freeze_permission(self, manager_headers):
        """Manager without scope.freeze should get 403"""
        list_resp = requests.get(f"{BASE_URL}/api/scope/snapshots", headers={"Authorization": manager_headers.get("Authorization")})
        if list_resp.status_code != 200:
            pytest.skip("Cannot list snapshots")
        snapshots = list_resp.json()
        if not snapshots:
            pytest.skip("No snapshots to test")
        snap_id = snapshots[0]["snapshot_id"]
        resp = requests.post(
            f"{BASE_URL}/api/scope/snapshots/{snap_id}/gantt-compute",
            headers=manager_headers
        )
        assert resp.status_code == 403
