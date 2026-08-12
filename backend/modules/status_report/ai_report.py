"""Rapport de statut hebdomadaire rédigé par IA + export PDF."""
import io
import json
import os
import uuid
from datetime import datetime, timezone, date

from dotenv import load_dotenv
from fastapi import HTTPException
from core.auth import TokenPayload
from core.database import db

load_dotenv()

_SYSTEM = (
    "Tu es un directeur de projet senior dans une DSI française. Tu rédiges des rapports de statut "
    "hebdomadaires factuels, synthétiques et orientés décision pour un comité de pilotage. "
    "Tu t'appuies UNIQUEMENT sur les données fournies, sans rien inventer. Ton style est professionnel, "
    "direct, en français. Tu réponds STRICTEMENT en JSON valide, sans balise markdown, au format : "
    '{"synthese": "5 à 8 lignes de synthèse exécutive", "faits_marquants": ["3 à 5 points"], '
    '"alertes": ["points de vigilance, ou liste vide"], "prochaines_etapes": ["2 à 4 actions"], '
    '"tendance": "amelioration" | "stable" | "degradation"}'
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _collect_project_data(project_id: str, tenant_id: str) -> dict:
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": tenant_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(404, "Projet introuvable")

    today = date.today().isoformat()
    milestones = await db.milestones.find({"project_id": project_id}, {"_id": 0}).to_list(None)
    late = [m for m in milestones
            if (m.get("date_forecast") or "")[:10] < today
            and m.get("status") not in ("achieved", "done")]
    upcoming = sorted(
        [m for m in milestones if (m.get("date_forecast") or "")[:10] >= today
         and m.get("status") not in ("achieved", "done")],
        key=lambda m: m.get("date_forecast") or "",
    )[:5]
    achieved = sum(1 for m in milestones if m.get("status") in ("achieved", "done"))

    risks = await db.risks.find(
        {"project_id": project_id}, {"_id": 0}
    ).sort("criticality", -1).limit(5).to_list(5)

    tasks = await db.tasks.find(
        {"project_id": project_id, "tenant_id": tenant_id}, {"_id": 0, "status": 1}
    ).to_list(None)
    tasks_done = sum(1 for t in tasks if t.get("status") == "done")

    return {
        "project": project,
        "data": {
            "nom": project.get("name"),
            "code": project.get("code"),
            "statut_rag": project.get("status_rag"),
            "methodologie": project.get("methodology"),
            "periode": f"{(project.get('start_date') or '')[:10]} → {(project.get('end_date_forecast') or '')[:10]}",
            "budget": {
                "total": project.get("budget_total"),
                "consomme": project.get("budget_consumed"),
                "atterrissage": project.get("budget_forecast"),
            },
            "jalons": {
                "atteints": achieved,
                "total": len(milestones),
                "en_retard": [{"nom": m.get("name"), "prevu": (m.get("date_forecast") or "")[:10]} for m in late[:5]],
                "a_venir": [{"nom": m.get("name"), "prevu": (m.get("date_forecast") or "")[:10]} for m in upcoming],
            },
            "taches": {"faites": tasks_done, "total": len(tasks)},
            "risques_principaux": [
                {"titre": r.get("title") or r.get("name"), "criticite": r.get("criticality"),
                 "statut": r.get("status")} for r in risks
            ],
            "description": (project.get("description") or "")[:400],
        },
    }


async def generate_ai_report(project_id: str, user: TokenPayload) -> dict:
    """Génère le rapport de statut via LLM et le stocke."""
    collected = await _collect_project_data(project_id, user.tenant_id)
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(500, "Clé LLM non configurée")

    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=api_key,
        session_id=f"ai-report-{uuid.uuid4()}",
        system_message=_SYSTEM,
    ).with_model("openai", "gpt-5.4")

    prompt = (
        f"Rédige le rapport de statut hebdomadaire du projet à la date du "
        f"{date.today().strftime('%d/%m/%Y')} à partir de ces données :\n"
        f"{json.dumps(collected['data'], ensure_ascii=False, default=str)}"
    )
    try:
        raw = await chat.send_message(UserMessage(text=prompt))
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
        "project_id": project_id,
        "tenant_id": user.tenant_id,
        "project_name": collected["project"].get("name"),
        "project_code": collected["project"].get("code"),
        "status_rag": collected["project"].get("status_rag"),
        "week_label": f"Semaine {date.today().isocalendar()[1]} — {date.today().strftime('%d/%m/%Y')}",
        "content": {
            "synthese": content.get("synthese") or "",
            "faits_marquants": content.get("faits_marquants") or [],
            "alertes": content.get("alertes") or [],
            "prochaines_etapes": content.get("prochaines_etapes") or [],
            "tendance": content.get("tendance") or "stable",
        },
        "snapshot": collected["data"],
        "generated_by": user.name,
        "created_at": _now(),
    }
    await db.ai_status_reports.insert_one({**doc})
    return doc


