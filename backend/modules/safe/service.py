from fastapi import HTTPException
from datetime import datetime, timezone
from typing import Optional
import uuid
from core.database import db
from core.auth import TokenPayload, require_write, require_admin
from .schemas import (
    TrainCreate, TrainUpdate,
    PICreate, PIUpdate,
    SprintCreate, SprintUpdate,
    CapabilityCreate, CapabilityUpdate,
)


# ─── Trains ──────────────────────────────────────────────────────────────────

async def list_trains(current_user: TokenPayload) -> list:
    trains = await db.trains.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)
    # Enrichir avec le nombre de PIs et d'équipes
    for train in trains:
        pi_count = await db.pis.count_documents({"train_id": train["train_id"]})
        train["pi_count"] = pi_count
    return trains


async def get_train(train_id: str, current_user: TokenPayload) -> dict:
    train = await db.trains.find_one(
        {"train_id": train_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not train:
        raise HTTPException(status_code=404, detail="Train introuvable")
    return train


async def create_train(data: TrainCreate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    doc = {
        "train_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.trains.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_train(train_id: str, data: TrainUpdate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=422, detail="Aucune donnée à mettre à jour")
    result = await db.trains.update_one(
        {"train_id": train_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Train introuvable")
    return await db.trains.find_one({"train_id": train_id}, {"_id": 0})


async def delete_train(train_id: str, current_user: TokenPayload) -> None:
    require_admin(current_user)
    result = await db.trains.delete_one(
        {"train_id": train_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Train introuvable")


async def get_train_overview(train_id: str, current_user: TokenPayload) -> dict:
    """Vue d'ensemble complète d'un train : PIs, sprints, capabilities, équipes."""
    train = await get_train(train_id, current_user)

    pis = await db.pis.find(
        {"train_id": train_id}, {"_id": 0}
    ).sort("start_date", 1).to_list(None)

    sprints = await db.sprints.find(
        {"train_id": train_id}, {"_id": 0}
    ).sort("start_date", 1).to_list(None)

    capabilities = await db.capabilities.find(
        {"train_id": train_id}, {"_id": 0}
    ).sort("wsjf", -1).to_list(None)

    # Enrichir les équipes
    team_ids = train.get("team_ids") or []
    teams = []
    if team_ids:
        teams = await db.teams.find(
            {"team_id": {"$in": team_ids}, "tenant_id": current_user.tenant_id},
            {"_id": 0, "team_id": 1, "name": 1, "manager_resource_id": 1},
        ).to_list(None)

    # Grouper sprints par pi_id
    sprints_by_pi: dict = {}
    for s in sprints:
        sprints_by_pi.setdefault(s["pi_id"], []).append(s)

    # Grouper capabilities par pi_id
    caps_by_pi: dict = {}
    for c in capabilities:
        caps_by_pi.setdefault(c.get("pi_id", "__unassigned__"), []).append(c)

    # Attacher sprints et capabilities à chaque PI
    for pi in pis:
        pi["sprints"] = sprints_by_pi.get(pi["pi_id"], [])
        pi["capabilities"] = caps_by_pi.get(pi["pi_id"], [])

    return {
        "train": train,
        "pis": pis,
        "teams": teams,
        "summary": {
            "total_pis": len(pis),
            "total_sprints": len(sprints),
            "total_capabilities": len(capabilities),
            "total_teams": len(teams),
            "caps_by_status": {
                "identified": sum(1 for c in capabilities if c.get("status") == "identified"),
                "committed": sum(1 for c in capabilities if c.get("status") == "committed"),
                "in_progress": sum(1 for c in capabilities if c.get("status") == "in_progress"),
                "done": sum(1 for c in capabilities if c.get("status") == "done"),
            },
        },
    }


# ─── PIs ─────────────────────────────────────────────────────────────────────

async def list_pis(train_id: Optional[str], current_user: TokenPayload) -> list:
    query: dict = {"tenant_id": current_user.tenant_id}
    if train_id:
        query["train_id"] = train_id
    return await db.pis.find(query, {"_id": 0}).sort("start_date", 1).to_list(None)


async def create_pi(data: PICreate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    # Vérifier que le train appartient au tenant
    train = await db.trains.find_one(
        {"train_id": data.train_id, "tenant_id": current_user.tenant_id}
    )
    if not train:
        raise HTTPException(status_code=404, detail="Train introuvable")
    doc = {
        "pi_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.pis.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_pi(pi_id: str, data: PIUpdate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=422, detail="Aucune donnée à mettre à jour")
    result = await db.pis.update_one(
        {"pi_id": pi_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="PI introuvable")
    return await db.pis.find_one({"pi_id": pi_id}, {"_id": 0})


async def delete_pi(pi_id: str, current_user: TokenPayload) -> None:
    require_admin(current_user)
    result = await db.pis.delete_one(
        {"pi_id": pi_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="PI introuvable")


# ─── Sprints ─────────────────────────────────────────────────────────────────

async def list_sprints(pi_id: Optional[str], train_id: Optional[str], current_user: TokenPayload) -> list:
    query: dict = {"tenant_id": current_user.tenant_id}
    if pi_id:
        query["pi_id"] = pi_id
    elif train_id:
        query["train_id"] = train_id
    return await db.sprints.find(query, {"_id": 0}).sort("start_date", 1).to_list(None)


async def create_sprint(data: SprintCreate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    pi = await db.pis.find_one(
        {"pi_id": data.pi_id, "tenant_id": current_user.tenant_id}
    )
    if not pi:
        raise HTTPException(status_code=404, detail="PI introuvable")
    doc = {
        "sprint_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.sprints.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_sprint(sprint_id: str, data: SprintUpdate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=422, detail="Aucune donnée à mettre à jour")
    result = await db.sprints.update_one(
        {"sprint_id": sprint_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sprint introuvable")
    return await db.sprints.find_one({"sprint_id": sprint_id}, {"_id": 0})


async def delete_sprint(sprint_id: str, current_user: TokenPayload) -> None:
    require_admin(current_user)
    result = await db.sprints.delete_one(
        {"sprint_id": sprint_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sprint introuvable")


# ─── Capabilities ─────────────────────────────────────────────────────────────

async def list_capabilities(
    train_id: Optional[str], pi_id: Optional[str], current_user: TokenPayload
) -> list:
    query: dict = {"tenant_id": current_user.tenant_id}
    if pi_id:
        query["pi_id"] = pi_id
    elif train_id:
        query["train_id"] = train_id
    caps = await db.capabilities.find(query, {"_id": 0}).to_list(None)
    caps.sort(key=lambda c: -(c.get("wsjf") or 0))
    return caps


async def create_capability(data: CapabilityCreate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    train = await db.trains.find_one(
        {"train_id": data.train_id, "tenant_id": current_user.tenant_id}
    )
    if not train:
        raise HTTPException(status_code=404, detail="Train introuvable")
    doc = {
        "capability_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.capabilities.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_capability(cap_id: str, data: CapabilityUpdate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=422, detail="Aucune donnée à mettre à jour")
    result = await db.capabilities.update_one(
        {"capability_id": cap_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Capability introuvable")
    return await db.capabilities.find_one({"capability_id": cap_id}, {"_id": 0})


async def delete_capability(cap_id: str, current_user: TokenPayload) -> None:
    require_write(current_user)
    result = await db.capabilities.delete_one(
        {"capability_id": cap_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Capability introuvable")
