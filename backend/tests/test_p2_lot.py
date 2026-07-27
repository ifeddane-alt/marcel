"""P2 Lot tests: Waterfall template (18 tasks), CxO dashboard, MS Project import/export, email alerts config, regression."""
import os
import pytest
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN = {"email": "admin@altair.fr", "password": "Admin2026!"}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def h(token):
    return {"Authorization": f"Bearer {token}"}


# ============ REGRESSION ============
def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_dashboard_summary(h):
    r = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=h, timeout=15)
    assert r.status_code == 200


# ============ WATERFALL TEMPLATE (18 tasks) ============
def test_waterfall_template_has_18_tasks(h):
    r = requests.get(f"{BASE_URL}/api/project-templates", headers=h, timeout=15)
    assert r.status_code == 200
    tpls = r.json()
    wf = next((t for t in tpls if t.get("methodology") == "waterfall" and "waterfall" in t.get("name", "").lower()), None)
    assert wf, f"Waterfall template not found. Got: {[t.get('name') for t in tpls]}"
    phases = wf.get("phases", [])
    assert len(phases) == 6, f"Expected 6 phases, got {len(phases)}"
    total_tasks = sum(len(p.get("tasks", [])) for p in phases)
    assert total_tasks == 18, f"Expected 18 tasks, got {total_tasks}"
    total_ms = sum(len(p.get("milestones", [])) for p in phases) + len(wf.get("milestones", []))
    assert total_ms == 12, f"Expected 12 milestones, got {total_ms}"


# ============ CxO DASHBOARD ============
def test_cxo_dashboard(h):
    r = requests.get(f"{BASE_URL}/api/dashboard/cxo", headers=h, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("kpis", "rag", "budget", "milestones", "top_projects"):
        assert k in d, f"missing {k}"
    kpis = d["kpis"]
    for k in ("total_projects", "total_programs", "active_projects", "critical_risks", "total_risks"):
        assert k in kpis, f"missing kpi {k}"
    assert "on_time_rate" in d["milestones"]
    assert isinstance(d["top_projects"], list)
    assert len(d["top_projects"]) <= 5


def test_cxo_preferences_get_put(h):
    r = requests.get(f"{BASE_URL}/api/dashboard/cxo/preferences", headers=h, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "widgets" in body and "available" in body

    # PUT subset
    r2 = requests.put(f"{BASE_URL}/api/dashboard/cxo/preferences", headers=h,
                     json={"widgets": ["kpis", "budget"]}, timeout=15)
    assert r2.status_code == 200, r2.text
    r3 = requests.get(f"{BASE_URL}/api/dashboard/cxo/preferences", headers=h, timeout=15)
    assert r3.json()["widgets"] == ["kpis", "budget"]

    # restore defaults
    defaults = ["kpis", "rag", "budget", "milestones", "risks", "top_projects"]
    r4 = requests.put(f"{BASE_URL}/api/dashboard/cxo/preferences", headers=h,
                     json={"widgets": defaults}, timeout=15)
    assert r4.status_code == 200


# ============ MS PROJECT EXPORT/IMPORT ============
@pytest.fixture(scope="module")
def sample_project_id(h):
    # find any existing project
    r = requests.get(f"{BASE_URL}/api/projects", headers=h, timeout=15)
    assert r.status_code == 200
    projects = r.json()
    assert projects, "No projects available"
    return projects[0].get("project_id") or projects[0].get("id")


def test_msproject_export(h, sample_project_id):
    r = requests.get(f"{BASE_URL}/api/msproject/export/{sample_project_id}", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    ct = r.headers.get("content-type", "")
    assert "xml" in ct.lower(), f"content-type: {ct}"
    # Parse XML
    root = ET.fromstring(r.content)
    tag = root.tag
    assert "Project" in tag, f"root: {tag}"
    assert "microsoft.com/project" in tag, f"missing MSPDI namespace: {tag}"


def test_msproject_import_roundtrip(h):
    start = datetime.utcnow().date().isoformat()
    end = (datetime.utcnow() + timedelta(days=60)).date().isoformat()
    payload = {
        "name": "TEST_MSP_ROUNDTRIP",
        "methodology": "waterfall",
        "status_rag": "green",
        "jh_planned": 10,
        "start_date": start,
        "end_date_baseline": end,
        "end_date_forecast": end,
    }
    r = requests.post(f"{BASE_URL}/api/projects", headers=h, json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    tmp_id = r.json().get("project_id") or r.json().get("id")
    try:
        # First get an XML we can import - use a template application
        # Get any existing project export as source
        r_list = requests.get(f"{BASE_URL}/api/projects", headers=h, timeout=15)
        source_pid = None
        for p in r_list.json():
            pid = p.get("project_id") or p.get("id")
            if pid and pid != tmp_id:
                source_pid = pid
                break
        assert source_pid
        r_exp = requests.get(f"{BASE_URL}/api/msproject/export/{source_pid}", headers=h, timeout=30)
        assert r_exp.status_code == 200
        xml_content = r_exp.content

        files = {"file": ("import.xml", xml_content, "application/xml")}
        r_imp = requests.post(f"{BASE_URL}/api/msproject/import/{tmp_id}",
                              headers=h, files=files, timeout=60)
        assert r_imp.status_code == 200, r_imp.text
        data = r_imp.json()
        assert "tasks_created" in data
        assert data["tasks_created"] >= 0
        assert "milestones_created" in data

        # Verify tasks
        r_t = requests.get(f"{BASE_URL}/api/tasks", headers=h,
                           params={"project_id": tmp_id}, timeout=15)
        assert r_t.status_code == 200
    finally:
        requests.delete(f"{BASE_URL}/api/projects/{tmp_id}", headers=h, timeout=15)


# ============ EMAIL ALERTS CONFIG ============
def test_email_alerts_config_crud(h):
    payload = {"email_alerts": {"enabled": True, "recipients": ["pmo@test.fr"], "events": ["project.created"]}}
    r = requests.put(f"{BASE_URL}/api/admin/config/email-alerts", headers=h, json=payload, timeout=15)
    assert r.status_code == 200, r.text

    r2 = requests.get(f"{BASE_URL}/api/admin/config", headers=h, timeout=15)
    assert r2.status_code == 200
    cfg = r2.json()
    assert "email_alerts" in cfg, f"keys: {list(cfg.keys())}"
    ea = cfg["email_alerts"]
    assert ea.get("enabled") is True
    assert "pmo@test.fr" in (ea.get("recipients") or [])

    # cleanup: disable
    reset = {"email_alerts": {"enabled": False, "recipients": [], "events": []}}
    r3 = requests.put(f"{BASE_URL}/api/admin/config/email-alerts", headers=h, json=reset, timeout=15)
    assert r3.status_code == 200
