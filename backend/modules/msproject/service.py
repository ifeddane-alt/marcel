"""Connecteur MS Project — export XML MSPDI + import intelligent (.mpp / .xml) avec diff et upsert."""
import asyncio
import json
import os
import sys
import tempfile
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload, require_write

MSPDI_NS = "http://schemas.microsoft.com/project"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fmt_date(d: str | None, end: bool = False) -> str:
    if not d:
        d = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"{str(d)[:10]}T{'17:00:00' if end else '08:00:00'}"


async def export_project_xml(project_id: str, user: TokenPayload) -> tuple[str, str]:
    """Génère un XML MSPDI. Retourne (filename, xml_string)."""
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(404, "Projet introuvable")

    tasks = await db.tasks.find(
        {"project_id": project_id, "tenant_id": user.tenant_id}, {"_id": 0}
    ).to_list(None)
    milestones = await db.milestones.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(None)

    ET.register_namespace("", MSPDI_NS)
    root = ET.Element(f"{{{MSPDI_NS}}}Project")
    ET.SubElement(root, f"{{{MSPDI_NS}}}Name").text = project.get("name", "Projet")
    ET.SubElement(root, f"{{{MSPDI_NS}}}Title").text = project.get("name", "Projet")
    ET.SubElement(root, f"{{{MSPDI_NS}}}StartDate").text = _fmt_date(
        project.get("date_debut") or project.get("start_date")
    )
    tasks_el = ET.SubElement(root, f"{{{MSPDI_NS}}}Tasks")

    uid = 0

    def add_task(name, start, finish, outline, milestone=False, summary=False, notes=None):
        nonlocal uid
        uid += 1
        t = ET.SubElement(tasks_el, f"{{{MSPDI_NS}}}Task")
        ET.SubElement(t, f"{{{MSPDI_NS}}}UID").text = str(uid)
        ET.SubElement(t, f"{{{MSPDI_NS}}}ID").text = str(uid)
        ET.SubElement(t, f"{{{MSPDI_NS}}}Name").text = name
        ET.SubElement(t, f"{{{MSPDI_NS}}}OutlineLevel").text = str(outline)
        ET.SubElement(t, f"{{{MSPDI_NS}}}Start").text = _fmt_date(start)
        ET.SubElement(t, f"{{{MSPDI_NS}}}Finish").text = _fmt_date(finish, end=True)
        ET.SubElement(t, f"{{{MSPDI_NS}}}Milestone").text = "1" if milestone else "0"
        ET.SubElement(t, f"{{{MSPDI_NS}}}Summary").text = "1" if summary else "0"
        if notes:
            ET.SubElement(t, f"{{{MSPDI_NS}}}Notes").text = notes

    # Grouper par phase (ordre d'apparition)
    phases: list[str] = []
    for item in tasks + milestones:
        ph = item.get("phase") or "Général"
        if ph not in phases:
            phases.append(ph)

    for ph in phases:
        ph_tasks = [t for t in tasks if (t.get("phase") or "Général") == ph]
        ph_ms = [m for m in milestones if (m.get("phase") or "Général") == ph]
        starts = [t.get("date_debut") for t in ph_tasks if t.get("date_debut")]
        ends = [t.get("date_fin") for t in ph_tasks if t.get("date_fin")]
        add_task(ph, min(starts) if starts else None, max(ends) if ends else None, 1, summary=True)
        for t in ph_tasks:
            add_task(t.get("name", "Tâche"), t.get("date_debut"), t.get("date_fin"), 2)
        for m in ph_ms:
            d = m.get("date_forecast") or m.get("date_baseline")
            add_task(m.get("name", "Jalon"), d, d, 2, milestone=True)

    xml_str = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + ET.tostring(
        root, encoding="unicode"
    )
    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in project.get("name", "projet"))
    return f"{safe_name}_msproject.xml", xml_str


# ─── Parsing unifié (.xml MSPDI / .mpp binaire) ─────────────────────────────

def _parse_xml_items(content: bytes) -> dict:
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        raise HTTPException(400, f"XML invalide : {e}")
    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}")[0] + "}"
    items = []
    for t in root.iter(f"{ns}Task"):
        name = (t.findtext(f"{ns}Name") or "").strip()
        if not name:
            continue
        if (t.findtext(f"{ns}UID") or "1") == "0":
            continue  # tâche récapitulative projet
        items.append({
            "name": name,
            "summary": (t.findtext(f"{ns}Summary") or "0") == "1",
            "milestone": (t.findtext(f"{ns}Milestone") or "0") == "1",
            "start": (t.findtext(f"{ns}Start") or "")[:10] or None,
            "finish": (t.findtext(f"{ns}Finish") or "")[:10] or None,
        })
    proj_name = (root.findtext(f"{ns}Name") or root.findtext(f"{ns}Title") or "").strip()
    return {"name": proj_name, "items": items}


