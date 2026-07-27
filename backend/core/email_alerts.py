"""Alertes email — envoi Resend fire-and-forget sur événements projet."""
import asyncio
import logging
import os

logger = logging.getLogger(__name__)

EVENT_LABELS = {
    "project.created": "Projet créé",
    "project.updated": "Projet modifié",
}


async def get_tenant_email_alerts_config(tenant_id: str) -> dict | None:
    from core.database import db
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0, "settings": 1})
    if not tenant:
        return None
    cfg = (tenant.get("settings") or {}).get("email_alerts") or {}
    if not cfg.get("enabled") or not cfg.get("recipients"):
        return None
    return cfg


def _build_html(event: str, project: dict) -> str:
    label = EVENT_LABELS.get(event, event)
    rows = [
        ("Projet", project.get("name", "—")),
        ("Statut", project.get("status", "—")),
        ("RAG", project.get("status_rag", "—")),
        ("Événement", event),
    ]
    tr = "".join(
        f'<tr><td style="padding:6px 12px;color:#64748b;font-size:13px">{k}</td>'
        f'<td style="padding:6px 12px;font-size:13px;font-weight:600">{v}</td></tr>'
        for k, v in rows
    )
    return (
        '<div style="font-family:Arial,sans-serif;max-width:520px">'
        f'<h2 style="color:#0B2545;font-size:18px">MARCEL — {label}</h2>'
        f'<table style="border-collapse:collapse;background:#f8fafc;border-radius:8px">{tr}</table>'
        '<p style="color:#94a3b8;font-size:11px;margin-top:16px">Alerte automatique envoyée par MARCEL PPM.</p>'
        "</div>"
    )


async def send_project_event_email(tenant_id: str, event: str, project: dict) -> None:
    """Envoi non-bloquant d'une alerte email si configurée pour ce tenant/événement."""
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        return
    cfg = await get_tenant_email_alerts_config(tenant_id)
    if not cfg or event not in (cfg.get("events") or []):
        return
    import resend
    resend.api_key = api_key
    sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    label = EVENT_LABELS.get(event, event)
    params = {
        "from": sender,
        "to": cfg["recipients"],
        "subject": f"[MARCEL] {label} : {project.get('name', '')}",
        "html": _build_html(event, project),
    }
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        logger.info("[EmailAlert] %s envoyé → %s (id=%s)", event, cfg["recipients"], email.get("id"))
    except Exception as exc:
        logger.warning("[EmailAlert] Échec %s : %s", event, exc)
