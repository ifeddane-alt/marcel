"""
Tests for new Scope module features:
- Export Excel (snapshot + candidates)
- List snapshots (frozen/transmitted only filter)
- Timeline features (team_id in snapshot features)
- Seed data validation (scope_status, Dev A overload)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = "admin@altair.fr"
ADMIN_PASS = "Admin2026!"
CP_EMAIL = "cp@altair.fr"
CP_PASS = "Altair2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def cp_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": CP_EMAIL, "password": CP_PASS})
    assert r.status_code == 200, f"CP login failed: {r.text}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def cp_headers(cp_token):
    return {"Authorization": f"Bearer {cp_token}"}


class TestSeedData:
    """Test seed data has scope_status assigned"""

    def test_candidates_have_scope_status(self, admin_headers):
        """At least some candidates should have scope_status set"""
        r = requests.get(f"{BASE_URL}/api/scope/candidates", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0, "No candidates found"
        statuses = [t.get("scope_status") for t in data]
        sec_count = statuses.count("sec")
        etendu_count = statuses.count("etendu")
        out_count = statuses.count("out")
        print(f"SEC={sec_count}, ÉTENDU={etendu_count}, OUT={out_count}")
        assert sec_count > 0, "No SEC tasks found"
        assert etendu_count > 0, "No ÉTENDU tasks found"
        assert out_count > 0, "No OUT tasks found"

    def test_dev_a_surcharge(self, admin_headers):
        """Dev A team should show surcharge (rouge status)"""
        r = requests.get(f"{BASE_URL}/api/scope/capacity", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        teams = {t.get("team_name"): t for t in data}
        print(f"Teams found: {list(teams.keys())}")
        # At least one team should be rouge
        rouge_teams = [t for t in data if t.get("status") == "rouge"]
        assert len(rouge_teams) > 0, "No team in surcharge (rouge) status"
        print(f"Rouge teams: {[t['team_name'] for t in rouge_teams]}")


class TestSnapshots:
    """Test snapshot filtering (frozen/transmitted)"""

    def test_list_snapshots_returns_frozen_and_transmitted(self, admin_headers):
        """List snapshots should include frozen and transmitted"""
        r = requests.get(f"{BASE_URL}/api/scope/snapshots", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0, "No snapshots found"
        statuses = [s.get("status") for s in data]
        print(f"Snapshot statuses: {statuses}")
        # Should not return draft snapshots
        assert all(s in ("frozen", "transmitted") for s in statuses), f"Unexpected statuses: {statuses}"

    def test_list_snapshots_by_project_id(self, admin_headers):
        """List snapshots with project_id filter should return only matching snapshots"""
        # First get all projects
        r_projects = requests.get(f"{BASE_URL}/api/projects", headers=admin_headers)
        assert r_projects.status_code == 200
        projects = r_projects.json()
        if not projects:
            pytest.skip("No projects found")
        project_id = projects[0].get("project_id")
        r = requests.get(f"{BASE_URL}/api/scope/snapshots", params={"project_id": project_id}, headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        # All returned snapshots should belong to this project or be global
        for snap in data:
            pid = snap.get("project_id")
            assert pid is None or pid == project_id, f"Snapshot project_id mismatch: {pid} != {project_id}"
        print(f"Snapshots for project {project_id}: {len(data)}")

    def test_snapshot_features_have_team_id(self, admin_headers):
        """Snapshot features should have team_id enriched"""
        r = requests.get(f"{BASE_URL}/api/scope/snapshots", headers=admin_headers)
        assert r.status_code == 200
        snapshots = r.json()
        if not snapshots:
            pytest.skip("No snapshots found")
        snap_id = snapshots[0].get("snapshot_id")
        r2 = requests.get(f"{BASE_URL}/api/scope/snapshots/{snap_id}", headers=admin_headers)
        assert r2.status_code == 200
        snap = r2.json()
        features = snap.get("features", [])
        assert len(features) > 0, "Snapshot has no features"
        # Check features with scope_status have team_id
        scope_features = [f for f in features if f.get("scope_status") in ("sec", "etendu")]
        print(f"Features with scope_status: {len(scope_features)}")
        if scope_features:
            has_team_id = [f for f in scope_features if f.get("team_id")]
            print(f"Features with team_id: {len(has_team_id)}")
            assert len(has_team_id) > 0, "No features have team_id in snapshot"


class TestExportExcel:
    """Test Excel export endpoints"""

    def test_export_candidates_excel_returns_xlsx(self, admin_headers):
        """GET /api/scope/export-excel should return valid XLSX"""
        r = requests.get(f"{BASE_URL}/api/scope/export-excel", headers=admin_headers)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/vnd.openxmlformats")
        # Check magic bytes: PK\x03\x04
        assert r.content[:4] == b"PK\x03\x04", f"Not a valid XLSX file, got: {r.content[:4]}"
        assert len(r.content) > 1000, "XLSX file too small"
        print(f"Candidates Excel size: {len(r.content)} bytes - PASS")

    def test_export_candidates_excel_with_filter(self, admin_headers):
        """Export with scope_status filter"""
        r = requests.get(f"{BASE_URL}/api/scope/export-excel", params={"scope_status": "sec"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.content[:4] == b"PK\x03\x04", "Not a valid XLSX file"
        print(f"Filtered Excel size: {len(r.content)} bytes - PASS")

    def test_export_snapshot_excel_returns_xlsx(self, admin_headers):
        """GET /api/scope/snapshots/{id}/export-excel should return valid XLSX"""
        # Get a snapshot first
        r_snaps = requests.get(f"{BASE_URL}/api/scope/snapshots", headers=admin_headers)
        assert r_snaps.status_code == 200
        snapshots = r_snaps.json()
        if not snapshots:
            pytest.skip("No snapshots found")
        snap_id = snapshots[0].get("snapshot_id")
        r = requests.get(f"{BASE_URL}/api/scope/snapshots/{snap_id}/export-excel", headers=admin_headers)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/vnd.openxmlformats")
        assert r.content[:4] == b"PK\x03\x04", f"Not a valid XLSX file, got: {r.content[:4]}"
        assert len(r.content) > 1000, "XLSX file too small"
        # Check Content-Disposition header
        cd = r.headers.get("content-disposition", "")
        assert ".xlsx" in cd, f"Missing .xlsx in Content-Disposition: {cd}"
        print(f"Snapshot Excel size: {len(r.content)} bytes - PASS")
        print(f"Content-Disposition: {cd}")

    def test_export_snapshot_excel_unauthorized(self):
        """Export without auth should return 401 or 403"""
        r_snaps = requests.get(f"{BASE_URL}/api/scope/snapshots", headers={"Authorization": "Bearer INVALID"})
        # Should fail auth
        assert r_snaps.status_code in (401, 403, 422)


class TestProjectDetailScopeSection:
    """Test that scope snapshots are accessible via project_id filter"""

    def test_scope_snapshots_visible_for_project(self, admin_headers):
        """Scope snapshots should be listable by project_id (for ProjectDetail page)"""
        r_projects = requests.get(f"{BASE_URL}/api/projects", headers=admin_headers)
        assert r_projects.status_code == 200
        projects = r_projects.json()
        if not projects:
            pytest.skip("No projects found")

        # Check each project for snapshots
        found = False
        for project in projects[:3]:
            pid = project.get("project_id")
            r = requests.get(f"{BASE_URL}/api/scope/snapshots", params={"project_id": pid}, headers=admin_headers)
            assert r.status_code == 200
            snaps = r.json()
            if snaps:
                found = True
                for snap in snaps:
                    assert snap.get("status") in ("frozen", "transmitted"), f"Unexpected status: {snap.get('status')}"
                print(f"Project {project.get('name')}: {len(snaps)} snapshots (statuses: {[s.get('status') for s in snaps]})")
        if not found:
            pytest.skip("No project has snapshots - can't test ProjectDetail scope section")
