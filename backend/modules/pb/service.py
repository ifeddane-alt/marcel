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


async def create_session(data: dict, user: TokenPayload) -> dict:
    require_dsi_write(user)
    if not (data.get("name") or "").strip():
        raise HTTPException(400, "Le nom de la session est requis")
    envelope = float(data.get("envelope") or 0)
    if envelope <= 0:
        raise HTTPException(400, "L'enveloppe doit être positive")
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
    require_dsi_write(user)
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
    return await get_session(session_id, user)


async def delete_session(session_id: str, user: TokenPayload) -> None:
    require_dsi_write(user)
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
    return {
        "session": {**{k: s[k] for k in ("session_id", "name", "envelope", "status", "deadline")},
                    "weighted": weighted, "direction_weight": dw},
        "participation": n,
        "total_avg_allocated": round(sum(i["avg_allocation"] for i in items)),
        "items": items,
    }
