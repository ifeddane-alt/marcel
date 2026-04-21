from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload
from .schemas import ExportCopilRequest
from pptx_generator import generate_copil_pptx


async def export_copil(data: ExportCopilRequest, current_user: TokenPayload):
    if not data.project_ids:
        raise HTTPException(status_code=422, detail="Au moins un projet requis")

    projects = await db.projects.find(
        {"project_id": {"$in": data.project_ids}, "tenant_id": current_user.tenant_id},
        {"_id": 0},
    ).to_list(None)
    if not projects:
        raise HTTPException(status_code=404, detail="Aucun projet trouvé pour les IDs fournis")

    resources = await db.resources.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0, "resource_id": 1, "name": 1}
    ).to_list(None)
    res_map = {r["resource_id"]: r["name"] for r in resources}
    for p in projects:
        p["owner_name"] = res_map.get(
            p.get("owner_id", ""),
            p.get("metadata", {}).get("sponsor", "—") or "—",
        )

    pid_order = {pid: i for i, pid in enumerate(data.project_ids)}
    projects.sort(key=lambda p: pid_order.get(p["project_id"], 999))

    milestones = await db.milestones.find(
        {"project_id": {"$in": data.project_ids}}, {"_id": 0}
    ).to_list(None)

    risks = await db.risks.find(
        {"project_id": {"$in": data.project_ids}, "tenant_id": current_user.tenant_id},
        {"_id": 0},
    ).to_list(None)

    decisions_query: dict = {
        "project_id": {"$in": data.project_ids},
        "tenant_id": current_user.tenant_id,
    }
    if data.governance_id:
        decisions_query["governance_id"] = data.governance_id
    decisions = await db.decisions.find(decisions_query, {"_id": 0}).sort("created_at", -1).to_list(None)

    buf = generate_copil_pptx(
        instance_name=data.instance_name,
        instance_date=data.instance_date,
        projects=projects,
        all_milestones=milestones,
        all_risks=risks,
        all_decisions=decisions,
        governance_id=data.governance_id,
    )
    return buf, data.instance_name, data.instance_date
