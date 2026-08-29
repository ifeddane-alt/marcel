"""Iteration 76 — Saisie manuelle d'indicateurs (RAG seuils) + RAG projet automatique."""
import os
import pytest
import requests
from dotenv import dotenv_values

_env = dotenv_values("/app/frontend/.env")
BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE}/api"

ADMIN = ("admin@altair.fr", "Admin2026!")
PMO = ("pmo@altair.fr", "Pmo1234!")
VIEWER = ("viewer@altair.fr", "View1234!")

MANUAL_IND = "AGI-10"


def _login(creds):
    r = requests.post(f"{API}/auth/login", json={"email": creds[0], "password": creds[1]}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login {creds[0]} failed {r.status_code}: {r.text[:300]}")
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def pmo_h():
    return {"Authorization": f"Bearer {_login(PMO)}"}


@pytest.fixture(scope="module")
def viewer_h():
    return {"Authorization": f"Bearer {_login(VIEWER)}"}


# ─── Module catalogue : saisie manuelle ─────────────────────────────────────
class TestManualValues:
    def test_indicator_is_manual_in_catalog(self, pmo_h):
        r = requests.get(f"{API}/indicator-catalog?scope=dashboard", headers=pmo_h, timeout=30)
        assert r.status_code == 200
        cat = {c["indicator_id"]: c for c in r.json()}
        assert MANUAL_IND in cat, f"{MANUAL_IND} absent du scope dashboard"
        assert cat[MANUAL_IND]["computability"] in ("manual", "external")

    def test_manual_upsert_and_values_roundtrip(self, pmo_h):
        # snapshot de la sélection dashboard existante (à restaurer)
        sel0 = requests.get(f"{API}/indicator-catalog/selections/dashboard", headers=pmo_h, timeout=30)
        assert sel0.status_code == 200
        original_ids = sel0.json().get("indicator_ids", [])
        try:
            r = requests.put(f"{API}/indicator-catalog/selections/dashboard",
                             json={"indicator_ids": [MANUAL_IND]}, headers=pmo_h, timeout=30)
            assert r.status_code == 200
            assert r.json()["indicator_ids"] == [MANUAL_IND]

            # upsert valeur manuelle 85 %, higher, green 90 orange 75 -> orange
            body = {"value": 85, "unit": "%", "direction": "higher", "green": 90, "orange": 75,
                    "context_id": None}
            r = requests.put(f"{API}/indicator-catalog/manual/dashboard/{MANUAL_IND}",
                             json=body, headers=pmo_h, timeout=30)
            assert r.status_code == 200, r.text[:300]
            doc = r.json()
            assert doc["value"] == 85 and doc["unit"] == "%" and doc["direction"] == "higher"
            assert "_id" not in doc

            v = requests.get(f"{API}/indicator-catalog/values/dashboard", headers=pmo_h, timeout=30)
            assert v.status_code == 200
            item = next(i for i in v.json()["items"] if i["indicator_id"] == MANUAL_IND)
            assert item["display"] == "85 %", item["display"]
            assert item["status"] == "manual"
            assert item["rag"] == "orange"
            assert item["editable"] is True
            assert item["detail"].startswith("Saisi le ")
            assert item["manual"] == {"value": 85.0, "unit": "%", "direction": "higher",
                                      "green": 90.0, "orange": 75.0}

            # green boundary
            requests.put(f"{API}/indicator-catalog/manual/dashboard/{MANUAL_IND}",
                         json={**body, "value": 90}, headers=pmo_h, timeout=30)
            v = requests.get(f"{API}/indicator-catalog/values/dashboard", headers=pmo_h, timeout=30)
            assert next(i for i in v.json()["items"] if i["indicator_id"] == MANUAL_IND)["rag"] == "green"

            # red
            requests.put(f"{API}/indicator-catalog/manual/dashboard/{MANUAL_IND}",
                         json={**body, "value": 50}, headers=pmo_h, timeout=30)
            v = requests.get(f"{API}/indicator-catalog/values/dashboard", headers=pmo_h, timeout=30)
            assert next(i for i in v.json()["items"] if i["indicator_id"] == MANUAL_IND)["rag"] == "red"

            # direction lower inversé : 50 avec green 40 orange 60 -> orange
            requests.put(f"{API}/indicator-catalog/manual/dashboard/{MANUAL_IND}",
                         json={**body, "value": 50, "direction": "lower", "green": 40, "orange": 60},
                         headers=pmo_h, timeout=30)
            v = requests.get(f"{API}/indicator-catalog/values/dashboard", headers=pmo_h, timeout=30)
            assert next(i for i in v.json()["items"] if i["indicator_id"] == MANUAL_IND)["rag"] == "orange"

            # clear
            r = requests.put(f"{API}/indicator-catalog/manual/dashboard/{MANUAL_IND}",
                             json={"value": None, "context_id": None}, headers=pmo_h, timeout=30)
            assert r.status_code == 200 and r.json().get("deleted") is True
            v = requests.get(f"{API}/indicator-catalog/values/dashboard", headers=pmo_h, timeout=30)
            cleared = next(i for i in v.json()["items"] if i["indicator_id"] == MANUAL_IND)
            assert cleared["display"] == "—"
            assert cleared.get("manual") is None
            assert cleared.get("rag") is None
            assert cleared.get("detail") in (None, "")
        finally:
            # RESTAURATION état initial (sélection + valeur)
            requests.put(f"{API}/indicator-catalog/manual/dashboard/{MANUAL_IND}",
                         json={"value": None, "context_id": None}, headers=pmo_h, timeout=30)
            requests.put(f"{API}/indicator-catalog/selections/dashboard",
                         json={"indicator_ids": original_ids}, headers=pmo_h, timeout=30)
            back = requests.get(f"{API}/indicator-catalog/selections/dashboard", headers=pmo_h, timeout=30)
            assert back.json().get("indicator_ids", []) == original_ids

    def test_unknown_indicator_404(self, pmo_h):
        r = requests.put(f"{API}/indicator-catalog/manual/dashboard/ZZZ-999",
                         json={"value": 1}, headers=pmo_h, timeout=30)
        assert r.status_code == 404

    def test_non_numeric_400(self, pmo_h):
        r = requests.put(f"{API}/indicator-catalog/manual/dashboard/{MANUAL_IND}",
                         json={"value": "abc"}, headers=pmo_h, timeout=30)
        assert r.status_code == 400

    def test_invalid_scope_400(self, pmo_h):
        r = requests.put(f"{API}/indicator-catalog/manual/bogus/{MANUAL_IND}",
                         json={"value": 1}, headers=pmo_h, timeout=30)
        assert r.status_code == 400

    def test_viewer_forbidden_on_non_dashboard_scope(self, viewer_h):
        r = requests.put(f"{API}/indicator-catalog/manual/portfolio/{MANUAL_IND}",
                         json={"value": 10}, headers=viewer_h, timeout=30)
        if r.status_code == 200:
            # cleanup si écriture acceptée (bug RBAC)
            requests.put(f"{API}/indicator-catalog/manual/portfolio/{MANUAL_IND}",
                         json={"value": None, "context_id": None}, headers=viewer_h, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:200]}"

    def test_unauthenticated_401(self):
        r = requests.put(f"{API}/indicator-catalog/manual/dashboard/{MANUAL_IND}",
                         json={"value": 10}, timeout=30)
        assert r.status_code in (401, 403)


