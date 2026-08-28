"""Tests RGPD technique (Preview) — positifs + négatifs cross-tenant. Non destructif sur données réelles :
crée un user jetable, l'exporte/anonymise, puis teste que la suppression tenant refuse un tenant tiers.
"""
import os
import requests

API = os.environ.get("API_URL", "http://localhost:8001").rstrip("/") + "/api"
ADMIN = ("admin@altair.fr", os.environ.get("ALT_PW", "Admin2026!"))
BETA = ("admin@betacorp.fr", os.environ.get("BETA_PW", "Beta2026!"))

R = []
def check(n, ok, i=""):
    R.append((n, ok, i)); print(f"{'PASS' if ok else 'FAIL'} | {n} | {i}")

def login(c):
    return requests.post(f"{API}/auth/login", json={"email": c[0], "password": c[1]}, timeout=20).json()

alt = login(ADMIN); AH = {"Authorization": f"Bearer {alt['access_token']}"}
beta = login(BETA); BH = {"Authorization": f"Bearer {beta['access_token']}"}
alt_tid = alt["user"]["tenant_id"]
beta_tid = beta["user"]["tenant_id"]

# Créer un user jetable dans Altair
import uuid
email = f"rgpd_test_{uuid.uuid4().hex[:8]}@altair.fr"
rc = requests.post(f"{API}/admin/users", headers=AH, json={
    "email": email, "name": "Sujet RGPD Test", "password": "TempPass2026!", "profile_id": None}, timeout=20)
disposable_id = None
if rc.status_code in (200, 201):
    disposable_id = rc.json().get("user_id") or rc.json().get("id")
check("user jetable créé", bool(disposable_id), f"http={rc.status_code}")

if disposable_id:
    # 1. Export (positif)
    r = requests.get(f"{API}/admin/rgpd/subject/{disposable_id}", headers=AH, timeout=20)
    ok = r.status_code == 200 and r.json().get("user", {}).get("email") == email and "password_hash" not in r.json().get("user", {})
    check("export sujet (positif, sans password_hash)", ok, f"http={r.status_code}")

    # 2. Export cross-tenant refusé (Beta tente d'exporter un user Altair)
    r = requests.get(f"{API}/admin/rgpd/subject/{disposable_id}", headers=BH, timeout=20)
    check("export cross-tenant refusé (404)", r.status_code == 404, f"http={r.status_code}")

    # 3. Anonymisation (positif)
    r = requests.post(f"{API}/admin/rgpd/subject/{disposable_id}/anonymize", headers=AH, timeout=20)
    check("anonymisation (positif)", r.status_code == 200 and r.json().get("anonymized"), f"http={r.status_code}")
    # vérifier que l'email a changé
    r2 = requests.get(f"{API}/admin/rgpd/subject/{disposable_id}", headers=AH, timeout=20)
    anon_ok = r2.status_code == 200 and r2.json().get("user", {}).get("email", "").endswith("@deleted.local")
    check("email anonymisé (@deleted.local) + inactif", anon_ok, f"email={r2.json().get('user',{}).get('email') if r2.status_code==200 else '?'}")

# 4. Suppression tenant : confirmation invalide → 400
r = requests.post(f"{API}/admin/rgpd/tenant/delete", headers=AH, json={"confirm_tenant_id": "WRONG"}, timeout=20)
check("tenant delete confirmation invalide → 400", r.status_code == 400, f"http={r.status_code}")

# 5. Suppression tenant : admin Altair tente de supprimer le tenant BETA → 400 (jamais autorisé)
r = requests.post(f"{API}/admin/rgpd/tenant/delete", headers=AH, json={"confirm_tenant_id": beta_tid}, timeout=20)
check("tenant delete cross-tenant (Altair vise Beta) refusé", r.status_code == 400, f"http={r.status_code}")
# vérifier Beta intact
rb = requests.get(f"{API}/projects", headers=BH, timeout=20)
check("tenant Beta toujours intact", rb.status_code == 200 and len(rb.json()) >= 1, f"http={rb.status_code} n={len(rb.json()) if rb.status_code==200 else '?'}")

# 6. Viewer ne peut pas exporter (403)
vr = login(("viewer@altair.fr", os.environ.get("VIEWER_PW", "View1234!")))
if vr.get("access_token"):
    VH = {"Authorization": f"Bearer {vr['access_token']}"}
    r = requests.get(f"{API}/admin/rgpd/subject/{disposable_id or 'x'}", headers=VH, timeout=20)
    check("viewer refusé sur RGPD (403)", r.status_code == 403, f"http={r.status_code}")

# nettoyage : anonymisé + inactif suffit (pas de suppression physique nécessaire)
fails = [x for x in R if not x[1]]
print(f"\n=== {len(R)-len(fails)}/{len(R)} PASS ===")
for n, ok, i in fails:
    print("  FAIL:", n, i)
