"""Tests Stream 3 Enhancement — Workflow validation timesheets multi-acteurs.
Tests: get_validation_view (valideur/cp/pmo), pending-count, validate, reject.
Credentials: admin=TENANT_ADMIN (Sophie Martin), pmo=PMO_USER (Thomas Dubois)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_CREDS = {"email": "admin@altair.fr", "password": "Admin1234!"}
PMO_CREDS   = {"email": "pmo@altair.fr",   "password": "Pmo1234!"}


def login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return login(ADMIN_CREDS)


@pytest.fixture(scope="module")
def pmo_token():
    return login(PMO_CREDS)


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ── 1. Vue valideur pour admin ────────────────────────────────────────────────
def test_view_valideur_admin(admin_token):
    r = requests.get(f"{BASE_URL}/api/timesheets/validation?view=valideur",
                     headers=auth_headers(admin_token))
    assert r.status_code == 200, r.text
    data = r.json()
    print(f"[valideur admin] groups: {len(data)}")
    # admin est valideur de Thomas Dubois (pmo resource_id)
    # Tous les groupes doivent avoir status=submitted
    for g in data:
        assert g["status"] == "submitted", f"Expected submitted, got {g['status']}"
    # May be empty if Thomas has no submitted timesheets


# ── 2. Vue valideur pour PMO ──────────────────────────────────────────────────
def test_view_valideur_pmo(pmo_token):
    r = requests.get(f"{BASE_URL}/api/timesheets/validation?view=valideur",
                     headers=auth_headers(pmo_token))
    assert r.status_code == 200, r.text
    data = r.json()
    print(f"[valideur pmo] groups: {len(data)}")
    for g in data:
        assert g["status"] == "submitted"


# ── 3. Vue CP pour admin ──────────────────────────────────────────────────────
def test_view_cp_admin(admin_token):
    r = requests.get(f"{BASE_URL}/api/timesheets/validation?view=cp",
                     headers=auth_headers(admin_token))
    assert r.status_code == 200, r.text
    data = r.json()
    print(f"[cp admin] groups: {len(data)}")
    for g in data:
        assert g["status"] == "cp_reviewed", f"Expected cp_reviewed, got {g['status']}"


# ── 4. Vue CP pour PMO ────────────────────────────────────────────────────────
def test_view_cp_pmo(pmo_token):
    r = requests.get(f"{BASE_URL}/api/timesheets/validation?view=cp",
                     headers=auth_headers(pmo_token))
    assert r.status_code == 200, r.text
    data = r.json()
    print(f"[cp pmo] groups: {len(data)}")
    for g in data:
        assert g["status"] == "cp_reviewed"


# ── 5. Vue PMO (admin) ────────────────────────────────────────────────────────
def test_view_pmo_admin(admin_token):
    r = requests.get(f"{BASE_URL}/api/timesheets/validation?view=pmo",
                     headers=auth_headers(admin_token))
    assert r.status_code == 200, r.text
    data = r.json()
    print(f"[pmo admin] groups: {len(data)}")
    assert len(data) > 0, "PMO view should have groups"
    for g in data:
        assert g["status"] in ("submitted", "cp_reviewed")


# ── 6. Vue PMO (pmo user) ─────────────────────────────────────────────────────
def test_view_pmo_pmouser(pmo_token):
    r = requests.get(f"{BASE_URL}/api/timesheets/validation?view=pmo",
                     headers=auth_headers(pmo_token))
    assert r.status_code == 200, r.text
    data = r.json()
    print(f"[pmo pmo_user] groups: {len(data)}")
    assert len(data) > 0, "PMO view should have groups"


# ── 7. Vue invalide → 422 ─────────────────────────────────────────────────────
def test_view_invalid(admin_token):
    r = requests.get(f"{BASE_URL}/api/timesheets/validation?view=invalid",
                     headers=auth_headers(admin_token))
    assert r.status_code == 422, f"Expected 422, got {r.status_code}"


# ── 8. Pending count non nul pour admin ───────────────────────────────────────
def test_pending_count_admin(admin_token):
    r = requests.get(f"{BASE_URL}/api/timesheets/pending-count",
                     headers=auth_headers(admin_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert "count" in data
    print(f"[pending-count admin] count={data['count']}")
    assert data["count"] > 0, "Admin should have pending timesheets"


# ── 9. Pending count non nul pour PMO ────────────────────────────────────────
def test_pending_count_pmo(pmo_token):
    r = requests.get(f"{BASE_URL}/api/timesheets/pending-count",
                     headers=auth_headers(pmo_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert "count" in data
    print(f"[pending-count pmo] count={data['count']}")
    assert data["count"] > 0, "PMO should have pending timesheets"


# ── 10. Rejet sans motif → 422 ────────────────────────────────────────────────
def test_reject_no_reason(admin_token):
    r = requests.post(f"{BASE_URL}/api/timesheets/reject",
                      json={"timesheet_ids": ["fake-id"], "rejection_reason": ""},
                      headers=auth_headers(admin_token))
    assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"


# ── 11. Validate admin as valideur N+1 (submitted → cp_reviewed) ─────────────
def test_validate_valideur_admin(admin_token):
    # Get submitted timesheets where admin is the valideur
    r = requests.get(f"{BASE_URL}/api/timesheets/validation?view=valideur",
                     headers=auth_headers(admin_token))
    assert r.status_code == 200
    groups = r.json()
    if not groups:
        pytest.skip("No submitted timesheets for admin as valideur")
    # Take first group's ts_ids
    ts_ids = groups[0]["ts_ids"][:2]
    print(f"[validate valideur] validating {len(ts_ids)} timesheets")
    r2 = requests.post(f"{BASE_URL}/api/timesheets/validate",
                       json={"timesheet_ids": ts_ids},
                       headers=auth_headers(admin_token))
    assert r2.status_code == 200, r2.text
    data = r2.json()
    print(f"[validate valideur] result: {data}")
    assert data.get("advanced_to_cp_reviewed", 0) > 0 or data.get("validated", 0) > 0


# ── 12. Validate admin as CP (cp_reviewed → validated) ───────────────────────
def test_validate_cp_admin(admin_token):
    r = requests.get(f"{BASE_URL}/api/timesheets/validation?view=cp",
                     headers=auth_headers(admin_token))
    assert r.status_code == 200
    groups = r.json()
    if not groups:
        pytest.skip("No cp_reviewed timesheets for admin as CP")
    ts_ids = groups[0]["ts_ids"][:2]
    print(f"[validate CP] validating {len(ts_ids)} timesheets")
    r2 = requests.post(f"{BASE_URL}/api/timesheets/validate",
                       json={"timesheet_ids": ts_ids},
                       headers=auth_headers(admin_token))
    assert r2.status_code == 200, r2.text
    data = r2.json()
    print(f"[validate CP] result: {data}")
    assert data.get("validated", 0) > 0


# ── 13. PMO bypass validate ───────────────────────────────────────────────────
def test_validate_pmo_bypass(pmo_token):
    r = requests.get(f"{BASE_URL}/api/timesheets/validation?view=pmo",
                     headers=auth_headers(pmo_token))
    assert r.status_code == 200
    groups = r.json()
    if not groups:
        pytest.skip("No timesheets for PMO bypass")
    ts_ids = groups[0]["ts_ids"][:1]
    print(f"[PMO bypass] validating {len(ts_ids)} timesheets: {ts_ids}")
    r2 = requests.post(f"{BASE_URL}/api/timesheets/validate",
                       json={"timesheet_ids": ts_ids},
                       headers=auth_headers(pmo_token))
    assert r2.status_code == 200, r2.text
    data = r2.json()
    print(f"[PMO bypass] result: {data}")
    assert data.get("validated", 0) > 0


# ── 14. Reject by admin (from pmo view) ──────────────────────────────────────
def test_reject_timesheets(admin_token):
    r = requests.get(f"{BASE_URL}/api/timesheets/validation?view=pmo",
                     headers=auth_headers(admin_token))
    assert r.status_code == 200
    groups = r.json()
    if not groups:
        pytest.skip("No timesheets to reject")
    ts_ids = groups[0]["ts_ids"][:1]
    print(f"[reject] rejecting {ts_ids}")
    r2 = requests.post(f"{BASE_URL}/api/timesheets/reject",
                       json={"timesheet_ids": ts_ids, "rejection_reason": "Test rejet motif"},
                       headers=auth_headers(admin_token))
    assert r2.status_code == 200, r2.text
    data = r2.json()
    print(f"[reject] result: {data}")
    assert data.get("rejected", 0) > 0
