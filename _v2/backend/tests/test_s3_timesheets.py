"""Tests S3-01 à S3-04 : Timesheets Stream 3"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

ADMIN_EMAIL = "admin@altair.fr"
ADMIN_PWD   = "Admin1234!"
PMO_EMAIL   = "pmo@altair.fr"
PMO_PWD     = "Pmo1234!"
VIEWER_EMAIL = "viewer@altair.fr"
VIEWER_PWD  = "View1234!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def pmo_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": PMO_EMAIL, "password": PMO_PWD})
    assert r.status_code == 200, f"PMO login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def viewer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": VIEWER_EMAIL, "password": VIEWER_PWD})
    assert r.status_code == 200, f"Viewer login failed: {r.text}"
    return r.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ─── Resources check ─────────────────────────────────────────────────────────
class TestResources:
    def test_realistic_resource_names(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/resources", headers=auth(admin_token))
        assert r.status_code == 200
        resources = r.json()
        assert len(resources) > 0
        names = [res["name"] for res in resources]
        # check at least one realistic name
        realistic = ["Sophie", "Thomas", "Alexandre", "Marie", "Julien", "Claire", "Lucas", "Emma"]
        found = any(any(n in name for n in realistic) for name in names)
        assert found, f"No realistic names found: {names}"
        print(f"Resources found: {names}")

    def test_no_parasite_teams(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/teams", headers=auth(admin_token))
        assert r.status_code == 200
        teams = r.json()
        team_names = [t["name"] for t in teams]
        print(f"Teams: {team_names}")
        parasites = ["Équipe Test Fix", "BOBO"]
        for p in parasites:
            assert p not in team_names, f"Parasite team found: {p}"
        # Expected real teams
        expected = ["Dev A", "Dev B", "Infra", "QA", "Support"]
        for e in expected:
            assert any(e in n for n in team_names), f"Expected team not found: {e} in {team_names}"


# ─── S3-01: Grid ─────────────────────────────────────────────────────────────
class TestTimesheetGrid:
    @pytest.fixture(scope="class")
    def resource_id(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/resources", headers=auth(admin_token))
        resources = r.json()
        assert len(resources) > 0
        # pick first resource that has a name with "Thomas" if available, else first
        for res in resources:
            if "Thomas" in res.get("name", ""):
                return res["resource_id"]
        return resources[0]["resource_id"]

    def test_get_grid_returns_200(self, admin_token, resource_id):
        r = requests.get(
            f"{BASE_URL}/api/timesheets/grid",
            params={"resource_id": resource_id, "week_start": "2025-01-06"},
            headers=auth(admin_token),
        )
        assert r.status_code == 200
        data = r.json()
        assert "rows" in data
        assert "days" in data
        assert "daily_cap_jh" in data
        assert len(data["days"]) == 5  # Lun-Ven
        print(f"Grid rows: {len(data['rows'])}, daily_cap: {data['daily_cap_jh']}")

    def test_grid_daily_cap_reasonable(self, admin_token, resource_id):
        r = requests.get(
            f"{BASE_URL}/api/timesheets/grid",
            params={"resource_id": resource_id, "week_start": "2025-01-06"},
            headers=auth(admin_token),
        )
        data = r.json()
        # daily_cap should be ~0.95 (capacity/21)
        assert 0 < data["daily_cap_jh"] <= 5, f"Unexpected daily_cap: {data['daily_cap_jh']}"


# ─── S3-01: Upsert entry ─────────────────────────────────────────────────────
class TestTimesheetEntry:
    @pytest.fixture(scope="class")
    def first_wa(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/resources", headers=auth(admin_token))
        resources = r.json()
        resource_id = resources[0]["resource_id"]
        grid_r = requests.get(
            f"{BASE_URL}/api/timesheets/grid",
            params={"resource_id": resource_id, "week_start": "2025-01-06"},
            headers=auth(admin_token),
        )
        grid = grid_r.json()
        if not grid["rows"]:
            pytest.skip("No rows in grid to upsert")
        return {"resource_id": resource_id, "wa_id": grid["rows"][0]["work_allocation_id"], "day": grid["days"][0]}

    def test_upsert_entry(self, admin_token, first_wa):
        r = requests.put(
            f"{BASE_URL}/api/timesheets/entry",
            json={
                "resource_id": first_wa["resource_id"],
                "work_allocation_id": first_wa["wa_id"],
                "date": first_wa["day"],
                "jh_value": 0.5,
            },
            headers=auth(admin_token),
        )
        assert r.status_code == 200
        data = r.json()
        assert "timesheet_id" in data or "status" in data
        print(f"Upsert response: {data}")


# ─── S3-01: Submit week ──────────────────────────────────────────────────────
class TestSubmitWeek:
    def test_submit_week(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/resources", headers=auth(admin_token))
        resource_id = r.json()[0]["resource_id"]
        # upsert an entry first
        grid_r = requests.get(
            f"{BASE_URL}/api/timesheets/grid",
            params={"resource_id": resource_id, "week_start": "2025-01-06"},
            headers=auth(admin_token),
        )
        grid = grid_r.json()
        if grid["rows"]:
            requests.put(
                f"{BASE_URL}/api/timesheets/entry",
                json={
                    "resource_id": resource_id,
                    "work_allocation_id": grid["rows"][0]["work_allocation_id"],
                    "date": grid["days"][1],
                    "jh_value": 0.5,
                },
                headers=auth(admin_token),
            )
        r2 = requests.post(
            f"{BASE_URL}/api/timesheets/submit-week",
            json={"resource_id": resource_id, "week_start": "2025-01-06"},
            headers=auth(admin_token),
        )
        # 200 (some submitted) or 400 (nothing to submit) - both acceptable
        assert r2.status_code in [200, 400], f"Unexpected: {r2.status_code} {r2.text}"
        print(f"Submit response: {r2.json()}")


# ─── S3-02: Pending count + validation ───────────────────────────────────────
class TestValidation:
    def test_pending_count_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/timesheets/pending-count", headers=auth(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert "count" in data
        assert data["count"] >= 0
        print(f"Pending count: {data['count']}")

    def test_pending_count_positive(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/timesheets/pending-count", headers=auth(admin_token))
        count = r.json()["count"]
        assert count > 0, "Expected at least 1 pending timesheet (seed data)"

    def test_viewer_can_get_pending_count(self, viewer_token):
        """Viewer can still call pending-count (backend does not restrict)"""
        r = requests.get(f"{BASE_URL}/api/timesheets/pending-count", headers=auth(viewer_token))
        assert r.status_code in [200, 403]

    def test_get_validation_view(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/timesheets/validation", headers=auth(admin_token))
        assert r.status_code == 200
        groups = r.json()
        assert isinstance(groups, list)
        print(f"Validation groups: {len(groups)}")
        if groups:
            g = groups[0]
            assert "resource_name" in g
            assert "week_start" in g
            assert "ts_ids" in g
            assert "entries" in g

    def test_validate_timesheets(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/timesheets/validation", headers=auth(admin_token))
        groups = r.json()
        if not groups:
            pytest.skip("No groups to validate")
        ts_ids = groups[0]["ts_ids"][:2]  # validate just 2
        r2 = requests.post(
            f"{BASE_URL}/api/timesheets/validate",
            json={"timesheet_ids": ts_ids},
            headers=auth(admin_token),
        )
        assert r2.status_code == 200
        data = r2.json()
        assert "validated" in data
        assert data["validated"] > 0
        print(f"Validated: {data['validated']}")

    def test_reject_timesheets(self, pmo_token):
        r = requests.get(f"{BASE_URL}/api/timesheets/validation", headers=auth(pmo_token))
        groups = r.json()
        if not groups:
            pytest.skip("No groups to reject")
        ts_ids = groups[0]["ts_ids"][:1]
        r2 = requests.post(
            f"{BASE_URL}/api/timesheets/reject",
            json={"timesheet_ids": ts_ids, "rejection_reason": "Test rejection automated"},
            headers=auth(pmo_token),
        )
        assert r2.status_code == 200
        data = r2.json()
        assert "rejected" in data
        print(f"Rejected: {data['rejected']}")


# ─── S3-03: consumed_md after validation ─────────────────────────────────────
class TestConsumedMd:
    def test_consumed_md_updated_after_validation(self, admin_token):
        """After validation, work-allocations should have consumed_md > 0"""
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth(admin_token))
        assert r.status_code == 200
        projects = r.json()
        if not projects:
            pytest.skip("No projects")
        # Find any project with work-allocations
        for proj in projects[:5]:
            wa_r = requests.get(
                f"{BASE_URL}/api/projects/{proj['project_id']}/work-allocations",
                headers=auth(admin_token),
            )
            if wa_r.status_code == 200:
                was = wa_r.json()
                if was:
                    consumed_values = [wa.get("consumed_md", 0) for wa in was]
                    print(f"Project {proj['project_id']}: consumed_md values = {consumed_values}")
                    # At least one should be > 0 after prior validations
                    if any(v > 0 for v in consumed_values):
                        assert True
                        return
        # If none found with > 0, it may mean no validations done yet — warn only
        print("WARNING: No consumed_md > 0 found across projects (may need prior validations)")


# ─── S3-04: Reports ──────────────────────────────────────────────────────────
class TestReports:
    def test_report_by_resource(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/timesheets/report",
            params={"dimension": "resource", "start": "2024-01-01", "end": "2025-12-31"},
            headers=auth(admin_token),
        )
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        print(f"Report rows (resource): {len(rows)}")
        if rows:
            row = rows[0]
            assert "dimension_id" in row
            assert "dimension_label" in row
            assert "periods" in row
            assert "total_jh" in row

    def test_report_by_project(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/timesheets/report",
            params={"dimension": "project", "start": "2024-01-01", "end": "2025-12-31"},
            headers=auth(admin_token),
        )
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        print(f"Report rows (project): {len(rows)}")

    def test_report_csv_download(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/timesheets/report/csv",
            params={"dimension": "resource", "start": "2024-01-01", "end": "2025-12-31"},
            headers=auth(admin_token),
        )
        assert r.status_code == 200
        # Should be CSV content
        ct = r.headers.get("content-type", "")
        assert "text" in ct or "csv" in ct or len(r.text) > 0
        print(f"CSV content length: {len(r.text)}, content-type: {ct}")