async def _parse_mpp_items(content: bytes) -> dict:
    with tempfile.NamedTemporaryFile(suffix=".mpp", delete=False) as f:
        f.write(content)
        tmp_path = f.name
    out_path = tmp_path + ".json"
    try:
        script = os.path.join(os.path.dirname(__file__), "mpp_parser.py")
        proc = await asyncio.create_subprocess_exec(
            sys.executable, script, tmp_path, out_path,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        try:
            out, err = await asyncio.wait_for(proc.communicate(), timeout=120)
        except asyncio.TimeoutError:
            proc.kill()
            raise HTTPException(400, "Lecture du fichier .mpp trop longue (timeout)")
        if proc.returncode != 0 and not os.path.exists(out_path):
            raise HTTPException(400, f"Fichier .mpp illisible : {err.decode(errors='ignore')[-300:]}")
        with open(out_path) as f:
            parsed = json.load(f)
    finally:
        os.unlink(tmp_path)
        if os.path.exists(out_path):
            os.unlink(out_path)
    if parsed.get("error"):
        raise HTTPException(400, f"Fichier .mpp illisible : {parsed['error']}")
    return {"name": (parsed.get("name") or "").strip(), "items": parsed.get("tasks", [])}


async def _parse_any(filename: str, content: bytes) -> dict:
    """Retourne {"name": nom du projet dans le fichier, "items": [{name, start, finish, milestone, summary}]}."""
    head = content.lstrip()[:5]
    if (filename or "").lower().endswith(".xml") or head.startswith(b"<?xml") or head.startswith(b"<"):
        return _parse_xml_items(content)
    return await _parse_mpp_items(content)


# ─── Diff & upsert ───────────────────────────────────────────────────────────

def _norm(name: str) -> str:
    return " ".join((name or "").strip().lower().split())


async def _build_plan(project_id: str, items: list, tenant_id: str) -> dict:
    """Compare les éléments du fichier aux tâches/jalons existants du projet."""
    ex_tasks = await db.tasks.find(
        {"project_id": project_id, "tenant_id": tenant_id}, {"_id": 0}
    ).to_list(None)
    ex_ms = await db.milestones.find({"project_id": project_id}, {"_id": 0}).to_list(None)

    task_map: dict[str, list] = {}
    for t in ex_tasks:
        task_map.setdefault(_norm(t.get("name")), []).append(t)
    ms_map: dict[str, list] = {}
    for m in ex_ms:
        ms_map.setdefault(_norm(m.get("name")), []).append(m)

    to_create, to_update, unchanged = [], [], []
    current_phase = None
    matched_ids = set()

    for it in items:
        if it.get("summary"):
            current_phase = it["name"]
            continue
        key = _norm(it["name"])
        entry = {**it, "phase": current_phase}
        pool = ms_map.get(key) if it.get("milestone") else task_map.get(key)
        existing = pool.pop(0) if pool else None
        if not existing:
            to_create.append(entry)
            continue
        changes = []
        if it.get("milestone"):
            matched_ids.add(existing["milestone_id"])
            new_d = it.get("start") or it.get("finish")
            if new_d and (existing.get("date_forecast") or "")[:10] != new_d:
                changes.append({"field": "date prévue", "old": (existing.get("date_forecast") or "—")[:10], "new": new_d})
        else:
            matched_ids.add(existing["task_id"])
            if it.get("start") and (existing.get("date_debut") or "")[:10] != it["start"]:
                changes.append({"field": "début", "old": (existing.get("date_debut") or "—")[:10], "new": it["start"]})
            if it.get("finish") and (existing.get("date_fin") or "")[:10] != it["finish"]:
                changes.append({"field": "fin", "old": (existing.get("date_fin") or "—")[:10], "new": it["finish"]})
        if current_phase and (existing.get("phase") or None) != current_phase:
            changes.append({"field": "phase", "old": existing.get("phase") or "—", "new": current_phase})
        if changes:
            to_update.append({"existing": existing, "item": entry, "changes": changes})
        else:
            unchanged.append(entry)

    absent = [
        {"name": x.get("name"), "type": "milestone" if "milestone_id" in x else "task"}
        for x in ex_tasks + ex_ms
        if str(x.get("source", "")).startswith("msproject")
        and x.get("task_id", x.get("milestone_id")) not in matched_ids
    ]
    return {"to_create": to_create, "to_update": to_update, "unchanged": unchanged, "absent": absent}


async def analyze_import(project_id: str, filename: str, content: bytes, user: TokenPayload) -> dict:
    """Analyse un fichier MS Project et retourne le diff sans rien modifier."""
    require_write(user)
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": user.tenant_id}, {"_id": 0, "name": 1}
    )
    if not project:
        raise HTTPException(404, "Projet introuvable")
    parsed = await _parse_any(filename, content)
    plan = await _build_plan(project_id, parsed["items"], user.tenant_id)
    return {
        "project_id": project_id,
        "project_name": project.get("name"),
        "file_project_name": parsed["name"],
        "new": [
            {"name": e["name"], "type": "milestone" if e.get("milestone") else "task",
             "start": e.get("start"), "finish": e.get("finish"), "phase": e.get("phase")}
            for e in plan["to_create"]
        ],
        "updated": [
            {"name": u["item"]["name"],
             "type": "milestone" if u["item"].get("milestone") else "task",
             "changes": u["changes"]}
            for u in plan["to_update"]
        ],
        "unchanged_count": len(plan["unchanged"]),
        "absent": plan["absent"],
    }


