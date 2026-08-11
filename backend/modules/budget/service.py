"""Budget module — Service d'agrégation budgétaire portefeuille."""
from datetime import datetime, timezone
from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload


def _ecart_pct(budget: float, eac: float) -> float:
    if not budget:
        return 0.0
    return round((eac - budget) / budget * 100, 1)


async def get_consolidated(current_user: TokenPayload, program_id: str = None,
                            status: str = None) -> dict:
    query = {"tenant_id": current_user.tenant_id}
    if status:
        query["status"] = status

    projects = await db.projects.find(query, {"_id": 0}).to_list(None)

    # Charger les programmes pour enrichir les projets
    programs = await db.programs.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0, "program_id": 1, "name": 1}
    ).to_list(None)
    prog_map = {p["program_id"]: p["name"] for p in programs}

    # Charger l'enveloppe 2026
    envelope = await db.portfolio_envelopes.find_one(
        {"tenant_id": current_user.tenant_id, "year": 2026}, {"_id": 0}
    )

    enriched = []
    capex_planned_total = 0
    capex_consumed_total = 0
    opex_planned_total = 0
    opex_consumed_total = 0
    eac_total = 0
    consumed_total = 0

    for p in projects:
        cp = p.get("capex_planned") or 0
        cc = p.get("capex_consumed") or 0
        op = p.get("opex_planned") or 0
        oc = p.get("opex_consumed") or 0
        eac = p.get("eac") or p.get("budget_forecast") or (cp + op)
        budget = cp + op
        consumed = cc + oc
        raf = max(eac - consumed, 0)
        revisions = p.get("budget_revision_history") or []

        pid = p.get("program_id")
        if program_id and pid != program_id:
            continue

        enriched.append({
            "project_id": p["project_id"],
            "name": p["name"],
            "program_id": pid,
            "program_name": prog_map.get(pid, "—") if pid else "—",
            "status_rag": p.get("status_rag", "green"),
            "status": p.get("status", "actif"),
            "capex_planned": cp,
            "capex_consumed": cc,
            "opex_planned": op,
            "opex_consumed": oc,
            "eac": eac,
            "raf": round(raf, 0),
            "ecart_pct": _ecart_pct(budget, eac),
            "nb_revisions": len(revisions),
        })

        capex_planned_total += cp
        capex_consumed_total += cc
        opex_planned_total += op
        opex_consumed_total += oc
        eac_total += eac
        consumed_total += consumed

    raf_total = max(eac_total - consumed_total, 0)

    return {
        "kpis": {
            "capex_planned": round(capex_planned_total, 0),
            "capex_consumed": round(capex_consumed_total, 0),
            "opex_planned": round(opex_planned_total, 0),
            "opex_consumed": round(opex_consumed_total, 0),
            "eac_total": round(eac_total, 0),
            "raf_total": round(raf_total, 0),
        },
        "envelope": {
            "capex_envelope": envelope.get("capex_envelope") if envelope else None,
            "opex_envelope": envelope.get("opex_envelope") if envelope else None,
        } if envelope else None,
        "projects": enriched,
    }


async def get_by_program(current_user: TokenPayload) -> list:
    programs = await db.programs.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)
    prog_map = {p["program_id"]: p["name"] for p in programs}

    projects = await db.projects.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)

    agg: dict = {}
    for p in projects:
        pid = p.get("program_id") or "__none__"
        cp = p.get("capex_planned") or 0
        cc = p.get("capex_consumed") or 0
        op = p.get("opex_planned") or 0
        oc = p.get("opex_consumed") or 0
        eac = p.get("eac") or p.get("budget_forecast") or (cp + op)
        consumed = cc + oc
        raf = max(eac - consumed, 0)

        if pid not in agg:
            agg[pid] = {
                "program_id": pid if pid != "__none__" else None,
                "program_name": prog_map.get(pid, "Sans programme"),
                "nb_projects": 0,
                "capex_total": 0,
                "opex_total": 0,
                "consumed_total": 0,
                "eac_total": 0,
                "raf_total": 0,
                "projects": [],
            }
        agg[pid]["nb_projects"] += 1
        agg[pid]["capex_total"] += cp
        agg[pid]["opex_total"] += op
        agg[pid]["consumed_total"] += consumed
        agg[pid]["eac_total"] += eac
        agg[pid]["raf_total"] += raf
        agg[pid]["projects"].append({
            "project_id": p["project_id"],
            "name": p["name"],
            "status_rag": p.get("status_rag", "green"),
            "capex_planned": cp,
            "opex_planned": op,
            "eac": eac,
            "raf": round(raf, 0),
            "ecart_pct": _ecart_pct(cp + op, eac),
        })

    result = []
    for v in agg.values():
        bt = v["capex_total"] + v["opex_total"]
        v["ecart_pct"] = _ecart_pct(bt, v["eac_total"])
        v["capex_total"] = round(v["capex_total"], 0)
        v["opex_total"] = round(v["opex_total"], 0)
        v["consumed_total"] = round(v["consumed_total"], 0)
        v["eac_total"] = round(v["eac_total"], 0)
        v["raf_total"] = round(v["raf_total"], 0)
        result.append(v)

    return sorted(result, key=lambda x: -x["eac_total"])


