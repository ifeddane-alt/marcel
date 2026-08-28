"""Campagne RBAC + object-scope + révocation + cross-tenant — auto-nettoyante.
Usage : python scripts/test_rbac.py  (préview)
"""
import requests, sys, json, uuid

API = open("/tmp/api.txt").read().strip() + "/api" if __import__("os").path.exists("/tmp/api.txt") else None
if not API:
    import subprocess
    url = subprocess.check_output("grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2", shell=True).decode().strip()
    API = url + "/api"

results = []
def check(name, cond, info=""):
    results.append((name, cond)); print(("PASS" if cond else "FAIL"), name, info)

def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    return r.json().get("access_token")

def H(tok): return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}

ADMIN = login("admin@altair.fr", "Admin2026!")
assert ADMIN, "login admin échoué"

# Profils disponibles → profile_id par code
profiles = requests.get(f"{API}/profiles", headers=H(ADMIN)).json()
pid = {p["code"]: p["profile_id"] for p in (profiles if isinstance(profiles, list) else profiles.get("profiles", []))}
check("profils chargés", {"CIO", "PORTFOLIO", "CHEF_DE_PROJET"} <= set(pid), list(pid)[:8])

SUFFIX = uuid.uuid4().hex[:6]
created_users, created_projects = [], []

def mkuser(email, profile_code, role="READ_ONLY"):
    r = requests.post(f"{API}/admin/users", headers=H(ADMIN), json={
        "email": email, "name": email.split("@")[0], "password": "TestPass2026!",
        "role": role, "profile_id": pid[profile_code]})
    assert r.status_code == 201, f"create {email}: {r.status_code} {r.text[:120]}"
    created_users.append(r.json()["user_id"])
    return login(email, "TestPass2026!")

VIEWER = mkuser(f"rbac_viewer_{SUFFIX}@altair.fr", "CIO")
PMO    = mkuser(f"rbac_pmo_{SUFFIX}@altair.fr", "PORTFOLIO", "PMO_USER")
CP     = mkuser(f"rbac_cp_{SUFFIX}@altair.fr", "CHEF_DE_PROJET", "PMO_USER")
CP_UID = created_users[-1]

def mkproject(name, owner_id=None, tok=ADMIN):
    body = {"name": name, "methodology": "waterfall", "status": "actif",
            "start_date": "2026-01-01", "end_date_baseline": "2026-12-31", "end_date_forecast": "2026-12-31"}
    if owner_id: body["owner_id"] = owner_id
    r = requests.post(f"{API}/projects", headers=H(tok), json=body)
    assert r.status_code == 201, f"create proj: {r.status_code} {r.text[:150]}"
    created_projects.append(r.json()["project_id"])
    return r.json()["project_id"]

PROJ_CP = mkproject(f"ZZ-RBAC-CP-{SUFFIX}", owner_id=CP_UID)
PROJ_OTHER = mkproject(f"ZZ-RBAC-OTHER-{SUFFIX}")

# ── 1. VIEWER strictement read-only ──────────────────────────────────────────
r = requests.get(f"{API}/projects", headers=H(VIEWER)); check("viewer lecture projets 200", r.status_code == 200)
r = requests.put(f"{API}/projects/{PROJ_OTHER}", headers=H(VIEWER), json={"name": "HACK"})
check("viewer update projet → 403", r.status_code == 403, r.status_code)
r = requests.post(f"{API}/tasks", headers=H(VIEWER), json={"project_id": PROJ_OTHER, "name": "x", "type": "dev", "status": "todo", "jh_planned": 1})
check("viewer create task → 403", r.status_code == 403, r.status_code)
# viewer strictement read-only : pas de timesheet.self.write ni leave.self.write dans ses perms
vperms = requests.post(f"{API}/auth/login", json={"email": f"rbac_viewer_{SUFFIX}@altair.fr", "password": "TestPass2026!"}).json().get("permissions", [])
check("viewer sans timesheets.submit/leaves.submit", "timesheets.submit" not in vperms and "leaves.submit" not in vperms, vperms)

