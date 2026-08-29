"""Endpoints publics du site vitrine — sans authentification."""
import logging
import html
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from core.limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["public_site"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ContactRequest(BaseModel):
    name: str
    company: str
    email: str
    message: str = ""
    locale: str = "fr"
    website: str = ""  # honeypot anti-spam


@router.post("/public/contact", status_code=201)
@limiter.limit("5/minute")
async def submit_contact(request: Request, data: ContactRequest):
    if data.website.strip():
        return {"status": "ok"}  # bot piégé par le honeypot — on ignore silencieusement
    name = data.name.strip()[:200]
    company = data.company.strip()[:200]
    email = data.email.strip()[:200]
    if not name or not company or not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Champs invalides")
    doc = {
        "request_id": str(uuid.uuid4()),
        "name": name,
        "company": company,
        "email": email,
        "message": data.message.strip()[:5000],
        "locale": data.locale if data.locale in ("fr", "en") else "fr",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "new",
    }
    await db.demo_requests.insert_one(doc)
    logger.info("[PublicContact] Demande de démo reçue : %s (%s)", company, email)
    await _notify(doc)
    return {"status": "ok", "request_id": doc["request_id"]}


async def _notify(doc: dict) -> None:
    """Notification email si Resend + destinataire configurés (fire-and-forget)."""
    import os
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    to_email = os.environ.get("CONTACT_NOTIFY_EMAIL", "").strip()
    if not api_key or not to_email:
        return
    try:
        import asyncio
        import resend
        resend.api_key = api_key
        sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
        body_html = (
            f"<h2>Nouvelle demande de démo MARCEL</h2>"
            f"<p><b>Nom :</b> {html.escape(doc['name'])}<br><b>Société :</b> {html.escape(doc['company'])}<br>"
            f"<b>Email :</b> {html.escape(doc['email'])}<br><b>Langue :</b> {html.escape(doc['locale'])}</p>"
            f"<p><b>Message :</b><br>{html.escape(doc['message'] or '—')}</p>"
        )
        await asyncio.to_thread(resend.Emails.send, {
            "from": sender,
            "to": [to_email],
            "subject": f"[MARCEL] Demande de démo — {doc['company'][:120]}",
            "html": body_html,
        })
    except Exception as exc:
        logger.warning("[PublicContact] Échec notification email : %s", exc)
