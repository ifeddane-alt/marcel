"""Webhook utility — fire-and-forget HTTP POST to configured URL."""
import asyncio
import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)


async def fire_webhook(webhook_url: str, event: str, payload: dict) -> None:
    """Envoie un POST asynchrone non-bloquant à l'URL configurée."""
    if not webhook_url:
        return
    body = {
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **payload,
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(webhook_url, json=body)
            logger.info("[Webhook] %s → %s HTTP %d", event, webhook_url[:60], resp.status_code)
    except Exception as exc:
        logger.warning("[Webhook] Échec %s → %s : %s", event, webhook_url[:60], exc)


async def get_tenant_webhook_url(tenant_id: str, event: str | None = None) -> str | None:
    """Récupère l'URL webhook configurée pour un tenant (stockée dans tenants.settings.webhook)."""
    from core.database import db
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0, "settings": 1})
    if not tenant:
        return None
    wh = (tenant.get("settings") or {}).get("webhook") or {}
    url = wh.get("url", "").strip()
    enabled = wh.get("enabled", False)
    if event and wh.get("events") and event not in wh["events"]:
        return None
    return url if (enabled and url) else None
