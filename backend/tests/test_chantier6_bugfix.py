"""
Chantier 6 Bug Fix Tests — POST /api/projects/:id/budget-revision
Tests: author fallback, author=null, author provided, 404, 403 (READ_ONLY), PMO 200
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def get_token(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    return r.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token():
    return get_token("admin@altair.fr", "Admin1234!")


@pytest.fixture(scope="module")
def pmo_token():
    return get_token("pmo@altair.fr", "Pmo1234!")


@pytest.fixture(scope="module")
def viewer_token():
    return get_token("viewer@altair.fr", "View1234!")


@pytest.fixture(scope="module")
def any_project_id(admin_token):
    """Get any existing project id for the tenant."""
    r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(admin_token))
    assert r.status_code == 200
    projects = r.json()
    assert len(projects) > 0, "No projects found"
    return projects[0]["project_id"]


class TestBudgetRevisionFix:
    """POST /api/projects/:id/budget-revision — author fallback bug fix"""

    def test_author_empty_fallback_to_email(self, admin_token, any_project_id):
        """Author empty → backend uses current_user.email (admin@altair.fr)"""
        r = requests.post(
            f"{BASE_URL}/api/projects/{any_project_id}/budget-revision",
            json={"eac": 999000, "reason": "TEST empty author fallback"},
            headers=auth_headers(admin_token)
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        history = r.json().get("budget_revision_history", [])
        assert len(history) > 0, "No revision history"
        last = history[-1]
        assert last["author"] == "admin@altair.fr", f"Expected admin@altair.fr, got {last['author']}"
        assert last["reason"] == "TEST empty author fallback"

    def test_author_null_fallback_to_email(self, admin_token, any_project_id):
        """Author=null → no AttributeError, uses current_user.email"""
        r = requests.post(
            f"{BASE_URL}/api/projects/{any_project_id}/budget-revision",
            json={"eac": 998000, "reason": "TEST null author fallback", "author": None},
            headers=auth_headers(admin_token)
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        history = r.json().get("budget_revision_history", [])
        last = history[-1]
        assert last["author"] == "admin@altair.fr"

    def test_author_provided_kept(self, admin_token, any_project_id):
        """When author is provided, it's preserved"""
        r = requests.post(
            f"{BASE_URL}/api/projects/{any_project_id}/budget-revision",
            json={"eac": 997000, "reason": "TEST explicit author", "author": "Sophie Martin"},
            headers=auth_headers(admin_token)
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        history = r.json().get("budget_revision_history", [])
        last = history[-1]
        assert last["author"] == "Sophie Martin", f"Expected 'Sophie Martin', got {last['author']}"

    def test_fake_project_returns_404(self, admin_token):
        """Non-existent project → 404"""
        r = requests.post(
            f"{BASE_URL}/api/projects/fake-uuid-123/budget-revision",
            json={"eac": 500000, "reason": "TEST fake project"},
            headers=auth_headers(admin_token)
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}"

    def test_read_only_returns_403(self, viewer_token, any_project_id):
        """READ_ONLY user → 403"""
        r = requests.post(
            f"{BASE_URL}/api/projects/{any_project_id}/budget-revision",
            json={"eac": 500000, "reason": "TEST viewer forbidden"},
            headers=auth_headers(viewer_token)
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"

    def test_pmo_can_post_budget_revision(self, pmo_token, any_project_id):
        """PMO user → 200 (has write rights)"""
        r = requests.post(
            f"{BASE_URL}/api/projects/{any_project_id}/budget-revision",
            json={"eac": 996000, "reason": "TEST PMO revision"},
            headers=auth_headers(pmo_token)
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        last = r.json().get("budget_revision_history", [])[-1]
        assert last["author"] == "pmo@altair.fr"

    def test_revision_history_grows(self, admin_token, any_project_id):
        """After revision, history count increases by 1"""
        before = requests.get(f"{BASE_URL}/api/projects/{any_project_id}", headers=auth_headers(admin_token))
        before_count = len(before.json().get("budget_revision_history", []))
        
        requests.post(
            f"{BASE_URL}/api/projects/{any_project_id}/budget-revision",
            json={"eac": 995000, "reason": "TEST history growth check"},
            headers=auth_headers(admin_token)
        )
        after = requests.get(f"{BASE_URL}/api/projects/{any_project_id}", headers=auth_headers(admin_token))
        after_count = len(after.json().get("budget_revision_history", []))
        assert after_count == before_count + 1, f"Expected history to grow by 1: {before_count} → {after_count}"

    def test_new_project_budget_revision(self, admin_token):
        """Create a new project then apply budget-revision → 200"""
        # Create project
        create_r = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                "name": "Test-Budget-02",
                "methodology": "waterfall",
                "status_rag": "green",
                "capex_planned": 500000,
                "opex_planned": 200000,
                "jh_planned": 100,
                "start_date": "2025-01-01",
                "end_date_baseline": "2025-12-31",
                "end_date_forecast": "2025-12-31",
            },
            headers=auth_headers(admin_token)
        )
        assert create_r.status_code == 201, f"Create failed: {create_r.text}"
        new_id = create_r.json()["project_id"]

        # Budget revision on new project
        rev_r = requests.post(
            f"{BASE_URL}/api/projects/{new_id}/budget-revision",
            json={"eac": 750000, "reason": "TEST initial revision"},
            headers=auth_headers(admin_token)
        )
        assert rev_r.status_code == 200, f"Expected 200, got {rev_r.status_code}: {rev_r.text}"
        assert rev_r.json()["eac"] == 750000

        # Cleanup
        requests.delete(f"{BASE_URL}/api/projects/{new_id}", headers=auth_headers(admin_token))
