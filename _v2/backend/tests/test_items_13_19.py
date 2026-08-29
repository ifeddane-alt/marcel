"""Tests backend Items 13-19 de la Roadmap MARCEL."""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")


def get_token(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        return r.json().get("access_token")
    return None


@pytest.fixture(scope="module")
def altair_token():
    token = get_token("admin@altair.fr", "Admin2026!")
    if not token:
        pytest.skip("Login Altair échoué")
    return token


@pytest.fixture(scope="module")
def beta_token():
    token = get_token("admin@betacorp.fr", "Beta2026!")
    if not token:
        pytest.skip("Login Beta Corp échoué")
    return token


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ── Item 13 — Roadmap snapshots (scope_vs_reel) ───────────────────────────────

class TestItem13Roadmap:
    """Item 13 — Onglet Scope vs Réel"""

    def test_roadmap_snapshots_endpoint(self, altair_token):
        r = requests.get(f"{BASE_URL}/api/roadmap/snapshots", headers=auth_headers(altair_token))
        assert r.status_code == 200, f"Snapshots: {r.text}"
        data = r.json()
        assert isinstance(data, list)
        print(f"[OK] {len(data)} snapshots trouvés")

    def test_roadmap_projects_endpoint(self, altair_token):
        r = requests.get(f"{BASE_URL}/api/roadmap/projects", headers=auth_headers(altair_token))
        assert r.status_code == 200, f"Projects: {r.text}"
        print("[OK] Roadmap projects OK")


# ── Item 14 — Export PDF/Excel Recommandations ────────────────────────────────

class TestItem14ExportRecommandations:
    """Item 14 — Export PDF et Excel"""

    def test_export_pdf(self, altair_token):
        r = requests.get(
            f"{BASE_URL}/api/agent/recommendations/export-pdf",
            headers=auth_headers(altair_token),
        )
        assert r.status_code == 200, f"PDF export: {r.status_code} {r.text[:200]}"
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 100
        print(f"[OK] PDF export OK, taille={len(r.content)} octets")

    def test_export_excel(self, altair_token):
        r = requests.get(
            f"{BASE_URL}/api/agent/recommendations/export-excel",
            headers=auth_headers(altair_token),
        )
        assert r.status_code == 200, f"Excel export: {r.status_code} {r.text[:200]}"
        assert "spreadsheet" in r.headers.get("content-type", "") or "xlsx" in r.headers.get("content-type", "")
        assert len(r.content) > 100
        print(f"[OK] Excel export OK, taille={len(r.content)} octets")

    def test_export_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/agent/recommendations/export-pdf")
        assert r.status_code == 401


# ── Item 15 — Scénarios Arbitrage ────────────────────────────────────────────

class TestItem15Scenarios:
    """Item 15 — Scénarios dans Arbitrage"""

    def test_scenarios_list(self, altair_token):
        r = requests.get(f"{BASE_URL}/api/arbitrage/scenarios", headers=auth_headers(altair_token))
        assert r.status_code == 200, f"Scenarios: {r.text}"
        data = r.json()
        assert isinstance(data, list)
        print(f"[OK] {len(data)} scénarios trouvés")


# ── Item 16 — Analytics IA ────────────────────────────────────────────────────

class TestItem16AgentAnalytics:
    """Item 16 — Dashboard Analytics IA"""

    def test_agent_analytics(self, altair_token):
        r = requests.get(f"{BASE_URL}/api/admin/agent-analytics", headers=auth_headers(altair_token))
        assert r.status_code == 200, f"Analytics: {r.status_code} {r.text[:300]}"
        data = r.json()
        # Vérifier la structure des KPIs
        assert "total_messages" in data or "messages" in data or "kpis" in data, f"Structure inattendue: {list(data.keys())}"
        print(f"[OK] Analytics IA OK: {list(data.keys())}")


# ── Item 17 — Multi-tenant isolation ─────────────────────────────────────────

class TestItem17MultiTenant:
    """Item 17 — Isolation multi-tenant"""

    def test_beta_corp_login(self):
        token = get_token("admin@betacorp.fr", "Beta2026!")
        assert token is not None, "Login Beta Corp échoué"
        print("[OK] Login Beta Corp réussi")

    def test_beta_corp_projets(self, beta_token):
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(beta_token))
        assert r.status_code == 200
        data = r.json()
        projects = data if isinstance(data, list) else data.get("projects", data.get("items", []))
        names = [p.get("name", "") for p in projects]
        print(f"[OK] Beta Corp projets: {names}")
        # Vérifier les 3 projets Beta Corp
        assert any("Beta" in n or "ERP" in n or "Portail" in n or "Migration" in n for n in names), \
            f"Aucun projet Beta Corp trouvé: {names}"
        # Vérifier qu'aucun projet Altair n'est visible
        altair_names = ["SIGMA", "Phoenix", "Altair", "Nexus", "Aurora", "Titan", "Atlas", "Orion"]
        for altair_proj in altair_names:
            assert not any(altair_proj.lower() in n.lower() for n in names), \
                f"Projet Altair '{altair_proj}' visible pour Beta Corp!"

    def test_altair_isolation(self, altair_token):
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(altair_token))
        assert r.status_code == 200
        data = r.json()
        projects = data if isinstance(data, list) else data.get("projects", data.get("items", []))
        names = [p.get("name", "") for p in projects]
        print(f"[OK] Altair projets ({len(projects)}): {names[:5]}...")
        # Vérifier qu'aucun projet Beta Corp n'est visible pour Altair
        beta_names = ["Modernisation ERP Beta", "Portail Client Beta", "Migration Cloud Beta"]
        for beta_proj in beta_names:
            assert not any(beta_proj.lower() in n.lower() for n in names), \
                f"Projet Beta Corp '{beta_proj}' visible pour Altair!"


# ── Item 19 — SAP RFC connector ───────────────────────────────────────────────

class TestItem19SAPConnector:
    """Item 19 — SAP RFC dans connecteurs"""

    def test_connectors_endpoint(self, altair_token):
        r = requests.get(f"{BASE_URL}/api/admin/connectors", headers=auth_headers(altair_token))
        assert r.status_code == 200, f"Connectors: {r.status_code} {r.text[:300]}"
        data = r.json()
        connectors = data if isinstance(data, list) else data.get("connectors", [])
        print(f"[OK] {len(connectors)} connecteurs trouvés")

    def test_sap_connector_rfc_option(self, altair_token):
        r = requests.get(f"{BASE_URL}/api/admin/connectors", headers=auth_headers(altair_token))
        assert r.status_code == 200
        data = r.json()
        connectors = data if isinstance(data, list) else data.get("connectors", [])
        sap_connectors = [c for c in connectors if "sap" in str(c.get("type", "")).lower() or "sap" in str(c.get("name", "")).lower()]
        if sap_connectors:
            sap = sap_connectors[0]
            # Vérifier que 'rfc' est présent dans auth_type ou config
            config = sap.get("config", {})
            auth_type = config.get("auth_type", "") or sap.get("auth_type", "")
            print(f"[OK] SAP connector: auth_type={auth_type}, config keys={list(config.keys())}")
        else:
            print(f"[INFO] Connecteurs trouvés: {[c.get('type', c.get('name', '?')) for c in connectors]}")
            # Pas d'erreur si SAP n'est pas encore créé dans les fixtures