async def get_project_revisions(project_id: str, current_user: TokenPayload) -> dict:
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    return {
        "project_id": project_id,
        "name": project.get("name"),
        "capex_planned": project.get("capex_planned", 0),
        "opex_planned": project.get("opex_planned", 0),
        "eac": project.get("eac") or project.get("budget_forecast"),
        "budget_consumed": project.get("budget_consumed", 0),
        "capex_consumed": project.get("capex_consumed", 0),
        "opex_consumed": project.get("opex_consumed", 0),
        "revisions": project.get("budget_revision_history") or [],
    }


async def revise_budget(project_id: str, data: dict, current_user: TokenPayload) -> dict:
    """Met à jour le budget d'un projet + historique des révisions."""
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    # RBAC : budget.edit global OU budget.set_envelope sur ses propres projets
    perms = current_user.permissions or []
    is_owner = project.get("owner_id") == current_user.user_id
    has_edit = "budget.edit" in perms or "*" in perms
    has_revise = "budget.revise_eac" in perms
    has_envelope = "budget.set_envelope" in perms and is_owner

    if not (has_edit or has_revise or has_envelope):
        raise HTTPException(status_code=403, detail="Permission budget.edit requise")

    eac = data.get("eac")
    capex_planned = data.get("capex_planned")
    opex_planned = data.get("opex_planned")
    reason = data.get("reason", "")

    if not reason:
        raise HTTPException(status_code=422, detail="Le motif de modification est obligatoire")
    if eac is None:
        raise HTTPException(status_code=422, detail="EAC obligatoire")

    old_eac = project.get("eac") or project.get("budget_forecast") or project.get("budget_total", 0)
    revision_entry = {
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "old_eac": old_eac,
        "new_eac": eac,
        "reason": reason,
        "author": current_user.email,
    }

    set_fields: dict = {"eac": eac, "budget_forecast": eac}
    if capex_planned is not None:
        set_fields["capex_planned"] = capex_planned
    if opex_planned is not None:
        set_fields["opex_planned"] = opex_planned
    cp_new = capex_planned if capex_planned is not None else project.get("capex_planned", 0)
    op_new = opex_planned if opex_planned is not None else project.get("opex_planned", 0)
    set_fields["budget_total"] = (cp_new or 0) + (op_new or 0)

    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": set_fields, "$push": {"budget_revision_history": revision_entry}},
    )
    from core.audit import log_audit
    await log_audit(current_user, "budget_revised", "project", project_id, project.get("name", ""), [
        {"field": "eac", "old": old_eac, "new": eac},
        {"field": "motif", "old": "", "new": reason},
    ])
    return await get_project_revisions(project_id, current_user)


