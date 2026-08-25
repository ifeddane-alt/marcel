"""Rapport IA consolidé du portefeuille + diffusion hebdomadaire planifiée."""
import os
import io
import json
import uuid
import logging
from datetime import datetime, timezone, date, timedelta
from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload

logger = logging.getLogger(__name__)

_SYSTEM = (
    "Tu es un directeur PMO qui rédige la synthèse hebdomadaire du portefeuille projets pour le COMEX. "
    "Réponds STRICTEMENT en JSON avec les clés : synthese (string, 4-6 phrases), points_cles (liste de strings), "
    "alertes (liste de strings), recommandations (liste de strings), tendance ('amelioration'|'stable'|'degradation'). "
    "Français professionnel, chiffres exacts issus des données, aucune invention."
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _collect_portfolio_data(tenant_id: str) -> dict:
    projects = await db.projects.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(None)
    pids = [p["project_id"] for p in projects]
    today = date.today().isoformat()
    horizon = (date.today() + timedelta(days=30)).isoformat()
    late_ms, upcoming_ms = {}, []
    async for m in db.milestones.find({"project_id": {"$in": pids}, "status": {"$nin": ["achieved", "done"]}}, {"_id": 0}):
        d = (m.get("date_forecast") or m.get("date_baseline") or "")[:10]
        if d and d < today:
            late_ms[m["project_id"]] = late_ms.get(m["project_id"], 0) + 1
        elif d and d <= horizon:
            upcoming_ms.append({"jalon": m.get("name"), "date": d})
    crit_risks = await db.risks.find(
        {"tenant_id": tenant_id, "status": {"$in": ["identifié", "en cours"]}, "criticality": {"$gte": 15}},
        {"_id": 0, "title": 1, "project_id": 1},
    ).to_list(None)
    pmap = {p["project_id"]: p.get("name") for p in projects}
    rag = {"green": 0, "orange": 0, "red": 0}
    rows = []
    for p in projects:
        if p.get("status_rag") in rag:
            rag[p["status_rag"]] += 1
        rows.append({
            "projet": p.get("name"), "code": p.get("code"), "rag": p.get("status_rag"),
            "methodologie": p.get("methodology"),
            "budget": p.get("budget_total") or 0, "consomme": p.get("budget_consumed") or 0,
            "eac": p.get("eac") or p.get("budget_forecast"),
            "jalons_en_retard": late_ms.get(p["project_id"], 0),
        })
    run_acts = await db.run_activities.find({"tenant_id": tenant_id}, {"_id": 0, "budget_annual": 1, "budget_consumed": 1}).to_list(None)
    return {
        "date": today,
        "nb_projets": len(projects),
        "repartition_rag": rag,
        "budget_total": sum(p.get("budget_total") or 0 for p in projects),
        "budget_consomme": sum(p.get("budget_consumed") or 0 for p in projects),
        "budget_run_annuel": sum(a.get("budget_annual") or 0 for a in run_acts),
        "projets": rows,
        "risques_critiques": [f"{r.get('title')} ({pmap.get(r.get('project_id'), '?')})" for r in crit_risks[:10]],
        "jalons_30_jours": upcoming_ms[:10],
    }


async def generate_portfolio_report(tenant_id: str, generated_by: str, indicators: list | None = None) -> dict:
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(500, "Clé LLM non configurée")
    data = await _collect_portfolio_data(tenant_id)
    if indicators:
        data["indicateurs_pilotage_selectionnes"] = indicators

    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=api_key,
        session_id=f"ptf-report-{uuid.uuid4()}",
        system_message=_SYSTEM,
    ).with_model("openai", os.environ.get("AGENT_MODEL", "gpt-5.4"))
    try:
        raw = await chat.send_message(UserMessage(
            text=f"Rédige la synthèse portefeuille du {date.today().strftime('%d/%m/%Y')} :\n"
                 f"{json.dumps(data, ensure_ascii=False, default=str)}"))
    except Exception as e:
        raise HTTPException(502, f"Échec de la génération IA : {str(e)[:150]}")

    text = str(raw).strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        content = json.loads(text.strip())
    except json.JSONDecodeError:
        raise HTTPException(502, "Réponse IA illisible — réessayez")

    doc = {
        "report_id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "week_label": f"Semaine {date.today().isocalendar()[1]} — {date.today().strftime('%d/%m/%Y')}",
        "content": {
            "synthese": content.get("synthese") or "",
            "points_cles": content.get("points_cles") or [],
            "alertes": content.get("alertes") or [],
            "recommandations": content.get("recommandations") or [],
            "tendance": content.get("tendance") or "stable",
        },
        "snapshot": data,
        "generated_by": generated_by,
        "created_at": _now(),
    }
    await db.ai_portfolio_reports.insert_one({**doc})
    doc.pop("_id", None)
    return doc