async def list_ai_reports(project_id: str, user: TokenPayload) -> list:
    return await db.ai_status_reports.find(
        {"project_id": project_id, "tenant_id": user.tenant_id},
        {"_id": 0, "snapshot": 0},
    ).sort("created_at", -1).limit(20).to_list(20)


async def get_ai_report(project_id: str, report_id: str, user: TokenPayload) -> dict:
    doc = await db.ai_status_reports.find_one(
        {"report_id": report_id, "project_id": project_id, "tenant_id": user.tenant_id},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(404, "Rapport introuvable")
    return doc


RAG_COLORS = {"green": "#3f8a34", "orange": "#d98c1f", "red": "#cc4f45"}
TREND_LABELS = {"amelioration": "En amélioration", "stable": "Stable", "degradation": "En dégradation"}


def build_ai_report_pdf(report: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"Rapport de statut — {report.get('project_name')}")

    ink = HexColor("#26243a")
    muted = HexColor("#8a87a0")
    accent = HexColor("#352c6e")
    s_title = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=17, textColor=ink, spaceAfter=2)
    s_sub = ParagraphStyle("s", fontName="Helvetica", fontSize=9.5, textColor=muted, spaceAfter=10)
    s_h = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=11.5, textColor=accent,
                         spaceBefore=12, spaceAfter=5)
    s_body = ParagraphStyle("b", fontName="Helvetica", fontSize=10, textColor=ink, leading=14.5)
    s_li = ParagraphStyle("li", parent=s_body, leftIndent=10, bulletIndent=2, spaceAfter=2.5)

    c = report["content"]
    snap = report.get("snapshot") or {}
    rag = report.get("status_rag") or "green"
    story = [
        Paragraph(f"Rapport de statut — {report.get('project_name', '')}", s_title),
        Paragraph(
            f"{report.get('project_code') or ''} · {report.get('week_label', '')} · "
            f"Généré par IA le {(report.get('created_at') or '')[:10]} · "
            f"<font color='{RAG_COLORS.get(rag, '#3f8a34')}'><b>RAG {rag.upper()}</b></font> · "
            f"Tendance : <b>{TREND_LABELS.get(c.get('tendance'), 'Stable')}</b>", s_sub),
        HRFlowable(width="100%", thickness=1, color=HexColor("#e8e6f0")),
    ]

    budget = snap.get("budget") or {}
    jalons = snap.get("jalons") or {}
    taches = snap.get("taches") or {}
    def eur(v):
        return f"{v:,.0f} €".replace(",", " ") if isinstance(v, (int, float)) else "—"
    kpi = Table([[
        Paragraph(f"<b>Budget</b><br/>{eur(budget.get('consomme'))} / {eur(budget.get('total'))}", s_body),
        Paragraph(f"<b>Jalons</b><br/>{jalons.get('atteints', 0)} / {jalons.get('total', 0)} atteints"
                  f" · {len(jalons.get('en_retard') or [])} en retard", s_body),
        Paragraph(f"<b>Tâches</b><br/>{taches.get('faites', 0)} / {taches.get('total', 0)} terminées", s_body),
    ]], colWidths=[58 * mm, 58 * mm, 58 * mm])
    kpi.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#f7f6fb")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#e8e6f0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#e8e6f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ]))
    story += [Spacer(1, 8), kpi]

    story += [Paragraph("Synthèse exécutive", s_h), Paragraph(c.get("synthese", ""), s_body)]
    if c.get("faits_marquants"):
        story.append(Paragraph("Faits marquants", s_h))
        story += [Paragraph(f, s_li, bulletText="•") for f in c["faits_marquants"]]
    if c.get("alertes"):
        story.append(Paragraph("Alertes et points de vigilance", s_h))
        story += [Paragraph(a, s_li, bulletText="•") for a in c["alertes"]]
    if c.get("prochaines_etapes"):
        story.append(Paragraph("Prochaines étapes", s_h))
        story += [Paragraph(p, s_li, bulletText="•") for p in c["prochaines_etapes"]]

    story += [Spacer(1, 14),
              HRFlowable(width="100%", thickness=0.5, color=HexColor("#e8e6f0")),
              Paragraph("Rapport généré automatiquement par MARCEL — données issues du portefeuille en temps réel.",
                        ParagraphStyle("f", fontName="Helvetica-Oblique", fontSize=8, textColor=muted, spaceBefore=4))]

    doc.build(story)
    buf.seek(0)
    return buf.read()
