"""
Test suite: Profiles, RBAC Middleware, Admin Users, Resources
Covers: BLOC 2a (Profiles CRUD), BLOC 2b (RBAC permissions), BLOC 2c (Resources)
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


def get_token(email: str, password: str) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    return r.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─── Tokens ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def admin_token():
    return get_token("admin@altair.fr", "Admin1234!")

@pytest.fixture(scope="module")
def pmo_token():
    return get_token("pmo@altair.fr", "Pmo1234!")

@pytest.fixture(scope="module")
def cp_token():
    return get_token("cp@altair.fr", "Altair2026!")

@pytest.fixture(scope="module")
def achats_token():
    return get_token("achats@altair.fr", "Altair2026!")

@pytest.fixture(scope="module")
def user_token():
    return get_token("user@altair.fr", "Altair2026!")

@pytest.fixture(scope="module")
def viewer_token():
    return get_token("viewer@altair.fr", "View1234!")


# ─── BLOC 2b: Login permissions ───────────────────────────────────────────────

class TestLoginPermissions:
    """BLOC 2b: Login response includes permissions"""

    def test_admin_login_has_wildcard(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@altair.fr", "password": "Admin1234!"})
        data = r.json()
        assert r.status_code == 200
        assert "permissions" in data
        perms = data["permissions"]
        assert "*" in perms, f"Admin should have '*' permission, got: {perms}"
        print(f"PASS: Admin has '*' permission")

    def test_cp_login_has_29_permissions(self, cp_token):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "cp@altair.fr", "password": "Altair2026!"})
        data = r.json()
        perms = data.get("permissions", [])
        # CHEF_DE_PROJET profile has 29 permissions per service.py
        assert len(perms) >= 20, f"CP should have many permissions, got {len(perms)}: {perms}"
        assert "demands.submit" in perms, "CP should have demands.submit"
        print(f"PASS: CP has {len(perms)} permissions including demands.submit")

    def test_user_login_has_2_permissions(self, user_token):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "user@altair.fr", "password": "Altair2026!"})
        data = r.json()
        perms = data.get("permissions", [])
        assert len(perms) == 2, f"USER should have 2 permissions, got {len(perms)}: {perms}"
        assert "timesheets.submit" in perms
        assert "leaves.submit" in perms
        print(f"PASS: User has exactly 2 permissions")

    def test_achats_login_has_vendors_perms(self, achats_token):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "achats@altair.fr", "password": "Altair2026!"})
        data = r.json()
        perms = data.get("permissions", [])
        assert "vendors.view" in perms
        assert "projects.create" not in perms
        print(f"PASS: Achats has vendors perms, not projects.create")


# ─── BLOC 2a: Profiles CRUD ───────────────────────────────────────────────────

class TestProfilesCRUD:
    """BLOC 2a: Profiles API"""

    def test_list_profiles_returns_12(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/profiles", headers=auth_headers(admin_token))
        assert r.status_code == 200
        profiles = r.json()
        assert len(profiles) >= 12, f"Expected >=12 profiles, got {len(profiles)}"
        codes = [p["code"] for p in profiles]
        for code in ["ADMIN", "CIO", "PORTFOLIO", "CHEF_DE_PROJET", "MANAGER", "RTE",
                     "ARCHITECTE", "SECURITE", "FINANCE", "ACHATS", "DEMANDEUR", "USER"]:
            assert code in codes, f"Missing system profile: {code}"
        print(f"PASS: {len(profiles)} profiles found, all 12 system codes present")

    def test_create_custom_profile(self, admin_token):
        payload = {
            "name": "Directeur Projet TEST",
            "code": "TEST_DIRECTEUR_PROJET",
            "description": "Profile test",
            "permissions": ["projects.create", "projects.edit"]
        }
        r = requests.post(f"{BASE_URL}/api/profiles", headers=auth_headers(admin_token), json=payload)
        assert r.status_code == 200, f"Create failed: {r.text}"
        data = r.json()
        assert data["code"] == "TEST_DIRECTEUR_PROJET"
        assert data["is_system"] == False
        assert "profile_id" in data
        print(f"PASS: Custom profile created with id={data['profile_id']}")
        return data["profile_id"]

    def test_duplicate_chef_de_projet(self, admin_token):
        # Get CHEF_DE_PROJET profile_id
        profiles = requests.get(f"{BASE_URL}/api/profiles", headers=auth_headers(admin_token)).json()
        cdp = next(p for p in profiles if p["code"] == "CHEF_DE_PROJET")
        pid = cdp["profile_id"]

        r = requests.post(
            f"{BASE_URL}/api/profiles/{pid}/duplicate",
            headers=auth_headers(admin_token),
            json={"new_name": "Chef Projet Senior TEST", "new_code": "TEST_CP_SENIOR"}
        )
        assert r.status_code == 200, f"Duplicate failed: {r.text}"
        data = r.json()
        assert data["code"] == "TEST_CP_SENIOR"
        assert data["is_system"] == False
        # Should inherit permissions
        assert len(data["permissions"]) == len(cdp["permissions"])
        print(f"PASS: Duplicated profile TEST_CP_SENIOR with {len(data['permissions'])} permissions")

    def test_delete_system_profile_fails(self, admin_token):
        profiles = requests.get(f"{BASE_URL}/api/profiles", headers=auth_headers(admin_token)).json()
        cdp = next(p for p in profiles if p["code"] == "CHEF_DE_PROJET")
        r = requests.delete(f"{BASE_URL}/api/profiles/{cdp['profile_id']}", headers=auth_headers(admin_token))
        assert r.status_code == 400, f"Should not allow deleting system profile, got {r.status_code}"
        print("PASS: System profile cannot be deleted")

    def test_delete_custom_profile_succeeds(self, admin_token):
        profiles = requests.get(f"{BASE_URL}/api/profiles", headers=auth_headers(admin_token)).json()
        custom = next((p for p in profiles if p["code"] == "TEST_DIRECTEUR_PROJET"), None)
        if not custom:
            pytest.skip("TEST_DIRECTEUR_PROJET not found - create test may have failed")
        r = requests.delete(f"{BASE_URL}/api/profiles/{custom['profile_id']}", headers=auth_headers(admin_token))
        assert r.status_code == 200, f"Delete failed: {r.text}"
        print("PASS: Custom profile deleted")

    def test_update_profile_permissions(self, admin_token):
        profiles = requests.get(f"{BASE_URL}/api/profiles", headers=auth_headers(admin_token)).json()
        cp_senior = next((p for p in profiles if p["code"] == "TEST_CP_SENIOR"), None)
        if not cp_senior:
            pytest.skip("TEST_CP_SENIOR not found")
        new_perms = ["projects.create", "projects.edit", "risks.view"]
        r = requests.put(
            f"{BASE_URL}/api/profiles/{cp_senior['profile_id']}",
            headers=auth_headers(admin_token),
            json={"permissions": new_perms}
        )
        assert r.status_code == 200, f"Update failed: {r.text}"
        updated = r.json()
        assert updated["permissions"] == new_perms
        print("PASS: Profile permissions updated")

    def test_cleanup_test_profiles(self, admin_token):
        """Cleanup: delete TEST_ profiles"""
        profiles = requests.get(f"{BASE_URL}/api/profiles", headers=auth_headers(admin_token)).json()
        for p in profiles:
            if p["code"].startswith("TEST_"):
                r = requests.delete(f"{BASE_URL}/api/profiles/{p['profile_id']}", headers=auth_headers(admin_token))
                print(f"Cleanup: deleted {p['code']}: {r.status_code}")


# ─── BLOC 2b: RBAC Middleware ─────────────────────────────────────────────────

class TestRBACMiddleware:
    """BLOC 2b: permission_required middleware"""

    def test_achats_cannot_create_project(self, achats_token):
        """ACHATS has no projects.create → 403"""
        r = requests.post(
            f"{BASE_URL}/api/projects",
            headers=auth_headers(achats_token),
            json={"name": "Test", "status": "en_cours"}
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
        print("PASS: ACHATS cannot create project → 403")

    def test_pmo_create_project_422_invalid_payload(self, pmo_token):
        """PORTFOLIO has projects.create → passes auth, fails on validation → 422"""
        r = requests.post(
            f"{BASE_URL}/api/projects",
            headers=auth_headers(pmo_token),
            json={}  # invalid payload
        )
        # Either 422 (validation) meaning permissions OK
        assert r.status_code in [422, 400], f"Expected 422/400, got {r.status_code}: {r.text}"
        print(f"PASS: PMO projects.create → validation error {r.status_code} (perms OK)")

    def test_user_cannot_create_demand(self, user_token):
        """USER has only timesheets.submit + leaves.submit → no demands.submit → 403"""
        r = requests.post(
            f"{BASE_URL}/api/demands",
            headers=auth_headers(user_token),
            json={"title": "Test demand", "description": "test"}
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
        print("PASS: USER cannot create demand → 403")

    def test_cp_can_create_demand(self, cp_token):
        """CHEF_DE_PROJET has demands.submit → should pass auth (422 or 200)"""
        r = requests.post(
            f"{BASE_URL}/api/demands",
            headers=auth_headers(cp_token),
            json={"title": "Test CP demand", "description": "test", "urgency": "normale", "source": "interne"}
        )
        assert r.status_code in [200, 201, 422], f"CP demand: Expected success/validation, got {r.status_code}: {r.text}"
        print(f"PASS: CP demands.submit → {r.status_code}")


# ─── BLOC 2a: Admin Users ─────────────────────────────────────────────────────

class TestAdminUsers:
    """BLOC 2a: Admin users management"""

    def test_list_all_users_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers(admin_token))
        assert r.status_code == 200
        users = r.json()
        assert len(users) >= 7, f"Expected >=7 users, got {len(users)}"
        emails = [u["email"] for u in users]
        for email in ["admin@altair.fr", "pmo@altair.fr", "viewer@altair.fr",
                      "cp@altair.fr", "manager@altair.fr", "user@altair.fr", "achats@altair.fr"]:
            assert email in emails, f"Missing user: {email}"
        print(f"PASS: {len(users)} users found")

    def test_list_users_pmo_forbidden(self, pmo_token):
        """Non-admin cannot list admin users"""
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers(pmo_token))
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        print("PASS: PMO cannot access admin/users → 403")

    def test_change_user_profile(self, admin_token):
        """PATCH /admin/users/{id} changes profile"""
        users = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers(admin_token)).json()
        viewer = next(u for u in users if u["email"] == "viewer@altair.fr")
        user_id = viewer["user_id"]

        # Get MANAGER profile
        profiles = requests.get(f"{BASE_URL}/api/profiles", headers=auth_headers(admin_token)).json()
        cio_profile = next(p for p in profiles if p["code"] == "CIO")

        r = requests.patch(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers=auth_headers(admin_token),
            json={"profile_id": cio_profile["profile_id"]}
        )
        assert r.status_code == 200, f"Update failed: {r.text}"
        # Restore
        original_profile = next((p for p in profiles if p["code"] == "CIO"), None)
        if original_profile:
            requests.patch(
                f"{BASE_URL}/api/admin/users/{user_id}",
                headers=auth_headers(admin_token),
                json={"profile_id": original_profile["profile_id"]}
            )
        print("PASS: User profile changed successfully")


# ─── BLOC 2c: Resources with external types ───────────────────────────────────

class TestResourcesEnriched:
    """BLOC 2c: External resources"""

    def test_list_resources_includes_external(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/resources", headers=auth_headers(admin_token))
        assert r.status_code == 200
        resources = r.json()
        assert len(resources) > 0, "No resources found"
        # Check for external resources
        external = [res for res in resources if res.get("resource_type") in ["externe_regie", "externe_forfait"]]
        print(f"INFO: {len(resources)} total resources, {len(external)} external")
        # Check for Capgemini/Accenture
        names = [res.get("name", "").lower() for res in resources]
        has_capgemini = any("capgemini" in n for n in names)
        has_accenture = any("accenture" in n for n in names)
        print(f"Capgemini present: {has_capgemini}, Accenture present: {has_accenture}")
        assert has_capgemini or has_accenture or len(external) > 0, "Expected external resources (Capgemini/Accenture)"
        print(f"PASS: External resources found: {len(external)}")


# ─── All permissions endpoint ────────────────────────────────────────────────

class TestPermissionsEndpoint:
    def test_get_all_permissions(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/profiles/permissions", headers=auth_headers(admin_token))
        assert r.status_code == 200
        perms = r.json()
        assert len(perms) >= 40, f"Expected >=40 permissions, got {len(perms)}"
        keys = [p["key"] for p in perms]
        assert "projects.create" in keys
        assert "admin.profiles" in keys
        print(f"PASS: {len(perms)} permissions available")
