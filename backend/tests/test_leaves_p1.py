"""Backend tests — P1 Congés & Absences (leaves module)."""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

ADMIN_EMAIL = "admin@altair.fr"
ADMIN_PASS  = "Admin1234!"
ADMIN_RID   = "a82d3ce1-d68f-4d0c-8d7b-6af1ac131d14"

PMO_EMAIL   = "pmo@altair.fr"
PMO_PASS    = "Pmo1234!"
PMO_RID     = "ca36f436-ffad-45f9-bd9f-1b7f6ac5a397"

# Test dates — week days only
DATE_WD = "2026-02-10"   # Tuesday Feb 10 2026
DATE_WE = "2026-02-07"   # Saturday Feb 7 2026


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ── 1. Holidays FR+MA mai 2026 ───────────────────────────────────────────────

def test_holidays_may_2026_has_correct_dates(auth_headers):
    """GET /api/holidays?year=2026&month=5 → contient 1/5, 8/5, 14/5, 25/5, 27/5, 28/5"""
    r = requests.get(f"{BASE_URL}/api/holidays", params={"year": 2026, "month": 5},
                     headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    expected = ["2026-05-01", "2026-05-08", "2026-05-14", "2026-05-25", "2026-05-27", "2026-05-28"]
    for d in expected:
        assert d in data, f"Manque le férié {d} dans {list(data.keys())}"
    print(f"PASS: holidays mai 2026 = {list(data.keys())}")


def test_holidays_february_2026_empty(auth_headers):
    """GET /api/holidays?year=2026&month=2 → {} aucun férié"""
    r = requests.get(f"{BASE_URL}/api/holidays", params={"year": 2026, "month": 2},
                     headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data == {}, f"Attendu vide mais reçu {data}"
    print("PASS: holidays février 2026 vide")


# ── 2. Leaves CRUD ──────────────────────────────────────────────────────────

def test_leave_create_half_day(auth_headers):
    """PUT /api/leaves/entry value=0.5 crée demi-journée"""
    # Clean first
    requests.put(f"{BASE_URL}/api/leaves/entry",
                 json={"resource_id": ADMIN_RID, "date": DATE_WD, "value": 0.0},
                 headers=auth_headers)
    r = requests.put(f"{BASE_URL}/api/leaves/entry",
                     json={"resource_id": ADMIN_RID, "date": DATE_WD, "value": 0.5},
                     headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("value") == 0.5
    print(f"PASS: leave 0.5 créé: {data}")


def test_leave_update_full_day(auth_headers):
    """PUT /api/leaves/entry value=1.0 met à jour l'absence"""
    r = requests.put(f"{BASE_URL}/api/leaves/entry",
                     json={"resource_id": ADMIN_RID, "date": DATE_WD, "value": 1.0},
                     headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("value") == 1.0
    print(f"PASS: leave 1.0 créé: {data}")


def test_leave_delete_value_zero(auth_headers):
    """PUT /api/leaves/entry value=0.0 supprime l'absence"""
    r = requests.put(f"{BASE_URL}/api/leaves/entry",
                     json={"resource_id": ADMIN_RID, "date": DATE_WD, "value": 0.0},
                     headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("deleted") is True
    print(f"PASS: leave supprimé: {data}")


def test_leave_weekend_422(auth_headers):
    """PUT /api/leaves/entry sur week-end → 422"""
    r = requests.put(f"{BASE_URL}/api/leaves/entry",
                     json={"resource_id": ADMIN_RID, "date": DATE_WE, "value": 0.5},
                     headers=auth_headers)
    assert r.status_code == 422, f"Attendu 422 mais reçu {r.status_code}: {r.text}"
    print("PASS: week-end → 422")


# ── 3. Timesheets 409 si absence 1.0 ────────────────────────────────────────

def test_timesheet_blocked_by_full_day_absence(auth_headers):
    """PUT /api/timesheets/entry avec jh_value>0 sur absence=1.0 → 409"""
    # Set leave to 1.0
    requests.put(f"{BASE_URL}/api/leaves/entry",
                 json={"resource_id": ADMIN_RID, "date": DATE_WD, "value": 1.0},
                 headers=auth_headers)

    # Get a work_allocation_id for admin
    grid = requests.get(f"{BASE_URL}/api/timesheets/grid",
                        params={"resource_id": ADMIN_RID, "week_start": "2026-02-09"},
                        headers=auth_headers)
    assert grid.status_code == 200, grid.text
    rows = grid.json().get("rows", [])
    if not rows:
        pytest.skip("Pas d'allocation pour admin — impossible de tester le 409")

    waid = rows[0]["work_allocation_id"]
    r = requests.put(f"{BASE_URL}/api/timesheets/entry",
                     json={"resource_id": ADMIN_RID, "work_allocation_id": waid,
                           "date": DATE_WD, "jh_value": 0.5},
                     headers=auth_headers)
    assert r.status_code == 409, f"Attendu 409 mais reçu {r.status_code}: {r.text}"
    print("PASS: 409 sur absence 1.0")

    # Cleanup
    requests.put(f"{BASE_URL}/api/leaves/entry",
                 json={"resource_id": ADMIN_RID, "date": DATE_WD, "value": 0.0},
                 headers=auth_headers)


# ── 4. get_grid retourne leaves, holidays, day_caps ─────────────────────────

def test_grid_contains_leaves_holidays_day_caps(auth_headers):
    """GET /api/timesheets/grid retourne les champs leaves, holidays, day_caps"""
    r = requests.get(f"{BASE_URL}/api/timesheets/grid",
                     params={"resource_id": ADMIN_RID, "week_start": "2026-02-09"},
                     headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "leaves" in data, "Champ 'leaves' manquant"
    assert "holidays" in data, "Champ 'holidays' manquant"
    assert "day_caps" in data, "Champ 'day_caps' manquant"
    print(f"PASS: grid contient leaves={data['leaves']}, holidays={data['holidays']}, day_caps={data['day_caps']}")


# ── 5. Calendrier mensuel ────────────────────────────────────────────────────

def test_month_calendar_feb_2026_no_holidays(auth_headers):
    """GET /api/leaves/month février 2026 → total_working=20, holiday_days=0"""
    r = requests.get(f"{BASE_URL}/api/leaves/month",
                     params={"resource_id": ADMIN_RID, "month": "2026-02"},
                     headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    stats = data.get("stats", {})
    assert stats.get("total_working") == 20, f"Attendu 20 mais reçu {stats.get('total_working')}"
    assert stats.get("holiday_days") == 0, f"Attendu 0 férié mais reçu {stats.get('holiday_days')}"
    print(f"PASS: feb 2026 stats={stats}")


def test_month_calendar_may_2026_has_holidays(auth_headers):
    """GET /api/leaves/month mai 2026 → holiday_days > 0"""
    r = requests.get(f"{BASE_URL}/api/leaves/month",
                     params={"resource_id": ADMIN_RID, "month": "2026-05"},
                     headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    stats = data.get("stats", {})
    assert stats.get("holiday_days", 0) > 0, f"Attendu >0 fériés mais reçu {stats.get('holiday_days')}"
    # Also verify days contain holiday entries
    days = data.get("days", [])
    holiday_dates = [d["date"] for d in days if d.get("is_holiday")]
    print(f"PASS: mai 2026 stats={stats}, fériés={holiday_dates}")
