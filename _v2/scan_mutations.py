import re, pathlib

ROOT = pathlib.Path("backend/modules")
mut = re.compile(r"@router\.(post|put|patch|delete)\(")
dep_perm = re.compile(r"permission_required(_any)?\(")
dep_auth = re.compile(r"Depends\(get_current_user\)")

rows = []
for router in sorted(ROOT.glob("*/router.py")):
    mod = router.parent.name
    lines = router.read_text(encoding="utf-8").splitlines()
    i = 0
    while i < len(lines):
        m = mut.search(lines[i])
        if m:
            method = m.group(1).upper()
            # capture route path
            path = ""
            pm = re.search(r"\(\s*[\"']([^\"']+)[\"']", lines[i])
            if pm: path = pm.group(1)
            # gather the decorator+signature block until the function body starts
            block = []
            j = i
            depth = 0
            while j < len(lines) and j < i+25:
                block.append(lines[j])
                if lines[j].strip().startswith("async def") or lines[j].strip().startswith("def "):
                    # include a couple more lines for the signature
                    k = j
                    while k < len(lines) and "):" not in lines[k] and ") ->" not in lines[k] and k < j+20:
                        k += 1
                        block.append(lines[k] if k < len(lines) else "")
                    break
                j += 1
            btxt = "\n".join(block)
            has_perm = bool(dep_perm.search(btxt))
            only_auth = bool(dep_auth.search(btxt)) and not has_perm
            guard = "permission_required" if has_perm else ("ONLY get_current_user" if only_auth else "?")
            rows.append((mod, method, path, guard))
        i += 1

# print grouped, flag the risky ones
risky = [r for r in rows if r[3] != "permission_required"]
print(f"TOTAL mutation routes: {len(rows)}")
print(f"Routes NOT using permission_required at router level: {len(risky)}\n")
cur = None
for mod, method, path, guard in rows:
    if mod != cur:
        print(f"\n### {mod}")
        cur = mod
    flag = "  <-- NO ROUTER PERM" if guard != "permission_required" else ""
    print(f"  {method:6} {path:45} {guard}{flag}")