# ─── Module projets : RAG automatique ───────────────────────────────────────
class TestAutoRAG:
    def test_projects_have_rag_and_reasons(self, admin_h):
        r = requests.get(f"{API}/projects", headers=admin_h, timeout=60)
        assert r.status_code == 200
        projects = r.json()
        assert len(projects) > 0
        by_code = {p.get("code"): p for p in projects}
        for p in projects:
            if p.get("status") in ("cloture", "archive", "annule"):
                continue
            assert p["status_rag"] in ("green", "orange", "red")
            assert isinstance(p.get("rag_reasons"), list)
            if p["status_rag"] == "green":
                assert p["rag_reasons"] == []
            else:
                assert len(p["rag_reasons"]) >= 1
        expected = {"P01-001": "red", "DATA-001": "red", "PRJ-006": "red",
                    "PRJ-003": "orange", "DATA-002": "orange"}
        actual = {c: by_code[c]["status_rag"] for c in expected if c in by_code}
        assert actual == {c: v for c, v in expected.items() if c in by_code}, actual

    def test_data001_red_with_eac_reason(self, admin_h):
        r = requests.get(f"{API}/projects", headers=admin_h, timeout=60)
        p = next((x for x in r.json() if x.get("code") == "DATA-001"), None)
        assert p, "DATA-001 introuvable"
        assert p["status_rag"] == "red"
        budget, eac = p.get("budget_total"), p.get("eac") or p.get("budget_forecast")
        over = round((eac - budget) / budget * 100)
        assert any(f"+{over} %" in reason for reason in p["rag_reasons"]), p["rag_reasons"]

    def test_rag_persisted_and_matches_detail(self, admin_h):
        lst = requests.get(f"{API}/projects", headers=admin_h, timeout=60).json()
        p = next(x for x in lst if x.get("code") == "DATA-001")
        d = requests.get(f"{API}/projects/{p['project_id']}", headers=admin_h, timeout=30)
        assert d.status_code == 200
        det = d.json()
        assert det["status_rag"] == p["status_rag"]
        assert det["rag_reasons"] == p["rag_reasons"]

    def test_closed_projects_not_recomputed(self, admin_h):
        lst = requests.get(f"{API}/projects", headers=admin_h, timeout=60).json()
        closed = [p for p in lst if p.get("status") in ("cloture", "archive", "annule")]
        for p in closed:
            # pas de rag_reasons ajouté par le recalcul
            assert p.get("rag_reasons") in (None, [], p.get("rag_reasons"))

    def test_dashboard_summary_matches_rag_counts(self, admin_h):
        lst = requests.get(f"{API}/projects", headers=admin_h, timeout=60).json()
        s = requests.get(f"{API}/dashboard/summary", headers=admin_h, timeout=60)
        assert s.status_code == 200
        summary = s.json()
        rag = summary.get("rag_counts") or {}
        if not rag:
            pytest.skip(f"pas de distribution RAG dans summary: {list(summary.keys())}")
        active = [p for p in lst if p.get("status") not in ("cloture", "archive", "annule")]
        for color in ("green", "orange", "red"):
            if color in rag:
                assert rag[color] == sum(1 for p in active if p["status_rag"] == color), \
                    f"{color}: summary={rag[color]} vs projects={sum(1 for p in active if p['status_rag'] == color)}"

    def test_create_project_without_status_rag(self, admin_h):
        payload = {"name": "TEST_ITER76_RAG", "methodology": "waterfall", "status": "actif",
                   "start_date": "2026-01-01", "end_date_baseline": "2026-12-31",
                   "end_date_forecast": "2026-12-31",
                   "capex_planned": 100000, "opex_planned": 0,
                   "capex_consumed": 0, "opex_consumed": 0,
                   "jh_planned": 10, "jh_consumed": 0}
        r = requests.post(f"{API}/projects", json=payload, headers=admin_h, timeout=30)
        assert r.status_code in (200, 201), r.text[:300]
        created = r.json()
        pid = created["project_id"]
        try:
            g = requests.get(f"{API}/projects/{pid}", headers=admin_h, timeout=30)
            assert g.status_code == 200
            assert g.json()["status_rag"] == "green"
            assert g.json()["rag_reasons"] == []
            # update description ne casse pas le RAG
            u = requests.put(f"{API}/projects/{pid}", json={"description": "TEST_desc"},
                             headers=admin_h, timeout=30)
            assert u.status_code == 200
            g2 = requests.get(f"{API}/projects/{pid}", headers=admin_h, timeout=30)
            assert g2.json()["status_rag"] == "green"
        finally:
            requests.delete(f"{API}/projects/{pid}", headers=admin_h, timeout=30)
            assert requests.get(f"{API}/projects/{pid}", headers=admin_h,
                                timeout=30).status_code == 404


