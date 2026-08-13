"""
Iteration 66 — DSI modules (Applications, Run, Security, Architecture),
methodology-based indicators (EVM waterfall / velocity agile / SAFe),
Participatory Budgeting SAFe and team heatmap build+run integration.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@altair.fr", "Admin2026!")
PMO = ("pmo@altair.fr", "Pmo1234!")
VIEWER = ("viewer@altair.fr", "View1234!")
BETA = ("admin@betacorp.fr", "Beta2026!")

# From review request
WATERFALL_PROJECT_ID = "343282cb-ad52-4e20-8322-e104d6f67888"
SAFE_PROJECT_ID = "21fa6d43-0ce8-4ee7-8e06-114ef3199006"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def pmo_token():
    return _login(*PMO)


@pytest.fixture(scope="module")
def viewer_token():
    return _login(*VIEWER)


@pytest.fixture(scope="module")
def beta_token():
    return _login(*BETA)


# ─── Applications (APM) ───────────────────────────────────────────────────────

class TestApplications:
    _created_id = None

    def test_summary(self, admin_token):
        r = requests.get(f"{API}/applications/summary", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        for k in ("total", "tco_total", "by_time", "by_status", "by_criticality"):
            assert k in data
        assert data["total"] >= 1

    def test_list_and_seed(self, admin_token):
        r = requests.get(f"{API}/applications", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        apps = r.json()
        assert isinstance(apps, list)
        assert len(apps) >= 1

    def test_create_get_update_delete(self, admin_token):
        payload = {
            "name": f"TEST_APM_{uuid.uuid4().hex[:6]}",
            "code": "TAPM",
            "status": "production",
            "criticality": "haute",
            "time_rating": "invest",
            "tco_annual": 12345,
            "components": [
                {"name": "Java 8 legacy", "type": "runtime", "version": "1.8", "support_end": "2020-01-01"},
                {"name": "PG 15", "type": "database", "version": "15", "support_end": "2027-11-01"},
            ],
        }
        r = requests.post(f"{API}/applications", headers=_h(admin_token), json=payload, timeout=15)
        assert r.status_code == 201, r.text
        app = r.json()
        assert app["name"] == payload["name"]
        assert app["obsolete_count"] == 1
        assert app["components"][0]["obsolescence"] == "obsolete"
        aid = app["application_id"]
        TestApplications._created_id = aid

        # GET
        r = requests.get(f"{API}/applications/{aid}", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == payload["name"]

        # PUT
        r = requests.put(f"{API}/applications/{aid}", headers=_h(admin_token),
                         json={"criticality": "critique"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["criticality"] == "critique"

        # link projects
        r = requests.put(f"{API}/applications/{aid}/projects", headers=_h(admin_token),
                         json={"project_ids": [WATERFALL_PROJECT_ID]}, timeout=15)
        assert r.status_code == 200
        assert WATERFALL_PROJECT_ID in r.json()["project_ids"]

        # DELETE
        r = requests.delete(f"{API}/applications/{aid}", headers=_h(admin_token), timeout=15)
        assert r.status_code == 204

        # verify gone
        r = requests.get(f"{API}/applications/{aid}", headers=_h(admin_token), timeout=15)
        assert r.status_code == 404

    def test_viewer_forbidden(self, viewer_token):
        # viewer can list but not write
        r = requests.get(f"{API}/applications", headers=_h(viewer_token), timeout=15)
        assert r.status_code == 200
        r = requests.post(f"{API}/applications", headers=_h(viewer_token),
                          json={"name": "TEST_forbidden"}, timeout=15)
        assert r.status_code == 403

    def test_tenant_isolation(self, admin_token, beta_token):
        altair = requests.get(f"{API}/applications", headers=_h(admin_token), timeout=15).json()
        beta = requests.get(f"{API}/applications", headers=_h(beta_token), timeout=15).json()
        altair_ids = {a["application_id"] for a in altair}
        beta_ids = {a["application_id"] for a in beta}
        assert altair_ids.isdisjoint(beta_ids)


# ─── Run & Exploitation ───────────────────────────────────────────────────────

class TestRun:
    _act_id = None
    _inc_id = None
    _rel_id = None

    def test_summary(self, admin_token):
        r = requests.get(f"{API}/run/summary", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("activities_count", "budget_run_annual", "run_ratio_pct", "incidents_open", "upcoming_releases"):
            assert k in d

    def test_list_seed(self, admin_token):
        r = requests.get(f"{API}/run/activities", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200 and len(r.json()) >= 1

    def test_load_consolidated(self, admin_token):
        r = requests.get(f"{API}/run/load?months=12", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "resources" in d and "periods" in d
        # verify a period has run_jh reported
        has_run = any(p.get("run_jh", 0) > 0 for row in d["resources"] for p in row["periods"])
        assert has_run, "Expected at least one resource-month with run_jh > 0"

    def test_activity_crud_and_allocations(self, admin_token):
        r = requests.post(f"{API}/run/activities", headers=_h(admin_token),
                          json={"name": f"TEST_run_{uuid.uuid4().hex[:6]}", "type": "mco"}, timeout=15)
        assert r.status_code == 201
        aid = r.json()["activity_id"]
        TestRun._act_id = aid

        # need a resource
        resources = requests.get(f"{API}/resources", headers=_h(admin_token), timeout=15).json()
        assert resources, "No resources seeded"
        rid = resources[0]["resource_id"]

        # set allocations
        r = requests.put(f"{API}/run/activities/{aid}/allocations", headers=_h(admin_token),
                         json={"allocations": [
                             {"resource_id": rid, "month": "2026-07", "days_allocated": 5},
                             {"resource_id": rid, "month": "2026-08", "days_allocated": 3},
                         ]}, timeout=15)
        assert r.status_code == 200
        allocs = r.json()
        assert len(allocs) == 2
        assert sum(a["days_allocated"] for a in allocs) == 8

        # replace (must delete previous)
        r = requests.put(f"{API}/run/activities/{aid}/allocations", headers=_h(admin_token),
                         json={"allocations": [{"resource_id": rid, "month": "2026-09", "days_allocated": 2}]}, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) == 1

        # delete
        r = requests.delete(f"{API}/run/activities/{aid}", headers=_h(admin_token), timeout=15)
        assert r.status_code == 204

    def test_incident_sla_computed(self, admin_token):
        r = requests.post(f"{API}/run/incidents", headers=_h(admin_token),
                         json={"title": f"TEST_inc_{uuid.uuid4().hex[:6]}", "severity": "P2",
                               "sla_target_hours": 8, "opened_at": "2026-01-01T10:00:00Z"}, timeout=15)
        assert r.status_code == 201
        inc = r.json()
        assert inc["sla_met"] is None  # not resolved
        iid = inc["incident_id"]
        TestRun._inc_id = iid

        # resolve within SLA
        r = requests.put(f"{API}/run/incidents/{iid}", headers=_h(admin_token),
                         json={"status": "resolu", "resolved_at": "2026-01-01T13:00:00Z"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["sla_met"] is True

        # cleanup
        requests.delete(f"{API}/run/incidents/{iid}", headers=_h(admin_token), timeout=15)

    def test_release_crud(self, admin_token):
        r = requests.post(f"{API}/run/releases", headers=_h(admin_token),
                          json={"name": f"TEST_mep_{uuid.uuid4().hex[:6]}",
                                "date": "2026-12-01", "type": "mep"}, timeout=15)
        assert r.status_code == 201
        rid = r.json()["release_id"]
        r = requests.delete(f"{API}/run/releases/{rid}", headers=_h(admin_token), timeout=15)
        assert r.status_code == 204

    def test_viewer_run_forbidden(self, viewer_token):
        r = requests.post(f"{API}/run/activities", headers=_h(viewer_token),
                          json={"name": "TEST_forbidden"}, timeout=15)
        assert r.status_code == 403


# ─── Security ─────────────────────────────────────────────────────────────────

class TestSecurity:
    def test_summary(self, admin_token):
        r = requests.get(f"{API}/security/summary", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200

    def test_posture(self, admin_token):
        r = requests.get(f"{API}/security/posture", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        posture = r.json()
        assert isinstance(posture, list)
        if posture:
            first = posture[0]
            assert "score" in first
            assert 0 <= first["score"] <= 100

    def test_vuln_crud(self, admin_token):
        r = requests.post(f"{API}/security/vulnerabilities", headers=_h(admin_token),
                          json={"title": f"TEST_vuln_{uuid.uuid4().hex[:6]}", "severity": "high"}, timeout=15)
        assert r.status_code == 201, r.text
        vid = r.json().get("vuln_id") or r.json().get("vulnerability_id") or r.json().get("id")
        r = requests.delete(f"{API}/security/vulnerabilities/{vid}", headers=_h(admin_token), timeout=15)
        assert r.status_code == 204

    def test_requirement_and_review(self, admin_token):
        r = requests.post(f"{API}/security/requirements", headers=_h(admin_token),
                          json={"framework": "DORA", "title": f"TEST_req_{uuid.uuid4().hex[:6]}",
                                "status": "conforme"}, timeout=15)
        assert r.status_code == 201
        rid = r.json().get("requirement_id") or r.json().get("id")
        requests.delete(f"{API}/security/requirements/{rid}", headers=_h(admin_token), timeout=15)

        r = requests.post(f"{API}/security/reviews", headers=_h(admin_token),
                          json={"project_id": WATERFALL_PROJECT_ID, "status": "en_cours"}, timeout=15)
        assert r.status_code == 201
        rvid = r.json().get("review_id") or r.json().get("id")
        requests.delete(f"{API}/security/reviews/{rvid}", headers=_h(admin_token), timeout=15)

    def test_viewer_forbidden(self, viewer_token):
        r = requests.post(f"{API}/security/vulnerabilities", headers=_h(viewer_token),
                          json={"title": "TEST_forbidden"}, timeout=15)
        assert r.status_code == 403


# ─── Architecture ─────────────────────────────────────────────────────────────

class TestArchitecture:
    def test_summary(self, admin_token):
        r = requests.get(f"{API}/architecture/summary", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200

    @pytest.mark.parametrize("resource", ["interfaces", "standards", "exemptions", "reviews", "radar", "debt"])
    def test_list(self, admin_token, resource):
        r = requests.get(f"{API}/architecture/{resource}", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_interface_crud(self, admin_token):
        r = requests.post(f"{API}/architecture/interfaces", headers=_h(admin_token),
                          json={"name": f"TEST_iface_{uuid.uuid4().hex[:6]}", "protocol": "REST"}, timeout=15)
        assert r.status_code == 201, r.text
        j = r.json()
        iid = j.get("interface_id") or j.get("id")
        assert iid
        r = requests.delete(f"{API}/architecture/interfaces/{iid}", headers=_h(admin_token), timeout=15)
        assert r.status_code == 204

    def test_standard_and_exemption(self, admin_token):
        r = requests.post(f"{API}/architecture/standards", headers=_h(admin_token),
                          json={"title": f"TEST_std_{uuid.uuid4().hex[:6]}", "status": "actif"}, timeout=15)
        assert r.status_code == 201
        sid = r.json().get("standard_id") or r.json().get("id")

        r = requests.post(f"{API}/architecture/exemptions", headers=_h(admin_token),
                          json={"standard_id": sid, "scope_label": "TEST", "justification": "test", "status": "en_cours"}, timeout=15)
        assert r.status_code == 201
        eid = r.json().get("exemption_id") or r.json().get("id")
        requests.delete(f"{API}/architecture/exemptions/{eid}", headers=_h(admin_token), timeout=15)
        requests.delete(f"{API}/architecture/standards/{sid}", headers=_h(admin_token), timeout=15)


# ─── Indicators ───────────────────────────────────────────────────────────────

class TestIndicators:
    def test_portfolio(self, admin_token):
        r = requests.get(f"{API}/indicators/portfolio", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        # each row must have methodology and coherent indicators
        found_wf = found_ag = False
        for row in rows:
            assert "methodology" in row
            m = row["methodology"]
            if m in ("waterfall", "hybrid"):
                assert "cpi" in row and "spi" in row
                found_wf = True
            if m in ("agile", "safe", "hybrid"):
                assert "velocity_avg" in row and "wip" in row
                found_ag = True
        assert found_wf, "No waterfall project in portfolio"
        assert found_ag, "No agile/safe project in portfolio"

    def test_waterfall_project_evm(self, admin_token):
        r = requests.get(f"{API}/projects/{WATERFALL_PROJECT_ID}/indicators",
                         headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["methodology"] == "waterfall"
        assert "common" in d and "evm" in d
        assert "cpi" in d["evm"] and "spi" in d["evm"]

    def test_safe_project_indicators(self, admin_token):
        r = requests.get(f"{API}/projects/{SAFE_PROJECT_ID}/indicators",
                         headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["methodology"] == "safe"
        assert "agile" in d and "safe" in d
        assert "velocity_avg" in d["agile"]
        assert "predictability_pct" in d["safe"]

    def test_sprint_crud(self, admin_token):
        r = requests.post(f"{API}/projects/{SAFE_PROJECT_ID}/sprints", headers=_h(admin_token),
                         json={"name": f"TEST_sprint_{uuid.uuid4().hex[:6]}",
                               "start_date": "2026-11-01", "end_date": "2026-11-15",
                               "committed_points": 30, "completed_points": 25, "status": "termine"}, timeout=15)
        assert r.status_code == 201, r.text
        sid = r.json()["sprint_id"]
        r = requests.delete(f"{API}/indicators/sprints/{sid}", headers=_h(admin_token), timeout=15)
        assert r.status_code == 204


# ─── Participatory Budgeting ──────────────────────────────────────────────────

class TestPB:
    def test_list_sessions(self, admin_token):
        r = requests.get(f"{API}/pb/sessions", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        sessions = r.json()
        assert any("PB PI-4 2026" in (s.get("name") or "") for s in sessions), "seeded PB session missing"

    def test_create_validation(self, admin_token):
        # missing candidates
        r = requests.post(f"{API}/pb/sessions", headers=_h(admin_token),
                         json={"name": "TEST_bad", "envelope": 1000, "items": [{"label": "only one", "cost": 500}]}, timeout=15)
        assert r.status_code == 400

        # envelope 0
        r = requests.post(f"{API}/pb/sessions", headers=_h(admin_token),
                         json={"name": "TEST_bad", "envelope": 0,
                               "items": [{"label": "a", "cost": 1}, {"label": "b", "cost": 1}]}, timeout=15)
        assert r.status_code == 400

    def test_vote_flow_and_close(self, admin_token, pmo_token, viewer_token):
        # find existing session
        sessions = requests.get(f"{API}/pb/sessions", headers=_h(admin_token), timeout=15).json()
        target = next((s for s in sessions if "PB PI-4 2026" in (s.get("name") or "")), None)
        assert target
        sid = target["session_id"]
        envelope = target["envelope"]
        items = target["items"]
        assert len(items) >= 2

        # ensure open
        requests.put(f"{API}/pb/sessions/{sid}", headers=_h(admin_token),
                     json={"status": "open"}, timeout=15)

        # vote (viewer allowed to vote — reading + voting isn't restricted to write role since submit_vote doesn't call require_dsi_write)
        allocs = {items[0]["item_id"]: envelope / 2, items[1]["item_id"]: envelope / 2}
        r = requests.post(f"{API}/pb/sessions/{sid}/vote", headers=_h(pmo_token),
                         json={"allocations": allocs}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["submitted"] is True

        # over-envelope
        bad = {items[0]["item_id"]: envelope * 2}
        r = requests.post(f"{API}/pb/sessions/{sid}/vote", headers=_h(pmo_token),
                         json={"allocations": bad}, timeout=15)
        assert r.status_code == 400

        # results
        r = requests.get(f"{API}/pb/sessions/{sid}/results", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        res = r.json()
        assert res["participation"] >= 1
        assert isinstance(res["items"], list)

        # close
        r = requests.put(f"{API}/pb/sessions/{sid}", headers=_h(admin_token),
                        json={"status": "closed"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "closed"

        # vote refused after close
        r = requests.post(f"{API}/pb/sessions/{sid}/vote", headers=_h(pmo_token),
                         json={"allocations": allocs}, timeout=15)
        assert r.status_code == 400

        # decide
        r = requests.put(f"{API}/pb/sessions/{sid}", headers=_h(admin_token),
                        json={"status": "decided"}, timeout=15)
        assert r.status_code == 200

        # restore open state to leave seed usable
        requests.put(f"{API}/pb/sessions/{sid}", headers=_h(admin_token),
                     json={"status": "open"}, timeout=15)


# ─── Heatmap build+run ────────────────────────────────────────────────────────

class TestHeatmap:
    def test_heatmap_has_run_jh(self, admin_token):
        r = requests.get(f"{API}/teams/capacity-heatmap?months=12", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200
        data = r.json()
        rows = data if isinstance(data, list) else data.get("teams") or data.get("rows") or []
        assert rows, "empty heatmap"
        # verify run_jh exists on at least one 2026-06..2026-09 period
        run_found = False
        for row in rows:
            for p in row.get("periods", []):
                if p.get("period") in ("2026-06", "2026-07", "2026-08", "2026-09") and (p.get("run_jh") or 0) > 0:
                    run_found = True
                    # check that allocated_jh = build_jh + run_jh
                    total = round((p.get("build_jh") or 0) + (p.get("run_jh") or 0), 1)
                    assert abs(total - (p.get("allocated_jh") or 0)) < 0.5
        assert run_found, "Expected run_jh > 0 in heatmap for 2026-06..2026-09"
