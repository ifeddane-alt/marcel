import json, urllib.request, urllib.error

BASE = "http://localhost:8001/api"

def req(method, path, token=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        resp = urllib.request.urlopen(r, timeout=30)
        return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}

def login(email, pw):
    s, b = req("POST", "/auth/login", body={"email": email, "password": pw})
    assert s == 200, f"login {email} -> {s} {b}"
    return b["access_token"], b.get("permissions", [])

viewer, vperms = login("viewer@altair.fr", "View1234!")
admin, aperms = login("admin@altair.fr", "Admin2026!")
print("viewer perms has arbitrage.edit:", "arbitrage.edit" in vperms)
print("admin perms has '*':", "*" in aperms)

# grab a valid project_id + current weights (as admin)
_, projs = req("GET", "/projects", admin)
pid = (projs[0]["project_id"] if isinstance(projs, list) and projs else None)
sc, weights = req("GET", "/arbitrage/weights", admin)
print("admin GET weights:", sc)

PASS = 0; FAIL = 0
def check(label, got, expected):
    global PASS, FAIL
    ok = got == expected
    PASS += ok; FAIL += (not ok)
    print(f"[{'PASS' if ok else 'FAIL'}] {label}: got {got}, expected {expected}")

print("\n--- VIEWER (READ_ONLY) must be DENIED on writes (was 200 before fix) ---")
s,_ = req("PUT", "/arbitrage/weights", viewer, body=weights); check("viewer PUT /arbitrage/weights", s, 403)
s,_ = req("PATCH", f"/arbitrage/projects/{pid}/scoring", viewer, body={"strategic_alignment":5}); check("viewer PATCH arbitrage scoring", s, 403)
s,_ = req("POST", "/arbitrage/envelopes", viewer, body={"year":2027,"total_envelope":1}); check("viewer POST arbitrage envelope", s, 403)
s,_ = req("POST", "/arbitrage/scenarios", viewer, body={"name":"x","modifications":[]}); check("viewer POST arbitrage scenario", s, 403)
s,_ = req("POST", "/arbitrage/scenarios/deadbeef/apply", viewer); check("viewer POST arbitrage apply", s, 403)
s,_ = req("POST", f"/projects/{pid}/apply-template", viewer, body={"template_id":"x","selected_phases":None}); check("viewer POST apply-template", s, 403)
s,_ = req("POST", "/connectors/jira/test", viewer); check("viewer POST connectors/jira/test", s, 403)
s,_ = req("POST", "/export/copil", viewer, body={"project_ids":[pid],"instance_name":"t"}); check("viewer POST export/copil", s, 403)
s,_ = req("POST", "/profiles/seed", viewer); check("viewer POST profiles/seed", s, 403)
s,_ = req("PUT", "/indicator-catalog/manual/dashboard/DUMMY", viewer, body={"value":1}); check("viewer PUT catalog dashboard manual", s, 403)

print("\n--- ADMIN must still be ALLOWED (no regression) ---")
s,_ = req("PUT", "/arbitrage/weights", admin, body=weights); check("admin PUT /arbitrage/weights", s, 200)
s,b = req("GET", "/arbitrage/summary", viewer); check("viewer GET /arbitrage/summary (read allowed)", s, 200)

print(f"\nRESULT: {PASS} PASS / {FAIL} FAIL")
