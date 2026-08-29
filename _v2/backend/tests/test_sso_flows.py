"""SSO flows and auth regression tests (iteration_47)."""
import os
import re
from urllib.parse import urlparse, parse_qs

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://project-sync-61.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@altair.fr"
ADMIN_PWD = "Admin2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def tenant_id(admin_headers):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers, timeout=10)
    assert r.status_code == 200
    return r.json()["tenant_id"]


# ---------------- Auth regression ----------------
class TestAuthRegression:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert r.status_code == 200

    def test_login_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data and "user" in data and "permissions" in data

    def test_login_bad_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong!"}, timeout=15)
        assert r.status_code == 401, f"Expected 401 not {r.status_code}: {r.text}"
        assert "Identifiants" in r.text or "invalid" in r.text.lower()

    def test_login_unknown_email(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "nobody@nowhere.xyz", "password": "x"}, timeout=15)
        assert r.status_code == 401, f"Expected 401 not {r.status_code}: {r.text}"


# ---------------- SSO providers + config ----------------
SSO_ENABLED_PAYLOAD = {
    "google": {"enabled": True, "client_id": "test.apps.googleusercontent.com", "client_secret": "s"},
    "entra": {"enabled": True, "client_id": "e-id", "client_secret": "s", "ms_tenant": "organizations"},
    "saml": {
        "enabled": True,
        "idp_entity_id": "https://idp.test/entity",
        "sso_url": "https://idp.test/sso",
        "x509_cert": "MIIC8DCCAdigAwIBAgIQfake",
    },
    "auto_provision": False,
    "allowed_domains": [],
    "default_profile_id": None,
}

SSO_EMPTY_PAYLOAD = {
    "google": {"enabled": False, "client_id": "", "client_secret": "", "ms_tenant": "organizations"},
    "entra": {"enabled": False, "client_id": "", "client_secret": "", "ms_tenant": "organizations"},
    "saml": {"enabled": False, "idp_entity_id": "", "sso_url": "", "x509_cert": ""},
    "auto_provision": False,
    "allowed_domains": [],
    "default_profile_id": None,
}


class TestSSOConfig:
    def test_providers_empty_initially(self):
        r = requests.get(f"{BASE_URL}/api/auth/sso/providers", params={"email": ADMIN_EMAIL}, timeout=10)
        assert r.status_code == 200
        assert r.json() == {"providers": []}

    def test_configure_all_providers(self, admin_headers):
        r = requests.put(f"{BASE_URL}/api/admin/config/sso", json={"sso": SSO_ENABLED_PAYLOAD}, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text

    def test_providers_after_config(self):
        r = requests.get(f"{BASE_URL}/api/auth/sso/providers", params={"email": ADMIN_EMAIL}, timeout=10)
        assert r.status_code == 200
        provs = r.json()["providers"]
        assert set(provs) == {"google", "entra", "saml"}, provs


class TestSSORedirects:
    def test_google_redirect(self):
        r = requests.get(f"{BASE_URL}/api/auth/sso/login/google", params={"email": ADMIN_EMAIL},
                         allow_redirects=False, timeout=10)
        assert r.status_code == 302
        loc = r.headers["location"]
        assert "accounts.google.com/o/oauth2/v2/auth" in loc
        qs = parse_qs(urlparse(loc).query)
        assert qs.get("client_id") == ["test.apps.googleusercontent.com"]
        assert "state" in qs and "nonce" in qs
        assert "/api/auth/sso/callback/google" in qs["redirect_uri"][0]

    def test_entra_redirect(self):
        r = requests.get(f"{BASE_URL}/api/auth/sso/login/entra", params={"email": ADMIN_EMAIL},
                         allow_redirects=False, timeout=10)
        assert r.status_code == 302
        loc = r.headers["location"]
        assert "login.microsoftonline.com/organizations/oauth2/v2.0/authorize" in loc

    def test_saml_redirect(self):
        r = requests.get(f"{BASE_URL}/api/auth/sso/login/saml", params={"email": ADMIN_EMAIL},
                         allow_redirects=False, timeout=10)
        assert r.status_code == 302
        loc = r.headers["location"]
        assert loc.startswith("https://idp.test/sso")
        assert "SAMLRequest=" in loc and "RelayState=" in loc


class TestSSOErrors:
    def test_unknown_email(self):
        r = requests.get(f"{BASE_URL}/api/auth/sso/login/google", params={"email": "inconnu@nulpart.xyz"},
                         allow_redirects=False, timeout=10)
        assert r.status_code == 302
        assert "/login?sso_error=" in r.headers["location"]

    def test_bad_provider(self):
        r = requests.get(f"{BASE_URL}/api/auth/sso/login/badprovider", params={"email": ADMIN_EMAIL},
                         allow_redirects=False, timeout=10)
        assert r.status_code == 302
        assert "/login?sso_error=" in r.headers["location"]

    def test_callback_invalid_state(self):
        r = requests.get(f"{BASE_URL}/api/auth/sso/callback/google",
                         params={"code": "x", "state": "inexistant"},
                         allow_redirects=False, timeout=10)
        assert r.status_code == 302
        assert "/login?sso_error=" in r.headers["location"]

    def test_exchange_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/sso/exchange", json={"code": "invalid"}, timeout=10)
        assert r.status_code == 401


class TestSAMLMetadata:
    def test_metadata_xml(self, tenant_id):
        r = requests.get(f"{BASE_URL}/api/auth/sso/saml/metadata/{tenant_id}", timeout=10)
        assert r.status_code == 200
        xml = r.text
        assert "EntityDescriptor" in xml
        assert "entityID" in xml
        # ACS Location must contain the public host
        m = re.search(r'Location="([^"]+)"', xml)
        assert m, "No Location in metadata"
        assert "project-sync-61.preview.emergentagent.com" in m.group(1), f"Wrong host: {m.group(1)}"


# ---------------- Cleanup (must run last) ----------------
class TestZZZCleanup:
    def test_cleanup_sso_config(self, admin_headers):
        r = requests.put(f"{BASE_URL}/api/admin/config/sso", json={"sso": SSO_EMPTY_PAYLOAD}, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text

    def test_providers_empty_after_cleanup(self):
        r = requests.get(f"{BASE_URL}/api/auth/sso/providers", params={"email": ADMIN_EMAIL}, timeout=10)
        assert r.status_code == 200
        assert r.json()["providers"] == []
