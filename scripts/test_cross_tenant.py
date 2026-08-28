"""Campagne cross-tenant EXHAUSTIVE (Preview). Beta Corp tente d'accéder aux objets Altair par ID direct.
Non destructif : DELETE cross-tenant testé, puis l'objet Altair est revérifié présent.
"""
import os
import requests

API = os.environ["API_URL"].rstrip("/") + "/api"
ALT = ("admin@altair.fr", os.environ["ALT_PW"])
BETA = ("admin@betacorp.fr", os.environ["BETA_PW"])
ALT_TID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

R = []
def check(name, ok, info=""):
    R.append((name, ok, info)); print(f"{'PASS' if ok else 'FAIL'} | {name} | {info}")

def login(c):
    r = requests.post(f"{API}/auth/login", json={"email": c[0], "password": c[1]}, timeout=20)
    r.raise_for_status(); return r.json()["access_token"]

AT = login(ALT); BT = login(BETA)
AH = {"Authorization": f"Bearer {AT}"}
BH = {"Authorization": f"Bearer {BT}"}

def one_id(path, key):
    r = requests.get(f"{API}{path}", headers=AH, timeout=20)
    if r.status_code != 200: return None
    data = r.json()
    items = data if isinstance(data, list) else (data.get("items") or data.get("results") or [])
    if not items: return None
    return items[0].get(key) or items[0].get("id")

# (list_path, id_key, detail_template) — detail supports {id}
SURFACES = [
    ("/projects", "project_id", "/projects/{id}"),
    ("/programs", "program_id", "/programs/{id}"),
    ("/risks", "risk_id", "/risks/{id}"),
    ("/decisions", "decision_id", "/decisions/{id}"),
    ("/milestones", "milestone_id", "/milestones/{id}"),
    ("/resources", "resource_id", "/resources/{id}"),
    ("/teams", "team_id", "/teams/{id}"),
    ("/applications", "application_id", "/applications/{id}"),
    ("/objectives", "objective_id", "/objectives/{id}"),
    ("/demands", "demand_id", "/demands/{id}"),
    ("/governance", "governance_id", "/governance/{id}"),
    ("/tasks", "task_id", "/tasks/{id}"),
]

def ok_read_denied(sc):
    return sc in (403, 404)

for list_path, key, detail in SURFACES:
    # tasks list may need a project scope; skip list if empty
    aid = one_id(list_path, key)
    if not aid:
        # tasks: fetch via a project
        if list_path == "/tasks":
            pid = one_id("/projects", "project_id")
            if pid:
                r = requests.get(f"{API}/projects/{pid}/tasks", headers=AH, timeout=20)
                if r.status_code == 200 and r.json():
                    aid = (r.json()[0].get("task_id") or r.json()[0].get("id"))
        if not aid:
            check(f"{list_path} — id Altair introuvable (skip)", True, "aucune donnée")
            continue

    # 1. Beta ne voit pas l'objet Altair dans SA liste
    rb = requests.get(f"{API}{list_path}", headers=BH, timeout=20)
    if rb.status_code == 200 and isinstance(rb.json(), list):
        ids = {(x.get(key) or x.get("id")) for x in rb.json()}
        check(f"{list_path} liste Beta n'inclut pas l'id Altair", aid not in ids, f"beta_n={len(ids)}")

    dpath = detail.format(id=aid)
    # Détecte si une route GET-by-id existe (via token Altair légitime)
    a_get = requests.get(f"{API}{dpath}", headers=AH, timeout=20)
    has_get = a_get.status_code != 405
    # 2. GET cross-tenant refusé (403/404) ou route absente (405)
    rg = requests.get(f"{API}{dpath}", headers=BH, timeout=20)
    if has_get:
        check(f"GET {dpath[:34]} cross-tenant refusé", ok_read_denied(rg.status_code), f"http={rg.status_code}")
    else:
        check(f"GET {dpath[:30]} route absente (N/A)", rg.status_code == 405, "405 no GET-by-id")
    # 3. PUT cross-tenant refusé (body neutre)
    rp = requests.put(f"{API}{dpath}", headers=BH, json={"description": "x"}, timeout=20)
    check(f"PUT {dpath[:34]} cross-tenant refusé", rp.status_code in (403, 404, 405, 422), f"http={rp.status_code}")
    # 4. DELETE cross-tenant refusé PUIS (si GET dispo) objet Altair toujours présent
    rd = requests.delete(f"{API}{dpath}", headers=BH, timeout=20)
    if has_get:
        still = requests.get(f"{API}{dpath}", headers=AH, timeout=20)
        safe = rd.status_code in (403, 404) and still.status_code == 200
        check(f"DELETE {dpath[:31]} refusé + objet Altair intact", safe, f"del={rd.status_code} altair_get={still.status_code}")
    else:
        check(f"DELETE {dpath[:31]} cross-tenant refusé", rd.status_code in (403, 404), f"del={rd.status_code}")

# 5. Endpoints d'export/PDF par ID (fuite de contenu)
pid = one_id("/projects", "project_id")
gid = one_id("/governance", "governance_id")
sid = one_id("/pb/sessions", "session_id")
for label, path in [
    ("benefits projet", f"/projects/{pid}/benefits" if pid else None),
    ("msproject export", f"/msproject/export/{pid}" if pid else None),
    ("gouvernance invitation-pdf", f"/governance/{gid}/invitation-pdf" if gid else None),
    ("export PB pptx", f"/pb/{sid}.pptx" if sid else None),
]:
    if not path:
        continue
    r = requests.get(f"{API}{path}", headers=BH, timeout=25)
    check(f"export/PDF cross-tenant refusé — {label}", r.status_code in (403, 404), f"http={r.status_code}")

# 6. Budget agrégé : Beta ne récupère pas des chiffres Altair via project_id direct
if pid:
    r = requests.get(f"{API}/budget/project/{pid}/revisions", headers=BH, timeout=20)
    check("budget revisions cross-tenant refusé", r.status_code in (403, 404), f"http={r.status_code}")

fails = [x for x in R if not x[1]]
print(f"\n=== {len(R)-len(fails)}/{len(R)} PASS ===")
for n, ok, i in fails:
    print("  FAIL:", n, i)