async def export_excel(current_user: TokenPayload) -> bytes:
    import io
    import xlsxwriter

    consolidated = await get_consolidated(current_user)
    by_program = await get_by_program(current_user)
    projects = consolidated["projects"]
    kpis = consolidated["kpis"]

    buf = io.BytesIO()
    wb = xlsxwriter.Workbook(buf, {"in_memory": True})

    # Formats
    hdr = wb.add_format({"bold": True, "bg_color": "#0052CC", "font_color": "white",
                          "border": 1, "align": "center"})
    money = wb.add_format({"num_format": "#,##0 €", "border": 1})
    pct = wb.add_format({"num_format": '0.0"%"', "border": 1})
    cell = wb.add_format({"border": 1})
    title = wb.add_format({"bold": True, "font_size": 14})
    red_fmt = wb.add_format({"border": 1, "bg_color": "#FEE2E2"})
    orange_fmt = wb.add_format({"border": 1, "bg_color": "#FEF3C7"})
    green_fmt = wb.add_format({"border": 1, "bg_color": "#D1FAE5"})

    # ── Onglet 1 : Portefeuille ──────────────────────────────────────────────
    ws1 = wb.add_worksheet("Portefeuille")
    ws1.write(0, 0, "Budget Consolidé Portefeuille", title)
    ws1.write(1, 0, f"Export du {datetime.now().strftime('%d/%m/%Y')}", cell)

    ws1.write(3, 0, "CAPEX Prévu", hdr)
    ws1.write(3, 1, kpis["capex_planned"], money)
    ws1.write(3, 2, "CAPEX Consommé", hdr)
    ws1.write(3, 3, kpis["capex_consumed"], money)
    ws1.write(4, 0, "OPEX Prévu", hdr)
    ws1.write(4, 1, kpis["opex_planned"], money)
    ws1.write(4, 2, "OPEX Consommé", hdr)
    ws1.write(4, 3, kpis["opex_consumed"], money)
    ws1.write(5, 0, "EAC Total", hdr)
    ws1.write(5, 1, kpis["eac_total"], money)
    ws1.write(5, 2, "RAF Total", hdr)
    ws1.write(5, 3, kpis["raf_total"], money)

    cols = ["Projet", "Programme", "RAG", "CAPEX Prévu", "CAPEX Consommé",
            "OPEX Prévu", "OPEX Consommé", "EAC", "RAF", "Écart EAC (%)", "Révisions"]
    for ci, c in enumerate(cols):
        ws1.write(7, ci, c, hdr)
    ws1.set_column(0, 0, 40)
    ws1.set_column(1, 1, 30)

    for ri, p in enumerate(projects):
        row = 8 + ri
        ecart = p["ecart_pct"]
        efmt = red_fmt if ecart > 15 else (orange_fmt if ecart > 5 else green_fmt)
        ws1.write(row, 0, p["name"], cell)
        ws1.write(row, 1, p["program_name"], cell)
        ws1.write(row, 2, p["status_rag"], cell)
        ws1.write(row, 3, p["capex_planned"], money)
        ws1.write(row, 4, p["capex_consumed"], money)
        ws1.write(row, 5, p["opex_planned"], money)
        ws1.write(row, 6, p["opex_consumed"], money)
        ws1.write(row, 7, p["eac"], money)
        ws1.write(row, 8, p["raf"], money)
        ws1.write(row, 9, ecart / 100, efmt)
        ws1.write(row, 10, p["nb_revisions"], cell)

    # Ligne totaux
    tr = 8 + len(projects)
    ws1.write(tr, 0, "TOTAL", hdr)
    ws1.write(tr, 3, kpis["capex_planned"], money)
    ws1.write(tr, 4, kpis["capex_consumed"], money)
    ws1.write(tr, 5, kpis["opex_planned"], money)
    ws1.write(tr, 6, kpis["opex_consumed"], money)
    ws1.write(tr, 7, kpis["eac_total"], money)
    ws1.write(tr, 8, kpis["raf_total"], money)

    # ── Onglet 2 : Par programme ─────────────────────────────────────────────
    ws2 = wb.add_worksheet("Par Programme")
    prog_cols = ["Programme", "Nb Projets", "CAPEX Total", "OPEX Total",
                 "Consommé Total", "EAC Total", "RAF Total", "Écart (%)"]
    for ci, c in enumerate(prog_cols):
        ws2.write(0, ci, c, hdr)
    ws2.set_column(0, 0, 35)

    for ri, pg in enumerate(by_program):
        row = 1 + ri
        ws2.write(row, 0, pg["program_name"], cell)
        ws2.write(row, 1, pg["nb_projects"], cell)
        ws2.write(row, 2, pg["capex_total"], money)
        ws2.write(row, 3, pg["opex_total"], money)
        ws2.write(row, 4, pg["consumed_total"], money)
        ws2.write(row, 5, pg["eac_total"], money)
        ws2.write(row, 6, pg["raf_total"], money)
        ws2.write(row, 7, pg["ecart_pct"] / 100, pct)

    # ── Onglet 3 : Détail par projet ─────────────────────────────────────────
    ws3 = wb.add_worksheet("Détail Projets")
    ws3.write(0, 0, "Historique révisions par projet", title)
    row = 2
    rev_hdr = ["Projet", "Date", "Ancien EAC", "Nouvel EAC", "Motif", "Auteur"]
    for ci, c in enumerate(rev_hdr):
        ws3.write(row, ci, c, hdr)
    ws3.set_column(0, 0, 40)
    ws3.set_column(4, 4, 50)
    row += 1

    for p in projects:
        proj_doc = await db.projects.find_one(
            {"project_id": p["project_id"]}, {"_id": 0, "budget_revision_history": 1}
        )
        revisions = (proj_doc or {}).get("budget_revision_history") or []
        for rev in revisions:
            ws3.write(row, 0, p["name"], cell)
            ws3.write(row, 1, rev.get("date", ""), cell)
            ws3.write(row, 2, rev.get("old_eac", 0), money)
            ws3.write(row, 3, rev.get("new_eac", 0), money)
            ws3.write(row, 4, rev.get("reason", ""), cell)
            ws3.write(row, 5, rev.get("author", ""), cell)
            row += 1

    wb.close()
    buf.seek(0)
    return buf.read()


