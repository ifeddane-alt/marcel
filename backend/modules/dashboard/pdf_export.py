"""Export PDF du dashboard — rapport hebdomadaire portefeuille prêt pour le COMEX."""
import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable,
)

from core.database import db
from core.auth import TokenPayload
from . import service

BLUE = colors.HexColor("#0052CC")
DARK = colors.HexColor("#0F172A")
GREY = colors.HexColor("#64748B")
RAG_COLORS = {
    "green": colors.HexColor("#059669"),
    "orange": colors.HexColor("#D97706"),
    "red": colors.HexColor("#DC2626"),
}
RAG_FILLS = {
    "green": colors.HexColor("#D1FAE5"),
    "orange": colors.HexColor("#FEF3C7"),
    "red": colors.HexColor("#FEE2E2"),
}
RAG_FR = {"green": "VERT", "orange": "ORANGE", "red": "ROUGE"}


def _euro(v) -> str:
    return f"{int(v or 0):,} €".replace(",", " ")


def _date_fr(iso) -> str:
    try:
        return datetime.strptime(str(iso)[:10], "%Y-%m-%d").strftime("%d/%m/%Y")
    except (ValueError, TypeError):
        return str(iso or "—")


def _table_style(header_cols: int) -> list:
    return [
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]


async def export_dashboard_pdf(current_user: TokenPayload) -> bytes:
    tenant = await db.tenants.find_one(
        {"tenant_id": current_user.tenant_id}, {"_id": 0, "name": 1}
    )
    tenant_name = (tenant or {}).get("name", "")

    summary = await service.get_summary(current_user)
    cxo = await service.get_cxo(current_user)
    top_risks = (await service.get_top_risks(current_user))[:5]
    extras = await service.get_extras(current_user)

    from modules.teams import service as teams_service
    team_load = await teams_service.get_capacity_heatmap(0, current_user)

    styles = getSampleStyleSheet()
    h_title = ParagraphStyle("t", parent=styles["Heading1"], fontSize=17,
                             textColor=BLUE, spaceAfter=1)
    h_sub = ParagraphStyle("s", parent=styles["Normal"], fontSize=9, textColor=GREY)
    h_section = ParagraphStyle("sec", parent=styles["Heading2"], fontSize=11,
                               textColor=DARK, spaceBefore=12, spaceAfter=5)
    p_cell = ParagraphStyle("pc", parent=styles["Normal"], fontSize=8, leading=10)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=1.4 * cm, rightMargin=1.4 * cm,
        topMargin=1.4 * cm, bottomMargin=1.6 * cm,
        title="Rapport Portefeuille COMEX",
    )
    story = []

    # ── En-tête ────────────────────────────────────────────────────────────
    story.append(Paragraph("Rapport Portefeuille — COMEX", h_title))
    story.append(Paragraph(
        f"{tenant_name} · Synthèse hebdomadaire du {datetime.now().strftime('%d/%m/%Y')} · Générée par MARCEL",
        h_sub,
    ))
    story.append(Spacer(1, 0.25 * cm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=BLUE))

    # ── KPIs clés ──────────────────────────────────────────────────────────
    story.append(Paragraph("Indicateurs clés du portefeuille", h_section))
    kpis = cxo["kpis"]
    bud = cxo["budget"]
    rag = cxo["rag"]
    kpi_rows = [
        ["Projets", "Programmes", "Risques critiques", "Jalons à l'heure", "Conso. budget"],
        [
            str(kpis["total_projects"]),
            str(kpis["total_programs"]),
            str(kpis["critical_risks"]),
            f"{cxo['milestones']['on_time_rate']} %",
            f"{bud['consumption_rate']} %",
        ],
    ]
    kt = Table(kpi_rows, colWidths=[3.65 * cm] * 5)
    kt.setStyle(TableStyle(_table_style(5) + [
        ("FONTSIZE", (0, 1), (-1, 1), 14),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 1), (-1, 1), DARK),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 1), (-1, 1), 8),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
    ]))
    story.append(kt)
    story.append(Spacer(1, 0.2 * cm))

    # Météo RAG + budget
    rag_row = [[
        f"● {rag['green']} projets VERTS",
        f"● {rag['orange']} projets ORANGE",
        f"● {rag['red']} projets ROUGES",
        f"Budget : {_euro(bud['total'])}",
        f"Forecast : {_euro(bud['forecast'])}",
    ]]
    rt = Table(rag_row, colWidths=[3.65 * cm] * 5)
    rt.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, 0), RAG_COLORS["green"]),
        ("TEXTCOLOR", (1, 0), (1, 0), RAG_COLORS["orange"]),
        ("TEXTCOLOR", (2, 0), (2, 0), RAG_COLORS["red"]),
        ("TEXTCOLOR", (3, 0), (4, 0), GREY),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
    ]))
    story.append(rt)

    # ── Top projets par budget ─────────────────────────────────────────────
    story.append(Paragraph("Top 5 projets par budget", h_section))
    projects_all = await db.projects.find(
        service._project_query(current_user), {"_id": 0}
    ).to_list(None)
    top_projects = sorted(projects_all, key=lambda p: -(p.get("budget_total") or 0))[:5]
    proj_data = [["Projet", "RAG", "Budget", "Consommé", "Forecast"]]
    rag_cells = []
    for i, p in enumerate(top_projects, 1):
        proj_data.append([
            Paragraph(str(p.get("name") or "—")[:70], p_cell),
            RAG_FR.get(p.get("status_rag"), "—"),
            _euro(p.get("budget_total")),
            _euro(p.get("budget_consumed")),
            _euro(p.get("budget_forecast")),
        ])
        rag_cells.append((i, p.get("status_rag")))
    pt = Table(proj_data, colWidths=[7.6 * cm, 1.9 * cm, 3 * cm, 3 * cm, 2.8 * cm])
    pstyle = _table_style(5) + [
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
    ]
    for row_idx, rag_v in rag_cells:
        if rag_v in RAG_FILLS:
            pstyle.append(("BACKGROUND", (1, row_idx), (1, row_idx), RAG_FILLS[rag_v]))
            pstyle.append(("TEXTCOLOR", (1, row_idx), (1, row_idx), RAG_COLORS[rag_v]))
            pstyle.append(("FONTNAME", (1, row_idx), (1, row_idx), "Helvetica-Bold"))
    pt.setStyle(TableStyle(pstyle))
    story.append(pt)

    # ── Top risques ────────────────────────────────────────────────────────
    story.append(Paragraph("Top risques du portefeuille", h_section))
    if top_risks:
        risk_data = [["Risque", "Projet", "Criticité", "Statut"]]
        crit_cells = []
        for i, r in enumerate(top_risks, 1):
            crit = r.get("criticality") or 0
            risk_data.append([
                Paragraph(str(r.get("title") or "—")[:80], p_cell),
                Paragraph(str(r.get("project_name") or "—")[:45], p_cell),
                str(crit),
                str(r.get("status") or "—"),
            ])
            crit_cells.append((i, crit))
        rt2 = Table(risk_data, colWidths=[8.2 * cm, 5.1 * cm, 2 * cm, 3 * cm])
        rstyle = _table_style(4) + [("ALIGN", (2, 0), (2, -1), "CENTER")]
        for row_idx, crit in crit_cells:
            fill = RAG_FILLS["red"] if crit >= 12 else (RAG_FILLS["orange"] if crit >= 9 else RAG_FILLS["green"])
            rstyle.append(("BACKGROUND", (2, row_idx), (2, row_idx), fill))
            rstyle.append(("FONTNAME", (2, row_idx), (2, row_idx), "Helvetica-Bold"))
        rt2.setStyle(TableStyle(rstyle))
        story.append(rt2)
    else:
        story.append(Paragraph("Aucun risque identifié.", h_sub))

    # ── Jalons à venir (30 jours) ──────────────────────────────────────────
    story.append(Paragraph("Jalons à venir (30 jours)", h_section))
    upcoming = extras.get("upcoming_milestones", [])[:8]
    if upcoming:
        ms_data = [["Jalon", "Projet", "Échéance", "Alerte"]]
        late_cells = []
        for i, m in enumerate(upcoming, 1):
            ms_data.append([
                Paragraph(str(m.get("name") or "—")[:70], p_cell),
                Paragraph(str(m.get("project_name") or "—")[:45], p_cell),
                _date_fr(m.get("date_forecast")),
                "EN RETARD" if m.get("late") else "OK",
            ])
            if m.get("late"):
                late_cells.append(i)
        mt = Table(ms_data, colWidths=[7.6 * cm, 5.1 * cm, 2.8 * cm, 2.8 * cm])
        mstyle = _table_style(4) + [("ALIGN", (2, 0), (-1, -1), "CENTER")]
        for row_idx in late_cells:
            mstyle.append(("BACKGROUND", (3, row_idx), (3, row_idx), RAG_FILLS["red"]))
            mstyle.append(("TEXTCOLOR", (3, row_idx), (3, row_idx), RAG_COLORS["red"]))
            mstyle.append(("FONTNAME", (3, row_idx), (3, row_idx), "Helvetica-Bold"))
        mt.setStyle(TableStyle(mstyle))
        story.append(mt)
    else:
        story.append(Paragraph("Aucun jalon dans les 30 prochains jours.", h_sub))

    # ── Charge équipes (mois courant) ──────────────────────────────────────
    story.append(Paragraph("Charge équipes — mois courant", h_section))
    tl_rows = []
    for t in team_load:
        period = (t.get("periods") or [{}])[0]
        capa = period.get("capacity_jh", 0)
        alloc = period.get("allocated_jh", 0)
        pct = period.get("utilization_pct", 0)
        if capa or alloc:
            tl_rows.append((t.get("team_name", "—"), capa, alloc, pct))
    if tl_rows:
        tl_data = [["Équipe", "Capacité (JH)", "Alloué (JH)", "Charge"]]
        over_cells = []
        for i, (name, capa, alloc, pct) in enumerate(tl_rows, 1):
            tl_data.append([name, f"{capa:.0f}", f"{alloc:.0f}", f"{pct:.0f} %"])
            if pct > 100:
                over_cells.append(i)
        tt = Table(tl_data, colWidths=[9.4 * cm, 3 * cm, 3 * cm, 2.9 * cm])
        tstyle = _table_style(4) + [("ALIGN", (1, 0), (-1, -1), "CENTER")]
        for row_idx in over_cells:
            tstyle.append(("BACKGROUND", (3, row_idx), (3, row_idx), RAG_FILLS["red"]))
            tstyle.append(("TEXTCOLOR", (3, row_idx), (3, row_idx), RAG_COLORS["red"]))
            tstyle.append(("FONTNAME", (3, row_idx), (3, row_idx), "Helvetica-Bold"))
        tt.setStyle(TableStyle(tstyle))
        story.append(tt)
    else:
        story.append(Paragraph("Aucune donnée de charge disponible.", h_sub))

    # ── Décisions récentes ─────────────────────────────────────────────────
    decisions = extras.get("recent_decisions", [])[:5]
    if decisions:
        story.append(Paragraph("Dernières décisions", h_section))
        d_data = [["Décision", "Projet", "Statut", "Date"]]
        for d in decisions:
            d_data.append([
                Paragraph(str(d.get("title") or "—")[:80], p_cell),
                Paragraph(str(d.get("project_name") or "—")[:45], p_cell),
                str(d.get("status") or "—"),
                _date_fr(d.get("decision_date")),
            ])
        dt = Table(d_data, colWidths=[8.2 * cm, 5.1 * cm, 2.5 * cm, 2.5 * cm])
        dt.setStyle(TableStyle(_table_style(4) + [("ALIGN", (2, 0), (-1, -1), "CENTER")]))
        story.append(dt)

    # ── Pied de page ───────────────────────────────────────────────────────
    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E2E8F0")))
    story.append(Paragraph(
        f"MARCEL — Plateforme PPM · {tenant_name} · Document confidentiel · "
        f"{datetime.now().strftime('%d/%m/%Y %H:%M')}",
        ParagraphStyle("f", parent=styles["Normal"], fontSize=7, textColor=GREY),
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()
