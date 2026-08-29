"""Supplemental security checks for the MARCEL V2 RBAC audit:
 - indicator-catalog manual value (dashboard scope) requires indicators.manage
 - POST /export/copil requires export.ppt
 - unauthenticated / invalid-token rejection
 - password hash format (bcrypt $2b$) in DB
 - brute-force protection on /api/auth/login
 - cross-tenant isolation smoke check
"""
import os
import asyncio
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
API = base_url.rstrip("/") + "/api"

ACCOUNTS = {
    "admin": ("admin@altair.fr", "Admin2026!"),
    "manager": ("manager@altair.fr", "Altair2026!"),
    "viewer": ("viewer@altair.fr", "View1234!"),
    "beta_admin": ("admin@betacorp.fr", "Beta2026!"),
}


@pytest.fixture(scope="module")
def sess():
    out = {}
    for k, (e, p) in ACCOUNTS.items():
        r = requests.post(f"{API}/auth/login", json={"email": e, "password": p}, timeout=30)
        if r.status_code != 200:
            pytest.fail(f"login {e} -> {r.status_code} {r.text[:200]}")
        d = r.json()
        out[k] = {"h": {"Authorization": f"Bearer {d['access_token']}", "Content-Type": "application/json"},
                  "perms": d.get("permissions", []), "user": d.get("user", {})}
    return out


# ── indicators.manage gate on portfolio/dashboard manual values ─────────────
class TestIndicatorManualGate:
    def test_viewer_has_indicators_manage_allowed(self, sess):
        perms = sess["viewer"]["perms"]
        assert "indicators.manage" in perms, f"precondition failed, viewer perms: {perms}"
        r = requests.put(f"{API}/indicator-catalog/manual/dashboard/TEST_ind",
                         headers=sess["viewer"]["h"], json={"value": 42}, timeout=30)
        assert r.status_code != 403, f"viewer WITH indicators.manage got 403: {r.text[:300]}"

    def test_user_without_perm_denied(self, sess):
        perms = sess["manager"]["perms"]
        if "indicators.manage" in perms or "*" in perms:
            pytest.skip("manager has indicators.manage; no negative subject available")
        r = requests.put(f"{API}/indicator-catalog/manual/dashboard/TEST_ind",
                         headers=sess["manager"]["h"], json={"value": 42}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"


# ── export.ppt gate ─────────────────────────────────────────────────────────
class TestExportCopilGate:
    def test_viewer_with_export_ppt_not_denied(self, sess):
        assert "export.ppt" in sess["viewer"]["perms"]
        r = requests.post(f"{API}/export/copil", headers=sess["viewer"]["h"],
                          json={"instance_id": "TEST_none"}, timeout=60)
        assert r.status_code != 403, f"viewer WITH export.ppt got 403: {r.text[:300]}"

    def test_no_token_rejected(self):
        r = requests.post(f"{API}/export/copil", json={"instance_id": "TEST_none"}, timeout=30)
        assert r.status_code in (401, 403), f"unauthenticated got {r.status_code}"


# ── Authentication hardening ───────────────────────────────────────────────
class TestAuthHardening:
    def test_invalid_token_rejected(self):
        r = requests.get(f"{API}/projects", headers={"Authorization": "Bearer invalid.token.here"}, timeout=30)
        assert r.status_code == 401, f"expected 401, got {r.status_code}"

    def test_missing_auth_rejected(self):
        r = requests.get(f"{API}/projects", timeout=30)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_password_hashes_are_bcrypt_2b(self):
        from motor.motor_asyncio import AsyncIOMotorClient

        async def check():
            cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
            db = cli[os.environ["DB_NAME"]]
            bad = []
            async for u in db.users.find({}, {"_id": 0, "email": 1, "password_hash": 1}):
                ph = u.get("password_hash")
                if ph and not ph.startswith("$2b$"):
                    bad.append((u.get("email"), ph[:7]))
            cli.close()
            return bad

        bad = asyncio.run(check())
        assert not bad, f"non-$2b$ bcrypt hashes found: {bad}"

    def test_bruteforce_lockout(self):
        email = "TEST_bruteforce_probe@altair.fr"
        statuses = []
        for _ in range(13):
            r = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrong"}, timeout=30)
            statuses.append(r.status_code)
            if r.status_code == 429:
                break
        assert 429 in statuses, f"no throttling after 13 failed attempts: {statuses}"

    def test_login_wrong_password_401(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "admin@altair.fr", "password": "definitely-wrong"}, timeout=30)
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


# ── Tenant settings write gate (role-based, not permission-based) ──────────
class TestTenantSettingsGate:
    def test_manager_denied(self, sess):
        cur = requests.get(f"{API}/tenant/settings", headers=sess["manager"]["h"], timeout=30)
        body = cur.json() if cur.status_code == 200 else {}
        r = requests.put(f"{API}/tenant/settings", headers=sess["manager"]["h"], json=body, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_viewer_denied(self, sess):
        r = requests.put(f"{API}/tenant/settings", headers=sess["viewer"]["h"], json={}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"


# ── Cross-tenant isolation ─────────────────────────────────────────────────
class TestCrossTenant:
    def test_beta_admin_cannot_see_altair_project(self, sess):
        r = requests.get(f"{API}/projects", headers=sess["admin"]["h"], timeout=30)
        assert r.status_code == 200
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items") or []
        assert items
        pid = items[0]["project_id"]
        r2 = requests.get(f"{API}/projects/{pid}", headers=sess["beta_admin"]["h"], timeout=30)
        assert r2.status_code in (403, 404), f"cross-tenant read allowed: {r2.status_code} {r2.text[:200]}"

    def test_beta_admin_cannot_patch_altair_scoring(self, sess):
        r = requests.get(f"{API}/projects", headers=sess["admin"]["h"], timeout=30)
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items") or []
        pid = items[0]["project_id"]
        r2 = requests.patch(f"{API}/arbitrage/projects/{pid}/scoring",
                            headers=sess["beta_admin"]["h"], json={"business_value": 1}, timeout=30)
        assert r2.status_code in (403, 404), f"cross-tenant write allowed: {r2.status_code} {r2.text[:200]}"