async def export_pdf(current_user: TokenPayload) -> bytes:
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    consolidated = await get_consolidated(current_user)
    kpis = consolidated["kpis"]
    projects = consolidated["projects"]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                             leftMargin=1.5 * cm, rightMargin=1.5 * cm,
                             topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Heading1"],
                                  fontSize=18, textColor=colors.HexColor("#0052CC"))
    sub_style = ParagraphStyle("sub", parent=styles["Normal"],
                                fontSize=10, textColor=colors.grey)

    def money_fmt(v):
        return f"{int(v):,} €".replace(",", " ")

    def pct_fmt(v):
        sign = "+" if v > 0 else ""
        return f"{sign}{v:.1f}%"

    story = []
    story.append(Paragraph("Synthèse Budgétaire Portefeuille", title_style))
    story.append(Paragraph(f"Groupe Altair Industries — Export du {datetime.now().strftime('%d/%m/%Y')}",
                            sub_style))
    story.append(Spacer(1, 0.5 * cm))

    # KPIs table
    kpi_data = [
        ["Indicateur", "Montant"],
        ["CAPEX Prévu", money_fmt(kpis["capex_planned"])],
        ["CAPEX Consommé", money_fmt(kpis["capex_consumed"])],
        ["OPEX Prévu", money_fmt(kpis["opex_planned"])],
        ["OPEX Consommé", money_fmt(kpis["opex_consumed"])],
        ["EAC Total", money_fmt(kpis["eac_total"])],
        ["RAF Total", money_fmt(kpis["raf_total"])],
    ]
    t = Table(kpi_data, colWidths=[8 * cm, 8 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0052CC")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8F9FA")]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5 * cm))

    # Projects table
    story.append(Paragraph("Détail par projet", styles["Heading2"]))
    story.append(Spacer(1, 0.3 * cm))

    proj_hdr = ["Projet", "RAG", "Prévu", "EAC", "Écart"]
    proj_data = [proj_hdr]
    for p in sorted(projects, key=lambda x: -x["ecart_pct"]):
        ecart = p["ecart_pct"]
        proj_data.append([
            p["name"][:35],
            p["status_rag"].upper(),
            money_fmt(p["capex_planned"] + p["opex_planned"]),
            money_fmt(p["eac"]),
            pct_fmt(ecart),
        ])

    pt = Table(proj_data, colWidths=[7 * cm, 1.5 * cm, 3.5 * cm, 3.5 * cm, 2 * cm])
    pt_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0052CC")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
    ]
    # Color coding écart
    for ri, p in enumerate(sorted(projects, key=lambda x: -x["ecart_pct"]), 1):
        ecart = p["ecart_pct"]
        color = colors.HexColor("#FEE2E2") if ecart > 15 else (
            colors.HexColor("#FEF3C7") if ecart > 5 else colors.HexColor("#D1FAE5")
        )
        pt_style.append(("BACKGROUND", (4, ri), (4, ri), color))
    pt.setStyle(TableStyle(pt_style))
    story.append(pt)

    doc.build(story)
    buf.seek(0)
    return buf.read()


# ─── Plan pluriannuel N / N+1 / N+2 ──────────────────────────────────────────