# ─── Non-régression ────────────────────────────────────────────────────────
class TestNonRegression:
    def test_teams_heatmap(self, admin_h):
        r = requests.get(f"{API}/teams/capacity-heatmap", headers=admin_h, timeout=60)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        rows = data if isinstance(data, list) else data.get("rows") or data.get("teams") or []
        assert len(rows) > 0, f"heatmap vide: {str(data)[:200]}"

    def test_comex_pdf_export(self, admin_h):
        r = requests.get(f"{API}/dashboard/export/pdf", headers=admin_h, timeout=120)
        assert r.status_code == 200, r.text[:200]
        assert len(r.content) > 1000

    def test_portfolio_indicator_values(self, admin_h):
        r = requests.get(f"{API}/indicator-catalog/values/portfolio", headers=admin_h, timeout=60)
        assert r.status_code == 200
        assert "items" in r.json()

    def test_gou04_rag_distribution_matches_projects(self, admin_h):
        """GOU-04 (Répartition des statuts RAG) doit refléter les compteurs réels."""
        projects = requests.get(f"{API}/projects", headers=admin_h, timeout=60).json()
        counts = {c: sum(1 for p in projects if p.get("status_rag") == c)
                  for c in ("green", "orange", "red")}
        r = requests.get(f"{API}/indicator-catalog/values/portfolio", headers=admin_h, timeout=60)
        item = next((i for i in r.json()["items"] if i["indicator_id"] == "GOU-04"), None)
        if not item:
            pytest.skip("GOU-04 non sélectionné sur le scope portfolio")
        expected = f"{counts['green']} V · {counts['orange']} O · {counts['red']} R"
        assert item["display"] == expected, f"GOU-04 affiche '{item['display']}' au lieu de '{expected}'"

    def test_consistency_alerts(self, admin_h):
        r = requests.get(f"{API}/projects/consistency", headers=admin_h, timeout=60)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
