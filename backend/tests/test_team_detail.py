"""Tests for Team Detail endpoint - GET /api/teams/{team_id}"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
TEAM_ID = "9ff21917-3f4d-4714-aa3d-051690cb7adf"  # Dev A team with 3 members and 5 projects

@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@altair.fr", "password": "Admin1234!"})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]

@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


class TestTeamDetailAPI:
    """GET /api/teams/{team_id} tests"""

    def test_get_team_detail_200(self, headers):
        r = requests.get(f"{BASE_URL}/api/teams/{TEAM_ID}", headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

    def test_team_object_fields(self, headers):
        r = requests.get(f"{BASE_URL}/api/teams/{TEAM_ID}", headers=headers)
        data = r.json()
        team = data["team"]
        assert "team_id" in team
        assert "name" in team
        assert "manager_name" in team
        assert "total_capacity_jhm" in team
        assert "member_count" in team
        assert team["team_id"] == TEAM_ID

    def test_members_list(self, headers):
        r = requests.get(f"{BASE_URL}/api/teams/{TEAM_ID}", headers=headers)
        data = r.json()
        members = data["members"]
        assert isinstance(members, list)
        assert len(members) > 0, "Dev A should have members"
        # Check member fields
        m = members[0]
        assert "resource_id" in m
        assert "name" in m
        assert "role" in m
        assert "capacity_jhm" in m
        assert "current_month_jh" in m
        assert "utilization_pct" in m

    def test_project_allocations(self, headers):
        r = requests.get(f"{BASE_URL}/api/teams/{TEAM_ID}", headers=headers)
        data = r.json()
        proj_allocs = data["project_allocations"]
        assert isinstance(proj_allocs, list)
        if len(proj_allocs) > 0:
            p = proj_allocs[0]
            assert "project_id" in p
            assert "project_name" in p
            assert "phases" in p
            assert "total" in p
            total = p["total"]
            for key in ["planned_md", "consumed_md", "raf_md", "consumed_cost_eur", "raf_cost_eur"]:
                assert key in total, f"Missing total field: {key}"

    def test_monthly_load_6_items(self, headers):
        r = requests.get(f"{BASE_URL}/api/teams/{TEAM_ID}", headers=headers)
        data = r.json()
        monthly_load = data["monthly_load"]
        assert len(monthly_load) == 6, f"Expected 6 monthly items, got {len(monthly_load)}"
        for item in monthly_load:
            assert "month" in item
            assert "capacity_jhm" in item
            assert "allocated_jh" in item
            assert "utilization_pct" in item

    def test_team_detail_404_for_invalid_id(self, headers):
        r = requests.get(f"{BASE_URL}/api/teams/00000000-0000-0000-0000-000000000000", headers=headers)
        assert r.status_code == 404

    def test_special_routes_not_conflicting(self, headers):
        """Ensure capacity-heatmap and capacity-alerts are not matched by {team_id}"""
        r1 = requests.get(f"{BASE_URL}/api/teams/capacity-heatmap", headers=headers)
        assert r1.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/teams/capacity-alerts", headers=headers)
        assert r2.status_code == 200

    def test_list_teams_no_conflict(self, headers):
        r = requests.get(f"{BASE_URL}/api/teams", headers=headers)
        assert r.status_code == 200
        teams = r.json()
        assert isinstance(teams, list)
        assert len(teams) >= 7, f"Expected at least 7 teams, got {len(teams)}"