def _prorata_by_year(start, end, amount: float, fallback_year: int) -> dict:
    from datetime import datetime as _dt, date as _date

    def _parse(v):
        try:
            return _dt.strptime(str(v)[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return None

    sd, ed = _parse(start), _parse(end)
    if not sd and not ed:
        return {fallback_year: amount}
    if not sd:
        sd = _date(ed.year, 1, 1)
    if not ed:
        ed = _date(sd.year, 12, 31)
    if ed < sd:
        ed = sd
    total_months = (ed.year - sd.year) * 12 + (ed.month - sd.month) + 1
    result = {}
    for y in range(sd.year, ed.year + 1):
        m_start = sd.month if y == sd.year else 1
        m_end = ed.month if y == ed.year else 12
        result[y] = amount * (m_end - m_start + 1) / total_months
    return result


async def get_multiyear(current_user: TokenPayload) -> dict:
    from datetime import datetime as _dt, timezone as _tz
    current_year = _dt.now(_tz.utc).year
    years = [current_year, current_year + 1, current_year + 2]
    projects = await db.projects.find(
        {"tenant_id": current_user.tenant_id},
        {"_id": 0, "project_id": 1, "name": 1, "code": 1, "status": 1, "status_rag": 1,
         "start_date": 1, "end_date_forecast": 1, "end_date_initial": 1,
         "budget_total": 1, "budget_forecast": 1, "budget_by_year": 1},
    ).to_list(None)
    rows = []
    totals = {y: 0.0 for y in years}
    for p in projects:
        eac = p.get("budget_forecast") or p.get("budget_total") or 0
        manual = p.get("budget_by_year") or {}
        if manual:
            by_year_full = {}
            for k, v in manual.items():
                try:
                    by_year_full[int(k)] = float(v or 0)
                except (ValueError, TypeError):
                    continue
            source = "manual"
        else:
            by_year_full = _prorata_by_year(
                p.get("start_date"),
                p.get("end_date_forecast") or p.get("end_date_initial"),
                eac, current_year,
            )
            source = "prorata"
        window = {y: round(by_year_full.get(y, 0)) for y in years}
        out_of_window = round(sum(v for y, v in by_year_full.items() if y not in years))
        for y in years:
            totals[y] += window[y]
        rows.append({
            "project_id": p["project_id"],
            "name": p.get("name"),
            "code": p.get("code"),
            "status": p.get("status"),
            "status_rag": p.get("status_rag"),
            "start_date": p.get("start_date"),
            "end_date_forecast": p.get("end_date_forecast") or p.get("end_date_initial"),
            "eac": eac,
            "by_year": {str(y): window[y] for y in years},
            "total_window": sum(window.values()),
            "out_of_window": out_of_window,
            "source": source,
        })
    rows.sort(key=lambda r: r["total_window"], reverse=True)
    envelopes = {}
    for env in await db.portfolio_envelopes.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None):
        if env.get("year") in years:
            envelopes[str(env["year"])] = {
                "label": env.get("label"),
                "total_envelope": env.get("total_envelope") or 0,
                "capex_envelope": env.get("capex_envelope") or 0,
                "opex_envelope": env.get("opex_envelope") or 0,
            }
    return {
        "years": years,
        "projects": rows,
        "totals": {str(y): round(totals[y]) for y in years},
        "envelopes": envelopes,
    }


async def set_project_multiyear(project_id: str, data: dict, current_user: TokenPayload) -> dict:
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    perms = current_user.permissions or []
    if not ("budget.edit" in perms or "*" in perms):
        raise HTTPException(status_code=403, detail="Permission budget.edit requise")
    old_mode = "manuel" if project.get("budget_by_year") else "pro-rata"
    if data.get("reset"):
        await db.projects.update_one(
            {"project_id": project_id, "tenant_id": current_user.tenant_id},
            {"$unset": {"budget_by_year": ""}},
        )
        cleaned = None
        new_desc = "pro-rata automatique"
    else:
        by_year = data.get("by_year") or {}
        cleaned = {}
        for k, v in by_year.items():
            try:
                year = int(k)
                val = float(v or 0)
            except (ValueError, TypeError):
                raise HTTPException(status_code=422, detail=f"Valeur invalide pour l'exercice {k}")
            if val < 0:
                raise HTTPException(status_code=422, detail="Les montants doivent être positifs")
            cleaned[str(year)] = val
        if not cleaned:
            raise HTTPException(status_code=422, detail="Aucun montant fourni")
        await db.projects.update_one(
            {"project_id": project_id, "tenant_id": current_user.tenant_id},
            {"$set": {"budget_by_year": cleaned}},
        )
        new_desc = " · ".join(f"{y}: {int(v)} €" for y, v in sorted(cleaned.items()))
    from core.audit import log_audit
    await log_audit(current_user, "updated", "project", project_id, project.get("name", ""), [
        {"field": "plan pluriannuel", "old": old_mode, "new": new_desc},
    ])
    return {"project_id": project_id, "budget_by_year": cleaned}
