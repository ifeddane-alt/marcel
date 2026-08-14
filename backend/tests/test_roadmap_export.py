"""Backend tests for Roadmap PPTX export endpoint."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://project-sync-61.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@altair.fr",
        "password": "Admin2026!"
    }, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def test_roadmap_pptx_requires_auth():
    r = requests.get(f"{BASE_URL}/api/exports/roadmap.pptx", timeout=30)
    assert r.status_code in (401, 403), f"Expected 401/403 without auth, got {r.status_code}"


def test_roadmap_pptx_with_admin(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/exports/roadmap.pptx",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=60,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
    ctype = r.headers.get("content-type", "")
    assert "presentation" in ctype or "officedocument" in ctype, f"Unexpected content-type: {ctype}"
    # PPTX = ZIP starts with PK
    assert r.content[:2] == b"PK", "Response is not a valid PPTX (missing PK header)"
    assert len(r.content) > 5000, f"PPTX suspiciously small: {len(r.content)} bytes"


def test_roadmap_page_data_endpoints(admin_token):
    """Sanity check: endpoints used by Roadmap page respond."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    for path in ["/api/lifecycle/portfolio", "/api/projects", "/api/programs"]:
        r = requests.get(f"{BASE_URL}{path}", headers=headers, timeout=30)
        assert r.status_code == 200, f"{path} -> {r.status_code}"
