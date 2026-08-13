import os
import asyncio
import logging

logger = logging.getLogger(__name__)


def is_email_enabled() -> bool:
    return bool(os.environ.get("RESEND_API_KEY", "").strip())


async def send_email(to: list, subject: str, html: str, attachments: list | None = None) -> bool:
    """Envoi Resend non bloquant — no-op silencieux si la clé n'est pas configurée."""
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key or not to:
        logger.info("[Email] Envoi ignoré (clé absente ou destinataires vides) : %s", subject)
        return False
    import resend
    resend.api_key = api_key
    params = {
        "from": os.environ.get("SENDER_EMAIL", "onboarding@resend.dev"),
        "to": to,
        "subject": subject,
        "html": html,
    }
    if attachments:
        params["attachments"] = attachments
    try:
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info("[Email] Envoyé : %s → %s", subject, to)
        return True
    except Exception as e:
        logger.error("[Email] Échec '%s' : %s", subject, e)
        return False
