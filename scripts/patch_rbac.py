"""Patch RBAC : remplace les appels laxistes require_write/_require_write par
require_perm(user, "<permission explicite>") selon la fonction englobante.
Idempotent. Usage : python scripts/patch_rbac.py [--check]
"""
import re, sys, pathlib

BACKEND = pathlib.Path("/app/backend")

# (module, fonction) -> permission explicite
PERM_MAP = {
    "applications": {"create_application": "applications.manage", "update_application": "applications.manage",
                     "delete_application": "applications.manage", "set_projects": "applications.manage"},
    "catalog": {"set_selection": "indicators.manage"},
    "csv_import": {"preview_import": "import.csv", "commit_import": "import.csv"},
    "decisions": {"create_decision": "decisions.create", "update_decision": "decisions.edit"},
    "engagement": {"create_criterion": "engagement.manage", "update_criterion": "engagement.manage",
                   "delete_criterion": "engagement.manage"},
    "excel_io": {"preview_import": "import.data", "commit_import": "import.data"},
    "msproject": {"analyze_import": "import.data", "apply_import": "import.data", "import_new_project": "import.data"},
    "objectives": {"create_objective": "objectives.manage", "update_objective": "objectives.manage",
                   "update_target_value": "objectives.manage", "delete_objective": "objectives.manage",
                   "set_objective_projects": "objectives.manage"},
    "okrs": {"create_okr": "okrs.manage", "update_okr": "okrs.manage", "delete_okr": "okrs.manage",
             "update_wsjf_criteria": "okrs.manage"},
    "programs": {"create_program": "programs.manage", "update_program": "programs.manage",
                 "delete_program": "programs.delete"},
    "projects": {"create_project": "projects.create"},  # update/set_benefits/add_budget_revision = scope manuel
    "resources": {"create_resource": "resources.create", "update_resource": "resources.edit",
                  "delete_resource": "resources.delete"},
    "risks": {"create_risk": "risks.create", "update_risk": "risks.edit"},
    "tasks": {"create_task": "tasks.create", "update_task": "tasks.edit", "bulk_scope": "tasks.edit",
              "transition_task_phase": "tasks.edit", "update_phase_estimates": "tasks.edit",
              "delete_task": "tasks.delete"},
    "teams": {"create_team": "teams.create", "update_team": "teams.edit"},
    "timesheets": {"upsert_entry": "timesheets.submit", "submit_week": "timesheets.submit"},
    "work_allocations": {"create_work_allocation": "allocations.create",
                         "update_work_allocation": "allocations.manage",
                         "delete_work_allocation": "allocations.manage"},
    "run": {"create_activity": "run.manage", "update_activity": "run.manage", "delete_activity": "run.delete",
            "set_activity_allocations": "run.manage", "create_incident": "run.manage",
            "update_incident": "run.manage", "delete_incident": "run.delete", "create_release": "run.manage",
            "update_release": "run.manage", "delete_release": "run.delete"},
    "safe": {"create_train": "trains.create", "update_train": "trains.edit", "create_pi": "safe.manage",
             "update_pi": "safe.manage", "create_sprint": "safe.manage", "update_sprint": "safe.manage",
             "create_capability": "safe.manage", "update_capability": "safe.manage",
             "delete_capability": "safe.manage", "assign_feature_pi": "safe.manage",
             "set_feature_wsjf": "safe.manage"},
    # leaves.upsert_leave : logique self/validate spécifique → traité manuellement.
}

CALL_RE = re.compile(r'^(\s*)(?:_)?require_write\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*$')
DEF_RE = re.compile(r'^\s*(?:async\s+)?def\s+(\w+)')

check = "--check" in sys.argv
patched_total = 0
skipped = []

for f in sorted(BACKEND.glob("modules/*/service.py")):
    module = f.parent.name
    fmap = PERM_MAP.get(module, {})
    lines = f.read_text(encoding="utf-8").splitlines()
    cur = None
    out = []
    changed = False
    for l in lines:
        m = DEF_RE.match(l)
        if m:
            cur = m.group(1)
        cm = CALL_RE.match(l)
        if cm and cur not in (None, "_require_write"):
            indent, arg = cm.group(1), cm.group(2)
            perm = fmap.get(cur)
            if perm:
                out.append(f'{indent}require_perm({arg}, "{perm}")')
                changed = True
                patched_total += 1
                continue
            else:
                skipped.append(f"{module}.{cur}")
        out.append(l)
    if changed and not check:
        # S'assurer que require_perm est importé
        text = "\n".join(out) + "\n"
        if "require_perm" not in text.split("\n\n")[0] and "from core.auth import" in text:
            text = re.sub(r'from core\.auth import ([^\n]+)',
                          lambda mm: (mm.group(0) if "require_perm" in mm.group(1)
                                      else f"from core.auth import {mm.group(1).rstrip()}, require_perm"),
                          text, count=1)
        f.write_text(text, encoding="utf-8")
    if changed:
        print(f"[{'DRY' if check else 'PATCH'}] {module}: {sum(1 for l in lines if CALL_RE.match(l))} appel(s)")

print(f"\nTotal appels patchés: {patched_total}")
if skipped:
    print("NON mappés (à traiter manuellement) :", sorted(set(skipped)))