async def _insert_item(project_id: str, entry: dict, tenant_id: str) -> str:
    """Insère une tâche ou un jalon depuis un élément parsé. Retourne 'milestone' ou 'task'."""
    if entry.get("milestone"):
        d = entry.get("start") or entry.get("finish") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        await db.milestones.insert_one({
            "milestone_id": str(uuid.uuid4()),
            "project_id": project_id,
            "tenant_id": tenant_id,
            "name": entry["name"],
            "family": "delivery",
            "date_baseline": d,
            "date_forecast": d,
            "status": "not_done",
            "phase": entry.get("phase"),
            "source": "msproject",
            "created_at": _now(),
        })
        return "milestone"
    await db.tasks.insert_one({
        "task_id": str(uuid.uuid4()),
        "project_id": project_id,
        "tenant_id": tenant_id,
        "name": entry["name"],
        "phase": entry.get("phase"),
        "scope_status": "SEC",
        "status": "todo",
        "date_debut": entry.get("start"),
        "date_fin": entry.get("finish"),
        "source": "msproject",
        "created_at": _now(),
    })
    return "task"


async def apply_import(project_id: str, filename: str, content: bytes, user: TokenPayload) -> dict:
    """Applique le fichier au projet : met à jour les éléments existants, crée les nouveaux."""
    require_write(user)
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(404, "Projet introuvable")
    parsed = await _parse_any(filename, content)
    plan = await _build_plan(project_id, parsed["items"], user.tenant_id)

    created = {"task": 0, "milestone": 0}
    updated = {"task": 0, "milestone": 0}

    for entry in plan["to_create"]:
        kind = await _insert_item(project_id, entry, user.tenant_id)
        created[kind] += 1

    for u in plan["to_update"]:
        it, existing = u["item"], u["existing"]
        if it.get("milestone"):
            new_d = it.get("start") or it.get("finish")
            fields = {"phase": it.get("phase") or existing.get("phase")}
            if new_d:
                fields["date_forecast"] = new_d
            await db.milestones.update_one({"milestone_id": existing["milestone_id"]}, {"$set": fields})
            updated["milestone"] += 1
        else:
            fields = {"phase": it.get("phase") or existing.get("phase")}
            if it.get("start"):
                fields["date_debut"] = it["start"]
            if it.get("finish"):
                fields["date_fin"] = it["finish"]
            await db.tasks.update_one({"task_id": existing["task_id"]}, {"$set": fields})
            updated["task"] += 1

    from core.audit import log_audit
    await log_audit(user, "updated", "project", project_id, project.get("name", ""), [
        {"field": "import MS Project",
         "old": filename or "fichier",
         "new": f"{created['task'] + created['milestone']} créé(s), {updated['task'] + updated['milestone']} mis à jour"},
    ])
    return {
        "project_id": project_id,
        "tasks_created": created["task"],
        "milestones_created": created["milestone"],
        "tasks_updated": updated["task"],
        "milestones_updated": updated["milestone"],
        "unchanged": len(plan["unchanged"]),
    }


async def import_project_file(project_id: str, filename: str, content: bytes, user: TokenPayload) -> dict:
    """Import (upsert) — conservé pour compatibilité avec la route historique."""
    return await apply_import(project_id, filename, content, user)


async def import_new_project(filename: str, content: bytes, user: TokenPayload) -> dict:
    """Crée un nouveau projet MARCEL directement depuis un fichier MS Project."""
    require_write(user)
    parsed = await _parse_any(filename, content)
    items = parsed["items"]
    if not items:
        raise HTTPException(400, "Aucune tâche ni jalon trouvé dans le fichier")

    stem = os.path.splitext(os.path.basename(filename or "projet"))[0]
    name = parsed["name"] or stem or "Projet MS Project"
    starts = [i["start"] for i in items if i.get("start")]
    ends = [i["finish"] for i in items if i.get("finish")]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start_date = min(starts) if starts else today
    end_date = max(ends) if ends else start_date

    from modules.projects.schemas import ProjectCreate
    from modules.projects.service import create_project
    project = await create_project(ProjectCreate(
        name=name,
        methodology="waterfall",
        status_rag="green",
        jh_planned=0,
        start_date=start_date,
        end_date_baseline=end_date,
        end_date_forecast=end_date,
        description=f"Projet créé depuis Microsoft Project ({filename or 'fichier'})",
        source_tool="msproject",
    ), user)

    created = {"task": 0, "milestone": 0}
    current_phase = None
    for it in items:
        if it.get("summary"):
            current_phase = it["name"]
            continue
        kind = await _insert_item(project["project_id"], {**it, "phase": current_phase}, user.tenant_id)
        created[kind] += 1

    return {
        "project": project,
        "tasks_created": created["task"],
        "milestones_created": created["milestone"],
    }
