import re, pathlib

MODS = ["agent","applications","arbitrage","architecture","budget","catalog","connectors",
        "csv_import","dashboard","decisions","engagement","excel_io","export","indicators",
        "leaves","lifecycle","msproject","notifications","objectives","pb","profiles",
        "programs","project_templates","rgpd","risks","run","safe","scope","security",
        "status_report","tasks","tenant","timesheets","work_allocations"]

AUTHZ = re.compile(r"require_perm\(|require_dsi_write\(|has_perm\(|permission_required|"
                   r"ensure_project_scope\(|require_admin\(|write_permission\s*=|"
                   r"_enforce_permission\(|is_ownership_restricted\(|_require_admin_config\(|"
                   r"role\s*(==|!=|not in|in)\s")

base = pathlib.Path("backend/modules")
for m in MODS:
    svc = base / m / "service.py"
    files = []
    if svc.exists():
        files.append(svc)
    # some modules have extra service files
    for extra in (base/m).glob("*.py"):
        if extra.name not in ("service.py","router.py","schemas.py","__init__.py","models.py"):
            files.append(extra)
    hits = 0
    detail = []
    for f in files:
        for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            if AUTHZ.search(line):
                hits += 1
                detail.append(f"    {f.name}:{i}: {line.strip()[:90]}")
    tag = "NO-AUTHZ-PRIMITIVE" if hits == 0 else f"{hits} authz refs"
    print(f"### {m:20} -> {tag}")
    if 0 < hits <= 12:
        print("\n".join(detail))