async def list_portfolio_reports(tenant_id: str) -> list:
    return await db.ai_portfolio_reports.find(
        {"tenant_id": tenant_id}, {"_id": 0, "snapshot": 0}
    ).sort("created_at", -1).to_list(20)


async def get_portfolio_report(report_id: str, tenant_id: str) -> dict:
    r = await db.ai_portfolio_reports.find_one(
        {"report_id": report_id, "tenant_id": tenant_id}, {"_id": 0}
    )
    if not r:
        raise HTTPException(404, "Rapport introuvable")
    return r


def build_portfolio_pdf(report: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.colors import HexColor
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm)
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Title"], textColor=HexColor("#352c6e"), fontSize=17, spaceAfter=2)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=HexColor("#26243a"), fontSize=12, spaceBefore=10)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=9.5, leading=13)
    c = report.get("content", {})
    snap = report.get("snapshot", {})
    rag = snap.get("repartition_rag", {})
    trend = {"amelioration": "En amélioration", "stable": "Stable", "degradation": "En dégradation"}.get(c.get("tendance"), "Stable")
    els = [
        Paragraph("Rapport IA — Portefeuille DSI", h1),
        Paragraph(f"{report.get('week_label')} — tendance : <b>{trend}</b>", body),
        Spacer(1, 4),
        Paragraph(f"{snap.get('nb_projets', 0)} projets · "
                  f"vert {rag.get('green', 0)} / orange {rag.get('orange', 0)} / rouge {rag.get('red', 0)} · "
                  f"budget {snap.get('budget_total', 0):,.0f} € (consommé {snap.get('budget_consomme', 0):,.0f} €)", body),
        Paragraph("Synthèse", h2),
        Paragraph(c.get("synthese", ""), body),
    ]
    for title, key in (("Points clés", "points_cles"), ("Alertes", "alertes"), ("Recommandations", "recommandations")):
        items = c.get(key) or []
        if items:
            els.append(Paragraph(title, h2))
            for it in items:
                els.append(Paragraph(f"• {it}", body))
    els.append(Spacer(1, 8))
    els.append(Paragraph(f"Généré par {report.get('generated_by')} — MARCEL", ParagraphStyle(
        "foot", parent=body, fontSize=7.5, textColor=HexColor("#8a87a0"))))
    doc.build(els)
    return buf.getvalue()


async def run_weekly_portfolio_reports():
    """Diffusion hebdomadaire planifiée : génération + notification + email (si Resend configuré)."""
    if os.environ.get("AI_WEEKLY_REPORT_ENABLED", "true").lower() != "true":
        return
    from modules.notifications.service import create_notification
    from core.email import send_email, is_email_enabled
    import base64
    tenant_ids = await db.tenants.distinct("tenant_id")
    for tid in tenant_ids:
        try:
            if await db.projects.count_documents({"tenant_id": tid}) == 0:
                continue
            report = await generate_portfolio_report(tid, "Diffusion hebdomadaire automatique")
            admins = await db.users.find(
                {"tenant_id": tid, "role": {"$in": ["TENANT_ADMIN", "PMO_USER"]}, "is_active": {"$ne": False}},
                {"_id": 0, "user_id": 1, "email": 1},
            ).to_list(None)
            for u in admins:
                await create_notification(tid, u["user_id"], "ai_portfolio_report",
                                          f"Le rapport IA hebdomadaire du portefeuille ({report['week_label']}) est disponible.",
                                          metadata={"report_id": report["report_id"]})
            if is_email_enabled():
                pdf = build_portfolio_pdf(report)
                await send_email(
                    [u["email"] for u in admins if u.get("email")],
                    f"MARCEL — Rapport IA portefeuille · {report['week_label']}",
                    f"<p>Bonjour,</p><p>Le rapport IA hebdomadaire du portefeuille est disponible "
                    f"(tendance : {report['content'].get('tendance')}).</p>"
                    f"<p>{report['content'].get('synthese', '')}</p><p>— MARCEL</p>",
                    attachments=[{"filename": "rapport_portefeuille.pdf",
                                  "content": base64.b64encode(pdf).decode()}],
                )
            logger.info("[WeeklyReport] Rapport portefeuille généré pour %s", tid)
        except Exception as e:
            logger.error("[WeeklyReport] Échec tenant %s : %s", tid, e)
