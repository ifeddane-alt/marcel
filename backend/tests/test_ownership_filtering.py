"""
Test ownership filtering for API endpoints.
Tests: projects, dashboard, programs, teams, resources per user role.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

CREDENTIALS = {
    "admin":   {"email": "admin@altair.fr",   "password": "Admin2026!"},
    "cp":      {"email": "cp@altair.fr",       "password": "Altair2026!"},
    "pmo":     {"email": "pmo@altair.fr",      "password": "Pmo1234!"},
    "manager": {"email": "manager@altair.fr",  "password": "Altair2026!"},
    "viewer":  {"email": "viewer@altair.fr",   "password": "View1234!"},
}

CP_USER_ID = "4f741c60-81c3-4899-8cbb-bc77988f1ccc"
MANAGER_RESOURCE_ID = "8e263464-f564-48b4-b4e4-dd86a18a2bc3"


def get_token(role: str) -> str:
    creds = CREDENTIALS[role]
    resp = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
    assert resp.status_code == 200, f"Login failed for {role}: {resp.text}"
    data = resp.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token for {role}: {data}"
    return token


def auth_headers(role: str) -> dict:
    return {"Authorization": f"Bearer {get_token(role)}"}


# ── Projects ──────────────────────────────────────────────────────────────────

class TestProjectsOwnershipFiltering:
    """Test GET /api/projects per role"""

    def test_projects_cp_returns_200(self):
        resp = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers("cp"))
        assert resp.status_code == 200, f"CP projects failed: {resp.text}"
        print(f"PASS: CP projects status 200")

    def test_projects_cp_returns_3_projects(self):
        resp = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers("cp"))
        projects = resp.json()
        print(f"CP projects count: {len(projects)}")
        # All returned projects must belong to CP
        for p in projects:
            assert p.get("owner_id") == CP_USER_ID, \
                f"Project {p.get('project_id')} has owner_id={p.get('owner_id')}, expected {CP_USER_ID}"
        assert len(projects) == 3, f"Expected 3 projects for CP, got {len(projects)}"
        print(f"PASS: CP sees exactly 3 projects")

    def test_projects_admin_returns_200(self):
        resp = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers("admin"))
        assert resp.status_code == 200
        print(f"PASS: Admin projects status 200")

    def test_projects_admin_returns_all(self):
        resp = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers("admin"))
        projects = resp.json()
        print(f"Admin projects count: {len(projects)}")
        assert len(projects) == 8, f"Expected 8 projects for admin, got {len(projects)}"
        print(f"PASS: Admin sees 8 projects")

    def test_projects_pmo_returns_all(self):
        resp = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers("pmo"))
        projects = resp.json()
        print(f"PMO projects count: {len(projects)}")
        assert len(projects) == 8, f"Expected 8 projects for PMO, got {len(projects)}"
        print(f"PASS: PMO sees 8 projects (no restriction)")

    def test_projects_viewer_cio_returns_all(self):
        """Regression: CIO viewer must see all projects (no ownership restriction)"""
        resp = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers("viewer"))
        assert resp.status_code == 200, f"Viewer projects failed: {resp.text}"
        projects = resp.json()
        print(f"Viewer (CIO) projects count: {len(projects)}")
        assert len(projects) == 8, f"Expected 8 projects for CIO viewer, got {len(projects)}"
        print(f"PASS: CIO viewer sees all 8 projects")

    def test_projects_all_profiles_return_200(self):
        """Regression: All profiles must get 200"""
        for role in ["admin", "cp", "pmo", "manager", "viewer"]:
            resp = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(role))
            assert resp.status_code == 200, f"{role} got {resp.status_code}: {resp.text}"
        print("PASS: All profiles get 200 on /api/projects")


# ── Dashboard Summary ─────────────────────────────────────────────────────────

class TestDashboardSummaryFiltering:
    """Test GET /api/dashboard/summary per role"""

    def test_dashboard_summary_cp_total_projects_3(self):
        resp = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=auth_headers("cp"))
        assert resp.status_code == 200, f"Dashboard CP failed: {resp.text}"
        data = resp.json()
        total = data.get("total_projects")
        print(f"CP dashboard total_projects: {total}")
        assert total == 3, f"Expected 3 for CP, got {total}"
        print("PASS: CP dashboard total_projects=3")

    def test_dashboard_summary_admin_total_projects_8(self):
        resp = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=auth_headers("admin"))
        assert resp.status_code == 200
        data = resp.json()
        total = data.get("total_projects")
        print(f"Admin dashboard total_projects: {total}")
        assert total == 8, f"Expected 8 for admin, got {total}"
        print("PASS: Admin dashboard total_projects=8")


# ── Programs ──────────────────────────────────────────────────────────────────

class TestProgramsOwnershipFiltering:
    """Test GET /api/programs per role"""

    def test_programs_admin_returns_4(self):
        resp = requests.get(f"{BASE_URL}/api/programs", headers=auth_headers("admin"))
        assert resp.status_code == 200
        programs = resp.json()
        print(f"Admin programs count: {len(programs)}")
        assert len(programs) == 4, f"Expected 4 programs for admin, got {len(programs)}"
        print("PASS: Admin sees 4 programs")

    def test_programs_cp_less_than_admin(self):
        admin_resp = requests.get(f"{BASE_URL}/api/programs", headers=auth_headers("admin"))
        cp_resp = requests.get(f"{BASE_URL}/api/programs", headers=auth_headers("cp"))
        assert cp_resp.status_code == 200
        admin_count = len(admin_resp.json())
        cp_count = len(cp_resp.json())
        print(f"Admin programs: {admin_count}, CP programs: {cp_count}")
        assert cp_count < admin_count, \
            f"CP should see fewer programs than admin. CP={cp_count}, admin={admin_count}"
        print(f"PASS: CP sees {cp_count} programs (< admin's {admin_count})")


# ── Teams ─────────────────────────────────────────────────────────────────────

class TestTeamsOwnershipFiltering:
    """Test GET /api/teams per role"""

    def test_teams_admin_returns_5(self):
        resp = requests.get(f"{BASE_URL}/api/teams", headers=auth_headers("admin"))
        assert resp.status_code == 200
        teams = resp.json()
        print(f"Admin teams count: {len(teams)}")
        assert len(teams) == 5, f"Expected 5 teams for admin, got {len(teams)}"
        print("PASS: Admin sees 5 teams")

    def test_teams_manager_returns_1(self):
        resp = requests.get(f"{BASE_URL}/api/teams", headers=auth_headers("manager"))
        assert resp.status_code == 200, f"Manager teams failed: {resp.text}"
        teams = resp.json()
        print(f"Manager teams count: {len(teams)}")
        assert len(teams) == 1, f"Expected 1 team for manager, got {len(teams)}"
        print("PASS: Manager sees 1 team")

    def test_teams_manager_owns_the_team(self):
        resp = requests.get(f"{BASE_URL}/api/teams", headers=auth_headers("manager"))
        teams = resp.json()
        if len(teams) >= 1:
            team = teams[0]
            assert team.get("manager_resource_id") == MANAGER_RESOURCE_ID, \
                f"Team manager_resource_id={team.get('manager_resource_id')}, expected {MANAGER_RESOURCE_ID}"
            print(f"PASS: Manager's team belongs to resource_id={MANAGER_RESOURCE_ID}")


# ── Resources ─────────────────────────────────────────────────────────────────

class TestResourcesOwnershipFiltering:
    """Test GET /api/resources per role"""

    def test_resources_admin_returns_15(self):
        resp = requests.get(f"{BASE_URL}/api/resources", headers=auth_headers("admin"))
        assert resp.status_code == 200
        resources = resp.json()
        print(f"Admin resources count: {len(resources)}")
        assert len(resources) == 15, f"Expected 15 resources for admin, got {len(resources)}"
        print("PASS: Admin sees 15 resources")

    def test_resources_manager_returns_3(self):
        resp = requests.get(f"{BASE_URL}/api/resources", headers=auth_headers("manager"))
        assert resp.status_code == 200, f"Manager resources failed: {resp.text}"
        resources = resp.json()
        print(f"Manager resources count: {len(resources)}")
        assert len(resources) == 3, f"Expected 3 resources for manager, got {len(resources)}"
        print("PASS: Manager sees 3 resources (team only)")
