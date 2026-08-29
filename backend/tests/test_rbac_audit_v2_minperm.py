"""Deny-by-default validation with a purpose-built MINIMAL permission profile.

All seeded profiles happen to carry indicators.manage / export.ppt, so a
dedicated TEST_ profile (only dashboard.view + portfolio.view) is created to
prove the deny path of every audited gate. Profile + user are deleted at teardown.
"""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
API = (base_url or "").rstrip("/") + "/api"

MIN_PERMS = ["dashboard.view", "portfolio.view", "arbitrage.view"]
TEST_EMAIL = "test.rbac.minperm@altair.fr"
TEST_PASSWORD = "MinPerm2026!"


@pytest.fixture(scope="module")
def admin_h():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@altair.fr", "password": "Admin2026!"}, timeout=30)
    assert r.status_code == 200, r.text[:200]
    return {"Authorization": f"Bearer {r.json()['access_token']}", "Content-Type": "application/json"}


def _db_purge():
    """No DELETE /admin/users endpoint exists (deactivate only) -> purge test
    fixtures directly so repeated runs stay clean."""
    import asyncio
    from dotenv import load_dotenv
    from motor.motor_asyncio import AsyncIOMotorClient

    load_dotenv("/app/backend/.env")

    async def run():
        cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = cli[os.environ["DB_NAME"]]
        await db.users.delete_many({"email": TEST_EMAIL})
        await db.profiles.delete_many({"code": "TEST_MINPERM"})
        cli.close()

    asyncio.run(run())


@pytest.fixture(scope="module")
def minperm(admin_h):
    _db_purge()

    prof = requests.post(f"{API}/profiles", headers=admin_h, json={
        "name": "TEST_MinPerm", "code": "TEST_MINPERM",
        "description": "TEST rbac audit", "permissions": MIN_PERMS}, timeout=30)
    assert prof.status_code in (200, 201), f"create profile: {prof.status_code} {prof.text[:300]}"
    profile_id = prof.json().get("profile_id") or prof.json().get("id")
    assert profile_id

    usr = requests.post(f"{API}/admin/users", headers=admin_h, json={
        "email": TEST_EMAIL, "name": "TEST MinPerm", "password": TEST_PASSWORD,
        "profile_id": profile_id, "role": "READ_ONLY"}, timeout=30)
    assert usr.status_code in (200, 201), f"create user: {usr.status_code} {usr.text[:300]}"
    user_id = usr.json().get("user_id")

    login = requests.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD}, timeout=30)
    assert login.status_code == 200, f"login minperm: {login.status_code} {login.text[:300]}"
    perms = login.json()["permissions"]
    assert set(perms) == set(MIN_PERMS), f"profile perms not applied: {perms}"
    h = {"Authorization": f"Bearer {login.json()['access_token']}", "Content-Type": "application/json"}

    yield {"h": h, "profile_id": profile_id, "user_id": user_id}

    # teardown
    if user_id:
        requests.patch(f"{API}/admin/users/{user_id}", headers=admin_h, json={"is_active": False}, timeout=30)
    requests.delete(f"{API}/profiles/{profile_id}", headers=admin_h, timeout=30)
    _db_purge()


@pytest.fixture(scope="module")
def project_id(admin_h):
    items = requests.get(f"{API}/projects", headers=admin_h, timeout=30).json()
    if isinstance(items, dict):
        items = items.get("items") or []
    assert items
    return items[0]["project_id"]


class TestMinPermDenies:
    def test_indicator_manual_dashboard_denied(self, minperm):
        r = requests.put(f"{API}/indicator-catalog/manual/dashboard/TEST_ind",
                         headers=minperm["h"], json={"value": 1}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_export_copil_denied(self, minperm):
        r = requests.post(f"{API}/export/copil", headers=minperm["h"],
                          json={"instance_id": "TEST_none"}, timeout=60)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_arbitrage_weights_denied(self, minperm):
        cur = requests.get(f"{API}/arbitrage/weights", headers=minperm["h"], timeout=30)
        body = {k: (cur.json().get(k, 1) if cur.status_code == 200 else 1)
                for k in ("w1", "w2", "w3", "w4", "w5", "w6")}
        r = requests.put(f"{API}/arbitrage/weights", headers=minperm["h"], json=body, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_arbitrage_scenario_denied(self, minperm):
        r = requests.post(f"{API}/arbitrage/scenarios", headers=minperm["h"],
                          json={"name": "TEST_s", "modifications": []}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_apply_template_denied(self, minperm, project_id):
        r = requests.post(f"{API}/projects/{project_id}/apply-template", headers=minperm["h"],
                          json={"template_id": "TEST_none", "selected_phases": None}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_engagement_attest_denied(self, minperm, project_id):
        r = requests.post(f"{API}/projects/{project_id}/engagement/attest", headers=minperm["h"],
                          json={"criterion_id": "x", "checked": True}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_profiles_seed_denied(self, minperm):
        r = requests.post(f"{API}/profiles/seed", headers=minperm["h"], json={}, timeout=60)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_connectors_jira_test_denied(self, minperm):
        r = requests.post(f"{API}/connectors/jira/test", headers=minperm["h"], json={}, timeout=60)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_project_create_denied(self, minperm):
        r = requests.post(f"{API}/projects", headers=minperm["h"], json={
            "name": "TEST_denied", "methodology": "agile", "start_date": "2026-01-01",
            "end_date_baseline": "2026-12-31", "end_date_forecast": "2026-12-31"}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_read_still_allowed(self, minperm):
        r = requests.get(f"{API}/projects", headers=minperm["h"], timeout=30)
        assert r.status_code == 200, f"portfolio.view read broke: {r.status_code} {r.text[:200]}"
