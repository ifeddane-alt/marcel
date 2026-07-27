"""Connecteur MS Project — export/import au format XML MSPDI (ouvrable dans MS Project)."""
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


async def import_project_xml(project_id: str, content: bytes, user: TokenPayload) -> dict:
    """Parse un XML MS Project (MSPDI) et crée les tâches/jalons dans le projet."""
    require_write(user)
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(404, "Projet introuvable")

    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        raise HTTPException(400, f"XML invalide : {e}")

    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}")[0] + "}"

    tasks_created = 0
    milestones_created = 0
    current_phase = None

    for t in root.iter(f"{ns}Task"):
        name = (t.findtext(f"{ns}Name") or "").strip()
        if not name:
            continue
        uid_txt = t.findtext(f"{ns}UID") or "1"
        if uid_txt == "0":
            continue  # tâche récapitulative projet
        is_summary = (t.findtext(f"{ns}Summary") or "0") == "1"
        is_milestone = (t.findtext(f"{ns}Milestone") or "0") == "1"
        start = (t.findtext(f"{ns}Start") or "")[:10] or None
        finish = (t.findtext(f"{ns}Finish") or "")[:10] or None

        if is_summary:
            current_phase = name
            continue

        if is_milestone:
            d = start or finish or datetime.now(timezone.utc).strftime("%Y-%m-%d")
            await db.milestones.insert_one({
                "milestone_id": str(uuid.uuid4()),
                "project_id": project_id,
                "tenant_id": user.tenant_id,
                "name": name,
                "family": "delivery",
                "date_baseline": d,
                "date_forecast": d,
                "status": "not_done",
                "phase": current_phase,
                "source": "msproject",
                "created_at": _now(),
            })
            milestones_created += 1
        else:
            await db.tasks.insert_one({
                "task_id": str(uuid.uuid4()),
                "project_id": project_id,
                "tenant_id": user.tenant_id,
                "name": name,
                "phase": current_phase,
                "scope_status": "SEC",
                "status": "todo",
                "date_debut": start,
                "date_fin": finish,
                "source": "msproject",
                "created_at": _now(),
            })
            tasks_created += 1

    return {
        "project_id": project_id,
        "tasks_created": tasks_created,
        "milestones_created": milestones_created,
    }
