import uuid
import statistics
from datetime import datetime, timezone
from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload
from core.simple_crud import require_dsi_write


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def list_sessions(user: TokenPayload) -> list:
    sessions = await db.pb_sessions.find(
        {"tenant_id": user.tenant_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(None)
    for s in sessions:
        s["votes_count"] = await db.pb_votes.count_documents({"session_id": s["session_id"]})
        my = await db.pb_votes.find_one({"session_id": s["session_id"], "user_id": user.user_id}, {"_id": 0, "vote_id": 1})
        s["my_vote_submitted"] = bool(my)
    return sessions


async def get_session(session_id: str, user: TokenPayload) -> dict:
    s = await db.pb_sessions.find_one(
        {"session_id": session_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not s:
        raise HTTPException(404, "Session introuvable")
    my = await db.pb_votes.find_one(
        {"session_id": session_id, "user_id": user.user_id}, {"_id": 0}
    )
    s["my_vote"] = my
    s["votes_count"] = await db.pb_votes.count_documents({"session_id": session_id})
    return s


def _clean_items(items: list) -> list:
    out = []
    for it in items or []:
        label = (it.get("label") or "").strip()
        if not label:
            continue
        out.append({
            "item_id": it.get("item_id") or str(uuid.uuid4()),
            "label": label,
            "cost": float(it.get("cost") or 0),
            "ref": it.get("ref") or "",
        })
    return out


async def _build_safe_items(pi_id: str, user: TokenPayload) -> tuple:
    from modules.safe import service as safe_service
    pi = await db.pis.find_one({"pi_id": pi_id, "tenant_id": user.tenant_id}, {"_id": 0})
    if not pi:
        raise HTTPException(404, "PI introuvable")
    features = await safe_service.list_pi_features(pi_id, user)
    if len(features) < 2:
        raise HTTPException(400, "Ce PI compte moins de 2 features — affectez d'abord les features au PI depuis Trains SAFe")
    train = await db.trains.find_one({"train_id": pi.get("train_id")}, {"_id": 0, "name": 1})
    items = []
    for f in features:
        suffix = f.get("project_code") or f.get("project_name")
        items.append({
            "item_id": str(uuid.uuid4()),
            "label": f["name"] + (f" · {suffix}" if suffix else ""),
            "cost": float(f.get("cost_eur") or 0),
            "ref": f["task_id"],
            "jh": f.get("jh_planned") or 0,
            "wsjf": f.get("wsjf"),
        })
    meta = {"mode": "safe", "pi_id": pi_id, "pi_name": pi.get("name"),
            "train_id": pi.get("train_id"), "train_name": (train or {}).get("name")}
    return items, meta


async def create_session(data: dict, user: TokenPayload) -> dict:
    require_dsi_write(user, "pb.manage")
    if not (data.get("name") or "").strip():
        raise HTTPException(400, "Le nom de la session est requis")
    envelope = float(data.get("envelope") or 0)
    if envelope <= 0:
        raise HTTPException(400, "L'enveloppe doit être positive")
    meta = {}
    if data.get("pi_id"):
        items, meta = await _build_safe_items(data["pi_id"], user)
    else:
        items = _clean_items(data.get("items"))
        if len(items) < 2:
            raise HTTPException(400, "Au moins 2 candidats sont requis")
    s = {
        "session_id": str(uuid.uuid4()),
        "tenant_id": user.tenant_id,
        "name": data["name"].strip(),
        "envelope": envelope,
        "deadline": data.get("deadline"),
        "status": "open",
        "items": items,
        **meta,
        "weighted": bool(data.get("weighted")),
        "direction_weight": float(data.get("direction_weight") or 2),
        "created_by": user.user_id,
        "created_by_name": user.name,
        "created_at": _now(),
    }
    await db.pb_sessions.insert_one({**s})
    s.pop("_id", None)
    return s


async def update_session(session_id: str, data: dict, user: TokenPayload) -> dict:
    require_dsi_write(user, "pb.manage")
    payload = {}
    if data.get("status") in ("open", "closed", "decided"):
        payload["status"] = data["status"]
    for k in ("name", "deadline"):
        if k in data:
            payload[k] = data[k]
    if "envelope" in data:
        payload["envelope"] = float(data["envelope"] or 0)
    if "items" in data:
        payload["items"] = _clean_items(data["items"])
    payload["updated_at"] = _now()
    res = await db.pb_sessions.update_one(
        {"session_id": session_id, "tenant_id": user.tenant_id}, {"$set": payload}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Session introuvable")
    if payload.get("status") == "decided":
        await _apply_safe_decision(session_id, user)
    return await get_session(session_id, user)


async def _apply_safe_decision(session_id: str, user: TokenPayload):
    """Session SAFe décidée : features retenues → scope sec, reportées → étendu."""
    s = await db.pb_sessions.find_one(
        {"session_id": session_id, "tenant_id": user.tenant_id}, {"_id": 0})
    if not s or s.get("mode") != "safe":
        return
    results = await get_results(session_id, user)
    now = _now()
    sec = etendu = 0
    for it in results["items"]:
        if not it.get("ref"):
            continue
        retained = bool(it.get("retained"))
        await db.tasks.update_one(
            {"task_id": it["ref"], "tenant_id": user.tenant_id},
            {"$set": {"scope_status": "sec" if retained else "etendu",
                      "pb_decision": {"session_id": session_id, "retained": retained, "decided_at": now}}})
        if retained:
            sec += 1
        else:
            etendu += 1
    await db.pb_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"decision": {"applied_at": now, "features_sec": sec, "features_etendu": etendu}}})


async def delete_session(session_id: str, user: TokenPayload) -> None:
    require_dsi_write(user, "pb.manage")
    res = await db.pb_sessions.delete_one({"session_id": session_id, "tenant_id": user.tenant_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Session introuvable")
    await db.pb_votes.delete_many({"session_id": session_id})


async def submit_vote(session_id: str, allocations: dict, user: TokenPayload) -> dict:
    s = await db.pb_sessions.find_one(
        {"session_id": session_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not s:
        raise HTTPException(404, "Session introuvable")
    if s.get("status") != "open":
        raise HTTPException(400, "La session de vote est clôturée")
    valid_ids = {it["item_id"] for it in s.get("items", [])}
    clean = {}
    for item_id, amount in (allocations or {}).items():
        if item_id not in valid_ids:
            continue
        amt = float(amount or 0)
        if amt < 0:
            raise HTTPException(400, "Allocation négative interdite")
        clean[item_id] = amt
    total = sum(clean.values())
    if total > s["envelope"] * 1.001:
        raise HTTPException(400, f"Total réparti ({total:,.0f} €) supérieur à l'enveloppe ({s['envelope']:,.0f} €)")
    u = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "profile_id": 1})
    prof = await db.profiles.find_one({"profile_id": (u or {}).get("profile_id")}, {"_id": 0, "code": 1})
    await db.pb_votes.update_one(
        {"session_id": session_id, "user_id": user.user_id},
        {"$set": {
            "session_id": session_id, "tenant_id": user.tenant_id,
            "user_id": user.user_id, "user_name": user.name,
            "profile_code": (prof or {}).get("code"),
            "allocations": clean, "submitted_at": _now(),
        }, "$setOnInsert": {"vote_id": str(uuid.uuid4())}},
        upsert=True,
    )
    return {"submitted": True, "total_allocated": total}


async def get_results(session_id: str, user: TokenPayload) -> dict:
    s = await db.pb_sessions.find_one(
        {"session_id": session_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not s:
        raise HTTPException(404, "Session introuvable")
    votes = await db.pb_votes.find({"session_id": session_id}, {"_id": 0}).to_list(None)
    n = len(votes)
    weighted = bool(s.get("weighted"))
    dw = float(s.get("direction_weight") or 2)
    weights = [dw if v.get("profile_code") in ("ADMIN", "CIO") else 1.0 for v in votes]
    wsum = sum(weights)
    items = []
    for it in s.get("items", []):
        amounts = [(v.get("allocations") or {}).get(it["item_id"], 0) for v in votes]
        if weighted and wsum > 0:
            avg = sum(a * w for a, w in zip(amounts, weights)) / wsum
        else:
            avg = sum(amounts) / n if n > 0 else 0
        stdev = statistics.pstdev(amounts) if n > 1 else 0
        consensus = None
        if n > 1 and avg > 0:
            cv = stdev / avg
            consensus = "fort" if cv < 0.35 else "moyen" if cv < 0.7 else "faible"
        cost = it.get("cost") or 0
        items.append({
            **it,
            "avg_allocation": round(avg),
            "funding_pct": round(avg / cost * 100) if cost > 0 else None,
            "funded": "financé" if cost > 0 and avg >= cost else "partiel" if avg > 0 else "non_financé",
            "consensus": consensus,
        })
    items.sort(key=lambda x: -x["avg_allocation"])
    # Ligne de coupe : par rang d'allocation, cumul des coûts dans l'enveloppe
    remaining = s["envelope"]
    retained_cost = 0
    for it in items:
        cost = it.get("cost") or 0
        if n > 0 and it["avg_allocation"] > 0 and 0 < cost <= remaining:
            it["retained"] = True
            remaining -= cost
            retained_cost += cost
        else:
            it["retained"] = False
    return {
        "session": {**{k: s.get(k) for k in ("session_id", "name", "envelope", "status", "deadline",
                                             "mode", "pi_id", "pi_name", "train_name", "decision")},
                    "weighted": weighted, "direction_weight": dw},
        "participation": n,
        "total_avg_allocated": round(sum(i["avg_allocation"] for i in items)),
        "retained_count": sum(1 for i in items if i["retained"]),
        "retained_cost": round(retained_cost),
        "items": items,
    }
