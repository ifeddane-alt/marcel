import asyncio, json, urllib.request, urllib.error
import sys
sys.path.insert(0, "/app/backend")

API = "http://localhost:8001/api"
P = F = 0
def check(label, ok, detail=""):
    global P, F
    P += ok; F += (not ok)
    print(f"[{'PASS' if ok else 'FAIL'}] {label} {detail}")

def post(path, body):
    r = urllib.request.Request(API + path, data=json.dumps(body).encode(), method="POST")
    r.add_header("Content-Type", "application/json")
    try:
        resp = urllib.request.urlopen(r, timeout=20)
        return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")

# ---------- 3) LOGIN: uniform error message + IP throttle ----------
s1, b1 = post("/auth/login", {"email": "admin@altair.fr", "password": "WRONGPASS"})
s2, b2 = post("/auth/login", {"email": "does-not-exist-xyz@altair.fr", "password": "WRONGPASS"})
check("login wrong-password -> 401", s1 == 401, f"({s1} {b1.get('detail')})")
check("login unknown-email -> 401", s2 == 401, f"({s2} {b2.get('detail')})")
check("login uniform message (unknown == wrong-pw)", b1.get("detail") == b2.get("detail") == "Identifiants invalides",
      f"('{b1.get('detail')}' vs '{b2.get('detail')}')")
# IP throttle: hammer with unknown emails from same IP; expect a 429 before 60 tries
got429 = False
for i in range(40):
    s, b = post("/auth/login", {"email": f"spray{i}@altair.fr", "password": "x"})
    if s == 429:
        got429 = True; break
check("login IP throttle -> 429 (spraying multi-emails)", got429, f"(hit at attempt {i})")

# ---------- 1) SSRF: hardened client blocks internal, pins/allows public ----------
async def ssrf_tests():
    from core.ssrf import hardened_async_client, validate_public_url
    # internal metadata IP must be refused at connect
    blocked = False
    try:
        async with hardened_async_client(timeout=5) as c:
            await c.get("http://169.254.169.254/latest/meta-data/")
    except Exception as e:
        blocked = "interne" in str(e).lower() or "interdite" in str(e).lower() or "connect" in type(e).__name__.lower()
    check("SSRF hardened client blocks 169.254.169.254", blocked)
    # loopback refused
    blocked2 = False
    try:
        async with hardened_async_client(timeout=5) as c:
            await c.get("http://127.0.0.1:8001/api/health")
    except Exception as e:
        blocked2 = "interne" in str(e).lower() or "connect" in type(e).__name__.lower()
    check("SSRF hardened client blocks 127.0.0.1", blocked2)
    # public host works (pinned) -> real request succeeds over TLS
    ok_public = False
    try:
        async with hardened_async_client(timeout=15) as c:
            r = await c.get("https://api.github.com/zen")
            ok_public = r.status_code == 200 and len(r.text) > 0
    except Exception as e:
        check("SSRF public https reachable", False, f"(err {type(e).__name__}: {e})")
    else:
        check("SSRF public https reachable + TLS verified (github)", ok_public, f"(status ok)")
    # validate_public_url still blocks internal hostnames
    v_ok = False
    try:
        validate_public_url("http://localhost:8001", allow_http=True)
    except ValueError:
        v_ok = True
    check("validate_public_url blocks localhost", v_ok)

# ---------- 2) WS revocation: authenticate_ws_token honours perm_version/is_active ----------
async def ws_tests():
    import os
    os.environ.setdefault("MONGO_URL", "")  # already set in env by supervisor; import uses it
    from core.auth import create_token, authenticate_ws_token
    from core.database import db
    u = await db.users.find_one({"email": "manager@altair.fr"}, {"_id": 0})
    good = create_token({"tenant_id": u["tenant_id"], "user_id": u["user_id"], "email": u["email"],
                         "role": u["role"], "name": u["name"], "pv": u.get("perm_version", 1)})
    # valid token accepted
    ok_valid = False
    try:
        tp = await authenticate_ws_token(good); ok_valid = tp.user_id == u["user_id"]
    except Exception as e:
        check("WS valid token accepted", False, f"({e})")
    else:
        check("WS valid token accepted", ok_valid)
    # stale pv rejected
    stale = create_token({"tenant_id": u["tenant_id"], "user_id": u["user_id"], "email": u["email"],
                          "role": u["role"], "name": u["name"], "pv": (u.get("perm_version", 1) + 99)})
    rejected = False
    try:
        await authenticate_ws_token(stale)
    except Exception:
        rejected = True
    check("WS stale perm_version rejected (revocation)", rejected)
    # unknown user rejected
    bad = create_token({"tenant_id": u["tenant_id"], "user_id": "nonexistent-xyz", "email": "x",
                        "role": "READ_ONLY", "name": "x", "pv": 1})
    rej2 = False
    try:
        await authenticate_ws_token(bad)
    except Exception:
        rej2 = True
    check("WS unknown/invalid session rejected", rej2)

async def main():
    await ssrf_tests()
    await ws_tests()

asyncio.run(main())
print(f"\nRESULT: {P} PASS / {F} FAIL")
sys.exit(1 if F else 0)
