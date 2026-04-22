from fastapi import HTTPException
from datetime import datetime, timezone
import uuid
from typing import Optional
from core.database import db
from core.auth import TokenPayload, require_write
from .schemas import OKRCreate, OKRUpdate, WSJFUpdate


# ─── OKR CRUD ────────────────────────────────────────────────────────────────

async def list_okrs(train_id: Optional[str], current_user: TokenPayload) -> list:
    query: dict = {"tenant_id": current_user.tenant_id}
    if train_id:
        query["train_id"] = train_id
    okrs = await db.okrs.find(query, {"_id": 0}).to_list(None)
    # Calculer le progrès global de chaque OKR
    for okr in okrs:
        krs = okr.get("key_results") or []
        if krs:
            progress = round(sum(
                min(kr.get("current_value", 0) / kr.get("target_value", 1) * 100, 100)
                for kr in krs
            ) / len(krs), 1)
        else:
            progress = 0
        okr["overall_progress"] = progress
    return okrs


async def create_okr(data: OKRCreate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    krs = []
    for kr in (data.key_results or []):
        krs.append({
            "kr_id": kr.kr_id or str(uuid.uuid4()),
            "description": kr.description,
            "target_value": kr.target_value,
            "current_value": kr.current_value,
            "unit": kr.unit,
        })
    doc = {
        "okr_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        "train_id": data.train_id,
        "objective": data.objective,
        "description": data.description,
        "key_results": krs,
        "linked_capability_ids": data.linked_capability_ids or [],
        "status": data.status,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.okrs.insert_one(doc)
    doc.pop("_id", None)
    doc["overall_progress"] = 0
    return doc


async def update_okr(okr_id: str, data: OKRUpdate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    update: dict = {}
    if data.objective is not None:
        update["objective"] = data.objective
    if data.description is not None:
        update["description"] = data.description
    if data.status is not None:
        update["status"] = data.status
    if data.linked_capability_ids is not None:
        update["linked_capability_ids"] = data.linked_capability_ids
    if data.key_results is not None:
        update["key_results"] = [
            {
                "kr_id": kr.kr_id or str(uuid.uuid4()),
                "description": kr.description,
                "target_value": kr.target_value,
                "current_value": kr.current_value,
                "unit": kr.unit,
            }
            for kr in data.key_results
        ]
    if not update:
        raise HTTPException(status_code=422, detail="Aucune donnée à mettre à jour")
    result = await db.okrs.update_one(
        {"okr_id": okr_id, "tenant_id": current_user.tenant_id},
        {"$set": update},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="OKR introuvable")
    okr = await db.okrs.find_one({"okr_id": okr_id}, {"_id": 0})
    krs = okr.get("key_results") or []
    okr["overall_progress"] = round(sum(
        min(kr.get("current_value", 0) / kr.get("target_value", 1) * 100, 100)
        for kr in krs
    ) / len(krs), 1) if krs else 0
    return okr


async def delete_okr(okr_id: str, current_user: TokenPayload) -> None:
    require_write(current_user)
    result = await db.okrs.delete_one(
        {"okr_id": okr_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="OKR introuvable")


# ─── WSJF Auto-calculation ────────────────────────────────────────────────────

async def update_wsjf_criteria(cap_id: str, data: WSJFUpdate, current_user: TokenPayload) -> dict:
    """Met à jour les critères WSJF d'une capability et recalcule le WSJF."""
    require_write(current_user)
    cap = await db.capabilities.find_one(
        {"capability_id": cap_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not cap:
        raise HTTPException(status_code=404, detail="Capability introuvable")

    update: dict = {}
    if data.business_value is not None:
        update["business_value"] = data.business_value
    if data.time_criticality is not None:
        update["time_criticality"] = data.time_criticality
    if data.risk_reduction is not None:
        update["risk_reduction"] = data.risk_reduction
    if data.job_size is not None:
        update["job_size"] = data.job_size

    # Fusionner avec valeurs existantes et recalculer
    merged = {**cap, **update}
    bv = merged.get("business_value")
    tc = merged.get("time_criticality")
    rr = merged.get("risk_reduction")
    js = merged.get("job_size")

    if all(v is not None and v > 0 for v in [bv, tc, rr, js]):
        update["wsjf"] = round((bv + tc + rr) / js, 2)

    await db.capabilities.update_one(
        {"capability_id": cap_id, "tenant_id": current_user.tenant_id},
        {"$set": update},
    )
    result = await db.capabilities.find_one({"capability_id": cap_id}, {"_id": 0})
    return result


# ─── Dashboard Programme ──────────────────────────────────────────────────────

async def get_programme_dashboard(current_user: TokenPayload) -> dict:
    """Tableau de bord agrégé : trains, PIs, capabilities, OKRs, projets."""
    trains = await db.trains.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)

    if not trains:
        return {
            "trains": [], "okrs": [], "top_capabilities": [],
            "summary": {"total_trains": 0, "total_pis": 0, "total_capabilities": 0,
                        "total_okrs": 0, "avg_wsjf": 0}
        }

    train_ids = [t["train_id"] for t in trains]

    # PIs
    pis = await db.pis.find(
        {"train_id": {"$in": train_ids}}, {"_id": 0}
    ).to_list(None)

    # Capabilities avec WSJF
    capabilities = await db.capabilities.find(
        {"train_id": {"$in": train_ids}}, {"_id": 0}
    ).to_list(None)

    # Top capabilities par WSJF
    top_caps = sorted([c for c in capabilities if c.get("wsjf")], key=lambda c: -(c.get("wsjf") or 0))[:10]

    # OKRs avec progrès
    okrs = await db.okrs.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)
    for okr in okrs:
        krs = okr.get("key_results") or []
        okr["overall_progress"] = round(sum(
            min(kr.get("current_value", 0) / kr.get("target_value", 1) * 100, 100)
            for kr in krs
        ) / len(krs), 1) if krs else 0
        # Lier les capabilities
        linked_caps = [c for c in capabilities if c.get("capability_id") in (okr.get("linked_capability_ids") or [])]
        okr["linked_capabilities"] = [{"capability_id": c["capability_id"], "name": c["name"], "status": c["status"]} for c in linked_caps]

    # Sprints
    sprints = await db.sprints.find(
        {"train_id": {"$in": train_ids}}, {"_id": 0}
    ).to_list(None)

    # Répartition capabilities par statut
    caps_by_status = {
        "identified": sum(1 for c in capabilities if c.get("status") == "identified"),
        "committed":  sum(1 for c in capabilities if c.get("status") == "committed"),
        "in_progress":sum(1 for c in capabilities if c.get("status") == "in_progress"),
        "done":       sum(1 for c in capabilities if c.get("status") == "done"),
    }

    # PI velocity summary
    pi_velocity = []
    for pi in pis:
        pi_sprints = [s for s in sprints if s["pi_id"] == pi["pi_id"]]
        planned = sum(s.get("velocity_planned", 0) or 0 for s in pi_sprints)
        actual = sum(s.get("velocity_actual", 0) or 0 for s in pi_sprints if s.get("velocity_actual") is not None)
        pi_velocity.append({
            "pi_id": pi["pi_id"],
            "pi_name": pi["name"],
            "train_id": pi["train_id"],
            "status": pi["status"],
            "velocity_planned": planned,
            "velocity_actual": actual,
            "n_sprints": len(pi_sprints),
        })

    # Enrichir trains avec comptes
    for train in trains:
        train["pi_count"] = sum(1 for p in pis if p["train_id"] == train["train_id"])
        train["cap_count"] = sum(1 for c in capabilities if c["train_id"] == train["train_id"])

    wsjf_values = [c.get("wsjf") for c in capabilities if c.get("wsjf")]
    avg_wsjf = round(sum(wsjf_values) / len(wsjf_values), 1) if wsjf_values else 0

    return {
        "trains": trains,
        "okrs": okrs,
        "top_capabilities": top_caps,
        "pi_velocity": pi_velocity,
        "caps_by_status": caps_by_status,
        "summary": {
            "total_trains": len(trains),
            "total_pis": len(pis),
            "total_sprints": len(sprints),
            "total_capabilities": len(capabilities),
            "total_okrs": len(okrs),
            "avg_wsjf": avg_wsjf,
            "caps_done": caps_by_status["done"],
            "caps_in_progress": caps_by_status["in_progress"],
        },
    }
