"""Invitation PDF d'une instance de gouvernance — ordre du jour prêt à envoyer."""
import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable

from core.database import db

BLUE = colors.HexColor("#2563EB")
DARK = colors.HexColor("#0F172A")
GREY = colors.HexColor("#64748B")

TYPE_LABELS = {
    "copil": "COPIL", "coproj": "COPROJ", "comex": "COMEX",
    "codir": "CODIR", "steering": "Steering Committee", "autre": "Comité",
}
STATUS_LABELS = {"planifie": "Planifié", "tenu": "Tenu", "annule": "Annulé"}
JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre"]


def _date_fr(iso: str) -> str:
    try:
        d = datetime.strptime(str(iso)[:16], "%Y-%m-%dT%H:%M")
        return f"{JOURS[d.weekday()].capitalize()} {d.day} {MOIS[d.month - 1]} {d.year} à {d.strftime('%Hh%M')}"
    except (ValueError, TypeError):
        return str(iso or "—")


async def build_invitation_pdf(instance: dict, tenant_id: str) -> bytes:
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0, "name": 1})
    projects = await db.projects.find(
        {"tenant_id": tenant_id, "project_id": {"$in": instance.get("projects_scope") or []}},
        {"_id": 0, "name": 1, "code": 1},
    ).to_list(None)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=1.6 * cm, bottomMargin=1.6 * cm, leftMargin=1.8 * cm, rightMargin=1.8 * cm,
    )
    ss = getSampleStyleSheet()
    h_brand = ParagraphStyle("brand", parent=ss["Normal"], fontSize=9, textColor=GREY)
    h_title = ParagraphStyle("title", parent=ss["Title"], fontSize=17, textColor=DARK, alignment=0, spaceAfter=4)
    h_sub = ParagraphStyle("sub", parent=ss["Normal"], fontSize=11, textColor=BLUE, spaceAfter=2, fontName="Helvetica-Bold")
    h_section = ParagraphStyle("section", parent=ss["Normal"], fontSize=10.5, textColor=DARK,
                               fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle("body", parent=ss["Normal"], fontSize=9.5, textColor=DARK, leading=14)
    small = ParagraphStyle("small", parent=ss["Normal"], fontSize=8, textColor=GREY)

    type_label = TYPE_LABELS.get(instance.get("type"), "Comité")
    story = [
        Paragraph(f"MARCEL — {(tenant or {}).get('name', '')}", h_brand),
        Spacer(1, 6),
        HRFlowable(width="100%", thickness=1.2, color=BLUE),
        Spacer(1, 12),
        Paragraph("Invitation", h_sub),
        Paragraph(instance.get("name", ""), h_title),
        Spacer(1, 4),
        Paragraph(
            f"<b>{type_label}</b> &nbsp;·&nbsp; {_date_fr(instance.get('date_scheduled'))}"
            f" &nbsp;·&nbsp; Statut : {STATUS_LABELS.get(instance.get('status'), 'Planifié')}",
            body,
        ),
    ]

    # Ordre du jour
    agenda = instance.get("agenda") or []
    story.append(Paragraph("Ordre du jour", h_section))
    if agenda:
        rows = [["#", "Sujet", "Intervenant", "Durée"]]
        total = 0
        for i, item in enumerate(agenda, start=1):
            dur = int(item.get("duration_min") or 0)
            total += dur
            rows.append([
                str(i),
                Paragraph(item.get("title", ""), body),
                item.get("presenter") or "—",
                f"{dur} min" if dur else "—",
            ])
        if total:
            rows.append(["", Paragraph("<b>Durée totale</b>", body), "", f"{total} min"])
        t = Table(rows, colWidths=[0.9 * cm, 9.6 * cm, 4 * cm, 2.2 * cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(t)
    else:
        story.append(Paragraph("Ordre du jour à définir.", body))

    # Participants
    attendees = instance.get("attendees") or []
    story.append(Paragraph("Participants", h_section))
    if attendees:
        for a in attendees:
            story.append(Paragraph(f"•&nbsp;&nbsp;{a}", body))
    else:
        story.append(Paragraph("À confirmer.", body))

    # Projets en périmètre
    if projects:
        story.append(Paragraph("Projets en périmètre", h_section))
        for p in projects:
            code = f"{p.get('code')} — " if p.get("code") else ""
            story.append(Paragraph(f"•&nbsp;&nbsp;{code}{p.get('name', '')}", body))

    story += [
        Spacer(1, 20),
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1")),
        Spacer(1, 6),
        Paragraph(f"Invitation générée par MARCEL le {datetime.now().strftime('%d/%m/%Y à %Hh%M')}", small),
    ]
    doc.build(story)
    return buf.getvalue()