# ── 2. PMO/PORTFOLIO peut écrire (tout le tenant) ────────────────────────────
r = requests.put(f"{API}/projects/{PROJ_OTHER}", headers=H(PMO), json={"name": f"ZZ-RBAC-OTHER-{SUFFIX}-edit"})
check("PMO update n'importe quel projet → 200", r.status_code == 200, r.status_code)
r = requests.post(f"{API}/programs", headers=H(PMO), json={"name": f"ZZ-prog-{SUFFIX}", "status": "active"})
check("PMO create program → 200/201", r.status_code in (200, 201), r.status_code)
if r.status_code in (200, 201): created_prog = r.json().get("program_id")
else: created_prog = None

# ── 3. CHEF_DE_PROJET : object-scope (own vs autre) ──────────────────────────
r = requests.put(f"{API}/projects/{PROJ_CP}", headers=H(CP), json={"name": f"ZZ-RBAC-CP-{SUFFIX}-edit"})
check("CP update SON projet → 200", r.status_code == 200, f"{r.status_code} {r.text[:100]}")
r = requests.put(f"{API}/projects/{PROJ_OTHER}", headers=H(CP), json={"name": "HACK"})
check("CP update projet d'un AUTRE → 403", r.status_code == 403, r.status_code)
r = requests.post(f"{API}/tasks", headers=H(CP), json={"project_id": PROJ_CP, "name": "t", "type": "dev", "status": "todo", "jh_planned": 5})
check("CP create task sur SON projet → 201", r.status_code == 201, r.status_code)
cp_task = r.json().get("task_id") if r.status_code == 201 else None
r = requests.post(f"{API}/tasks", headers=H(CP), json={"project_id": PROJ_OTHER, "name": "t", "type": "dev", "status": "todo", "jh_planned": 5})
check("CP create task sur projet AUTRE → 403", r.status_code == 403, r.status_code)
# CP ne peut PAS supprimer un projet (pas de projects.delete)
r = requests.delete(f"{API}/projects/{PROJ_CP}", headers=H(CP))
check("CP delete projet → 403 (delete≠update)", r.status_code == 403, r.status_code)

# ── 4. Révocation : admin change le profil du CP → CIO, ancien token rejeté ──
requests.patch(f"{API}/admin/users/{CP_UID}", headers=H(ADMIN), json={"profile_id": pid["CIO"]})
r = requests.put(f"{API}/projects/{PROJ_CP}", headers=H(CP), json={"name": "should-fail"})
check("ancien token CP après changement de profil → 401", r.status_code == 401, r.status_code)

# ── 5. Cross-tenant (betacorp) ───────────────────────────────────────────────
BETA = login("admin@betacorp.fr", "Beta2026!")
if BETA:
    for path, method in [(f"/projects/{PROJ_OTHER}", "GET"), (f"/projects/{PROJ_OTHER}", "PUT"),
                         (f"/tasks?project_id={PROJ_OTHER}", "GET")]:
        m = getattr(requests, method.lower())
        kw = {"headers": H(BETA)}
        if method == "PUT": kw["json"] = {"name": "X"}
        r = m(f"{API}{path}", **kw)
        leaked = (r.status_code == 200 and PROJ_OTHER in r.text and "introuvable" not in r.text and method != "GET")
        ok = r.status_code in (403, 404) or (method == "GET" and (r.status_code == 404 or (isinstance(r.json(), list))))
        # GET tasks by other-tenant project must be empty or 404
        if path.startswith("/tasks") and r.status_code == 200:
            ok = isinstance(r.json(), dict) and "introuvable" in json.dumps(r.json())
        check(f"cross-tenant {method} {path[:30]} → refus/vide", ok, r.status_code)
else:
    check("betacorp login (skip si absent)", True, "betacorp non seedé")

# ── Cleanup ──────────────────────────────────────────────────────────────────
for p in created_projects: requests.delete(f"{API}/projects/{p}", headers=H(ADMIN))
if created_prog: requests.delete(f"{API}/programs/{created_prog}", headers=H(ADMIN))
for uid in created_users:
    requests.patch(f"{API}/admin/users/{uid}", headers=H(ADMIN), json={"is_active": False})
    try: requests.delete(f"{API}/admin/users/{uid}", headers=H(ADMIN))
    except Exception: pass
print("cleanup done (users désactivés, projets/prog supprimés)")

fails = [x for x in results if not x[1]]
print(f"\n{len(results)-len(fails)}/{len(results)} PASS")
sys.exit(1 if fails else 0)
