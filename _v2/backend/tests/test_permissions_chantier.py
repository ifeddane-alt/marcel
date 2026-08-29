"""
Tests Chantier Frontend Permissions - Backend login returns profile_name for all 7 accounts
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

ACCOUNTS = [
    {"email": "admin@altair.fr",   "password": "Admin2026!",  "expected_profile": "Administrateur"},
    {"email": "pmo@altair.fr",     "password": "Altair2026!", "expected_profile": "PMO Portefeuille"},
    {"email": "viewer@altair.fr",  "password": "View1234!",   "expected_profile": "Direction SI"},
    {"email": "cp@altair.fr",      "password": "Altair2026!", "expected_profile": None},  # any non-empty
    {"email": "manager@altair.fr", "password": "Altair2026!", "expected_profile": None},
    {"email": "user@altair.fr",    "password": "Altair2026!", "expected_profile": None},
    {"email": "achats@altair.fr",  "password": "Altair2026!", "expected_profile": "Achats / Procurement"},  # or similar
]


class TestLoginProfileName:
    """Verify login returns profile_name for all accounts"""

    @pytest.mark.parametrize("account", ACCOUNTS, ids=[a["email"] for a in ACCOUNTS])
    def test_login_returns_profile_name(self, account):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": account["email"],
            "password": account["password"]
        })
        assert r.status_code == 200, f"Login failed for {account['email']}: {r.text}"
        data = r.json()
        assert "user" in data, "No 'user' in response"
        user = data["user"]
        profile_name = user.get("profile_name", "")
        assert profile_name, f"profile_name is empty for {account['email']}: {user}"
        print(f"OK {account['email']} -> profile_name='{profile_name}'")
        if account["expected_profile"]:
            assert profile_name == account["expected_profile"], \
                f"Expected '{account['expected_profile']}' got '{profile_name}'"

    def test_admin_has_wildcard_permission(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@altair.fr",
            "password": "Admin2026!"
        })
        assert r.status_code == 200
        user = r.json()["user"]
        perms = user.get("permissions", [])
        assert "*" in perms or any(p.startswith("admin.") for p in perms), \
            f"Admin missing admin permissions: {perms}"
        print(f"Admin permissions: {perms[:5]}...")

    def test_user_has_only_timesheets_permission(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "user@altair.fr",
            "password": "Altair2026!"
        })
        assert r.status_code == 200
        user = r.json()["user"]
        perms = user.get("permissions", [])
        assert "timesheets.submit" in perms, f"user@altair.fr missing timesheets.submit: {perms}"
        assert "dashboard.view" not in perms, f"user@altair.fr should NOT have dashboard.view: {perms}"
        print(f"user permissions: {perms}")

    def test_viewer_has_no_write_perms(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "viewer@altair.fr",
            "password": "View1234!"
        })
        assert r.status_code == 200
        user = r.json()["user"]
        perms = user.get("permissions", [])
        write_perms = [p for p in perms if any(x in p for x in [".create", ".edit", ".delete", ".submit"])]
        assert not write_perms, f"viewer should have no write permissions, found: {write_perms}"
        print(f"viewer permissions: {perms}")

    def test_achats_has_dashboard_and_vendors(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "achats@altair.fr",
            "password": "Altair2026!"
        })
        assert r.status_code == 200
        user = r.json()["user"]
        perms = user.get("permissions", [])
        assert "dashboard.view" in perms, f"achats missing dashboard.view: {perms}"
        assert "vendors.view" in perms, f"achats missing vendors.view: {perms}"
        print(f"achats permissions: {perms}")
