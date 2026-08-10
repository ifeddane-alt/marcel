"""Contrats ressources/fournisseurs arrivant à expiration — digest email par tenant, avec déduplication."""
import logging
from datetime import date, datetime, timezone

logger = logging.getLogger(__name__)

THRESHOLDS = [90, 60, 30, 7]


def _fmt_fr(iso: str) -> str:
    try:
        return date.fromisoformat(iso).strftime("%d/%m/%Y")
    except ValueError:
        return iso


async def check_expiring_contracts_for_tenant(tenant_id: str) -> int:
    from core.database import db
    from core.email_alerts import get_tenant_email_alerts_config, send_alert_email

    cfg = await get_tenant_email_alerts_config(tenant_id)
    if not cfg or "contract.expiring" not in (cfg.get("events") or []):
        return 0

    today = date.today()
    resources = await db.resources.find(
        {"tenant_id": tenant_id, "contract_end": {"$nin": [None, ""]}}, {"_id": 0}
    ).to_list(None)

    pending = []
    for r in resources:
        raw = str(r.get("contract_end"))[:10]
        try:
            end = date.fromisoformat(raw)
        except ValueError:
            continue
        days_left = (end - today).days
        if days_left < 0 or days_left > THRESHOLDS[0]:
            continue
        threshold = min(t for t in THRESHOLDS if days_left <= t)
        key = {
            "tenant_id": tenant_id,
            "resource_id": r.get("resource_id"),
            "contract_end": raw,
            "threshold": threshold,
        }
        if await db.contract_alerts_sent.find_one(key):
            continue
        pending.append((r, days_left, raw, key))

    if not pending:
        return 0

    pending.sort(key=lambda x: x[1])
    rows = []
    for r, days_left, raw, _ in pending:
        origin = r.get("vendor") or ("Interne" if r.get("resource_type") == "interne" else "—")
        detail = f"fin le {_fmt_fr(raw)} · J-{days_left} · {origin}"
        if r.get("contract_ref"):
            detail += f" · réf {r['contract_ref']}"
        rows.append((r.get("name", "—"), detail))

    sent = await send_alert_email(
        tenant_id, "contract.expiring",
        f"{len(pending)} contrat(s) arrivant à expiration", rows,
    )
    if not sent:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    for _, _, _, key in pending:
        await db.contract_alerts_sent.update_one(key, {"$set": {**key, "sent_at": now}}, upsert=True)
    return len(pending)


async def run_contract_alerts_all_tenants() -> dict:
    from core.database import db
    tenants = await db.tenants.find({}, {"_id": 0, "tenant_id": 1}).to_list(None)
    results = {}
    for t in tenants:
        try:
            results[t["tenant_id"]] = await check_expiring_contracts_for_tenant(t["tenant_id"])
        except Exception as exc:
            logger.error("[ContractAlerts] Erreur tenant %s : %s", t["tenant_id"], exc)
            results[t["tenant_id"]] = -1
    total = sum(v for v in results.values() if v > 0)
    logger.info("[ContractAlerts] Vérification terminée — %s alerte(s) contrat envoyée(s)", total)
    return {"tenants": results, "total_alerts": total}
