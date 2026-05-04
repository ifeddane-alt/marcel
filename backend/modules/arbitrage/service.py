"""
Service Arbitrage Portefeuille.
Scoring multi-critère, enveloppes budgétaires, scénarios what-if.
"""
from fastapi import HTTPException
from datetime import datetime, timezone
import uuid

from core.database import db
from core.auth import TokenPayload, is_ownership_restricted
from .schemas import ScoringPatch, ArbitrageWeightsUpdate, EnvelopeUpsert, ScenarioCreate

# ─── Poids par défaut ─────────────────────────────────────────────────────────
DEFAULT_WEIGHTS = {
    "w1": 0.20,   # alignement_stratégique
    "w2": 0.25,   # valeur_business
    "w3": 0.15,   # roi_estimated
    "w4": 0.15,   # urgence
    "w5": 0.15,   # risque (soustractif)
    "w6": 0.10,   # complexité (soustractif)
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Calcul du score normalisé 0–100 ─────────────────────────────────────────

def compute_score(project: dict, weights: dict) -> float:
    """
    Score = W1×align + W2×bv + W3×roi + W4×urg − W5×risk − W6×complexity
    Échelle 1–5 pour chaque critère. Retourne un score normalisé 0–100.
    """
    align = float(project.get("strategic_alignment") or 3)
    bv    = float(project.get("business_value") or 3)
    roi   = float(project.get("roi_estimated") or 3)
    urg   = float(project.get("urgency") or 3)
    risk  = float(project.get("risk_score") or 3)
    comp  = float(project.get("complexity") or 3)

    w1 = float(weights.get("w1", 0.20))
    w2 = float(weights.get("w2", 0.25))
    w3 = float(weights.get("w3", 0.15))
    w4 = float(weights.get("w4", 0.15))
    w5 = float(weights.get("w5", 0.15))
    w6 = float(weights.get("w6", 0.10))

    raw = w1 * align + w2 * bv + w3 * roi + w4 * urg - w5 * risk - w6 * comp

    pos_w = w1 + w2 + w3 + w4
    neg_w = w5 + w6
    max_raw = pos_w * 5 - neg_w * 1
    min_raw = pos_w * 1 - neg_w * 5

    if max_raw == min_raw:
        return 50.0

    normalized = (raw - min_raw) / (max_raw - min_raw) * 100
    return round(max(0.0, min(100.0, normalized)), 1)


# ─── Poids du tenant ──────────────────────────────────────────────────────────

async def _get_weights(tenant_id: str) -> dict:
    tenant = await db.tenants.find_one(
        {"tenant_id": tenant_id},
        {"_id": 0, "settings.arbitrage_weights": 1},
    )
    w = (tenant or {}).get("settings", {}).get("arbitrage_weights") or {}
    return {**DEFAULT_WEIGHTS, **w}


async def get_weights(user: TokenPayload) -> dict:
    return await _get_weights(user.tenant_id)


async def update_weights(data: ArbitrageWeightsUpdate, user: TokenPayload) -> dict:
    w = data.model_dump()
    await db.tenants.update_one(
        {"tenant_id": user.tenant_id},
        {"$set": {"settings.arbitrage_weights": w}},
        upsert=True,
    )
    return w


# ─── Résumé portefeuille avec scores ─────────────────────────────────────────

async def get_portfolio_summary(user: TokenPayload) -> dict:
    query: dict = {"tenant_id": user.tenant_id}
    if is_ownership_restricted(user, "projects.view_own"):
        query["owner_id"] = user.user_id

    projects = await db.projects.find(query, {"_id": 0}).to_list(None)
    weights = await _get_weights(user.tenant_id)

    scored = []
    for p in projects:
        scored.append({
            "project_id":            p.get("project_id"),
            "name":                  p.get("name"),
            "status":                p.get("status"),
            "status_rag":            p.get("status_rag"),
            "capex_planned":         p.get("capex_planned", 0) or 0,
            "opex_planned":          p.get("opex_planned", 0) or 0,
            "budget_total":          p.get("budget_total", 0) or 0,
            "strategic_alignment":   p.get("strategic_alignment"),
            "business_value":        p.get("business_value"),
            "roi_estimated":         p.get("roi_estimated"),
            "urgency":               p.get("urgency"),
            "risk_score":            p.get("risk_score"),
            "complexity":            p.get("complexity"),
            "score":                 compute_score(p, weights),
        })

    scored.sort(key=lambda x: x["score"], reverse=True)

    total_capex = sum(p["capex_planned"] for p in scored)
    total_opex  = sum(p["opex_planned"]  for p in scored)
    total_budget = sum(p["budget_total"] for p in scored)

    return {
        "projects": scored,
        "weights":  weights,
        "totals": {
            "capex_planned": total_capex,
            "opex_planned":  total_opex,
            "budget_total":  total_budget,
        },
    }


# ─── Patch scoring d'un projet ────────────────────────────────────────────────

async def patch_project_scoring(project_id: str, data: ScoringPatch, user: TokenPayload) -> dict:
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Aucun champ à mettre à jour")

    # Vérifier que le projet appartient bien au tenant
    proj = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not proj:
        raise HTTPException(404, "Projet introuvable")

    # CP: ne peut modifier que ses propres projets
    if is_ownership_restricted(user, "projects.view_own") and proj.get("owner_id") != user.user_id:
        raise HTTPException(403, "Accès refusé — projet non assigné")

    await db.projects.update_one(
        {"project_id": project_id, "tenant_id": user.tenant_id},
        {"$set": updates},
    )
    proj.update(updates)
    weights = await _get_weights(user.tenant_id)
    return {"project_id": project_id, **updates, "score": compute_score(proj, weights)}


# ─── Enveloppes budgétaires ───────────────────────────────────────────────────

async def list_envelopes(user: TokenPayload) -> list:
    envelopes = await db.portfolio_envelopes.find(
        {"tenant_id": user.tenant_id}, {"_id": 0}
    ).sort("year", -1).to_list(None)
    return envelopes


async def upsert_envelope(data: EnvelopeUpsert, user: TokenPayload) -> dict:
    existing = await db.portfolio_envelopes.find_one(
        {"tenant_id": user.tenant_id, "year": data.year}
    )
    doc = {
        "tenant_id":      user.tenant_id,
        "year":           data.year,
        "label":          data.label or f"Enveloppe Portefeuille {data.year}",
        "capex_envelope": data.capex_envelope,
        "opex_envelope":  data.opex_envelope,
        "total_envelope": data.capex_envelope + data.opex_envelope,
        "updated_at":     _now(),
    }
    if existing:
        await db.portfolio_envelopes.update_one(
            {"tenant_id": user.tenant_id, "year": data.year},
            {"$set": doc},
        )
        doc["envelope_id"] = existing.get("envelope_id", str(uuid.uuid4()))
    else:
        doc["envelope_id"] = str(uuid.uuid4())
        doc["created_at"] = _now()
        await db.portfolio_envelopes.insert_one(doc)

    result = await db.portfolio_envelopes.find_one(
        {"tenant_id": user.tenant_id, "year": data.year}, {"_id": 0}
    )
    return result or doc


async def delete_envelope(envelope_id: str, user: TokenPayload) -> dict:
    env = await db.portfolio_envelopes.find_one(
        {"envelope_id": envelope_id, "tenant_id": user.tenant_id}
    )
    if not env:
        raise HTTPException(404, "Enveloppe introuvable")
    await db.portfolio_envelopes.delete_one({"envelope_id": envelope_id})
    return {"deleted": True}


# ─── Scénarios What-if ────────────────────────────────────────────────────────

async def list_scenarios(user: TokenPayload) -> list:
    return await db.scenarios.find(
        {"tenant_id": user.tenant_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(None)


async def get_scenario(scenario_id: str, user: TokenPayload) -> dict:
    s = await db.scenarios.find_one(
        {"scenario_id": scenario_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not s:
        raise HTTPException(404, "Scénario introuvable")
    return s


async def save_scenario(data: ScenarioCreate, user: TokenPayload) -> dict:
    doc = {
        "scenario_id":  str(uuid.uuid4()),
        "tenant_id":    user.tenant_id,
        "name":         data.name,
        "description":  data.description,
        "modifications": data.modifications,
        "summary":      data.summary,
        "created_by":   user.user_id,
        "created_at":   _now(),
        "status":       "draft",
    }
    await db.scenarios.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def apply_scenario(scenario_id: str, user: TokenPayload) -> dict:
    """Applique les modifications d'un scénario aux vrais projets."""
    scenario = await db.scenarios.find_one(
        {"scenario_id": scenario_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not scenario:
        raise HTTPException(404, "Scénario introuvable")

    applied = []
    ALLOWED_FIELDS = {
        "status", "status_rag", "capex_planned", "opex_planned",
        "budget_total", "start_date", "end_date_forecast",
        "strategic_alignment", "business_value", "roi_estimated",
        "urgency", "risk_score", "complexity",
    }

    for mod in scenario.get("modifications", []):
        project_id = mod.get("project_id")
        if not project_id:
            continue
        updates = {k: v for k, v in mod.items() if k in ALLOWED_FIELDS and k != "project_id"}
        if not updates:
            continue
        result = await db.projects.update_one(
            {"project_id": project_id, "tenant_id": user.tenant_id},
            {"$set": updates},
        )
        if result.modified_count:
            applied.append(project_id)

    await db.scenarios.update_one(
        {"scenario_id": scenario_id},
        {"$set": {"status": "applied", "applied_at": _now(), "applied_by": user.user_id}},
    )
    return {"applied": len(applied), "project_ids": applied}


async def delete_scenario(scenario_id: str, user: TokenPayload) -> dict:
    s = await db.scenarios.find_one(
        {"scenario_id": scenario_id, "tenant_id": user.tenant_id}
    )
    if not s:
        raise HTTPException(404, "Scénario introuvable")
    await db.scenarios.delete_one({"scenario_id": scenario_id})
    return {"deleted": True}


# ─── Export PDF Scorecard ─────────────────────────────────────────────────────

async def export_pdf_scorecard(user: TokenPayload) -> bytes:
    """Génère un PDF scorecard avec rankings, scores, enveloppes et bubble chart."""
    import io
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.colors import HexColor, black, white, Color
    from reportlab.lib.units import mm
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, Image as RLImage,
    )
    from reportlab.graphics.shapes import Drawing, Rect
    from datetime import datetime, timezone

    summary_data = await get_portfolio_summary(user)
    envelopes    = await list_envelopes(user)
    projects     = summary_data["projects"]
    totals       = summary_data["totals"]
    weights      = summary_data["weights"]
    now_str      = datetime.now(timezone.utc).strftime("%d/%m/%Y")

    # ── Couleurs ──────────────────────────────────────────────────────────────
    C_DARK    = HexColor("#0B2545")
    C_BLUE    = HexColor("#1D4ED8")
    C_SLATE   = HexColor("#64748B")
    C_BORDER  = HexColor("#E2E8F0")
    C_GREEN   = HexColor("#10B981")
    C_AMBER   = HexColor("#F59E0B")
    C_RED     = HexColor("#EF4444")
    C_BG_HDR  = HexColor("#F8FAFC")
    C_SCORE_HI = HexColor("#D1FAE5")
    C_SCORE_LO = HexColor("#FEE2E2")

    W, H = A4

    # ── Styles ────────────────────────────────────────────────────────────────
    def style(name, **kw):
        return ParagraphStyle(name, **kw)

    s_title  = style("title",  fontSize=20, fontName="Helvetica-Bold", textColor=C_DARK, spaceAfter=2)
    s_sub    = style("sub",    fontSize=9,  fontName="Helvetica",      textColor=C_SLATE)
    s_h2     = style("h2",     fontSize=12, fontName="Helvetica-Bold", textColor=C_DARK, spaceBefore=8, spaceAfter=4)
    s_small  = style("small",  fontSize=7,  fontName="Helvetica",      textColor=C_SLATE)
    s_cell   = style("cell",   fontSize=8,  fontName="Helvetica",      textColor=HexColor("#1E293B"))
    s_cell_b = style("cellb",  fontSize=8,  fontName="Helvetica-Bold", textColor=HexColor("#1E293B"))
    s_center = style("ctr",    fontSize=8,  fontName="Helvetica",      alignment=TA_CENTER)
    s_right  = style("right",  fontSize=8,  fontName="Helvetica",      alignment=TA_RIGHT)

    # ── Helper formule poids ──────────────────────────────────────────────────
    def fmt_w(k): return f"{int(weights.get(k, 0) * 100)}%"

    # ── Bubble Chart (matplotlib) ─────────────────────────────────────────────
    rag_colors_mpl = {"green": "#10B981", "orange": "#F59E0B", "red": "#EF4444"}
    fig, ax = plt.subplots(figsize=(9, 5))
    fig.patch.set_facecolor("#F8FAFC")
    ax.set_facecolor("#F8FAFC")
    ax.grid(color="#CBD5E1", linestyle="--", linewidth=0.5, alpha=0.7)
    ax.axhline(y=3, color="#94A3B8", linestyle="--", linewidth=0.8, alpha=0.6)
    ax.axvline(x=3, color="#94A3B8", linestyle="--", linewidth=0.8, alpha=0.6)
    ax.set_xlim(0.5, 5.5)
    ax.set_ylim(0.5, 5.5)
    ax.set_xticks([1, 2, 3, 4, 5])
    ax.set_yticks([1, 2, 3, 4, 5])
    ax.set_xlabel("Valeur Business →", fontsize=9, color="#64748B")
    ax.set_ylabel("Risque ↑", fontsize=9, color="#64748B")
    ax.set_title("Carte Valeur vs Risque", fontsize=10, color="#0B2545", pad=8)
    ax.tick_params(colors="#94A3B8", labelsize=8)
    for spine in ax.spines.values():
        spine.set_edgecolor("#E2E8F0")

    for p in projects:
        bv   = p.get("business_value") or 3
        risk = p.get("risk_score") or 3
        budget = p.get("budget_total") or 500000
        color  = rag_colors_mpl.get(p.get("status_rag", "green"), "#94A3B8")
        size   = max(60, min(800, budget / 5000))
        ax.scatter(bv, risk, s=size, c=color, alpha=0.75, edgecolors=color, linewidth=1.5, zorder=3)
        short = p["name"].split("—")[0].strip().split()[:2]
        short_lbl = " ".join(short)[:14]
        ax.annotate(short_lbl, (bv, risk), textcoords="offset points", xytext=(6, 4),
                    fontsize=6.5, color="#475569", fontweight="medium")

    legend_handles = [
        mpatches.Patch(color="#10B981", label="Vert"),
        mpatches.Patch(color="#F59E0B", label="Orange"),
        mpatches.Patch(color="#EF4444", label="Rouge"),
    ]
    ax.legend(handles=legend_handles, fontsize=7, loc="upper left",
              framealpha=0.8, edgecolor="#E2E8F0")
    plt.tight_layout()
    chart_buf = io.BytesIO()
    plt.savefig(chart_buf, format="png", dpi=130, bbox_inches="tight", facecolor="#F8FAFC")
    plt.close(fig)
    chart_buf.seek(0)

    # ── Assemblage PDF ────────────────────────────────────────────────────────
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=15*mm, bottomMargin=15*mm,
    )

    elements = []

    # ─ En-tête ─────────────────────────────────────────────────────────────
    hdr_data = [[
        Paragraph("ARBITRAGE PORTEFEUILLE", s_title),
        Paragraph(f"Généré le {now_str}", s_right),
    ]]
    hdr_table = Table(hdr_data, colWidths=[W - 76*mm, 50*mm])
    hdr_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(hdr_table)
    elements.append(Paragraph("Scorecard multi-critères · Classement par score · Alertes enveloppes", s_sub))
    elements.append(HRFlowable(width="100%", thickness=1, color=C_BORDER, spaceAfter=8))

    # ─ Résumé rapide ─────────────────────────────────────────────────────
    kpi_data = [[
        Paragraph(f"<b>{len(projects)}</b><br/>Projets", s_center),
        Paragraph(f"<b>{int(sum(p['score'] for p in projects)/len(projects)) if projects else 0}</b><br/>Score moyen", s_center),
        Paragraph(f"<b>{totals['capex_planned']/1e6:.1f} M€</b><br/>CAPEX total", s_center),
        Paragraph(f"<b>{totals['opex_planned']/1e6:.1f} M€</b><br/>OPEX total", s_center),
        Paragraph(f"<b>{totals['budget_total']/1e6:.1f} M€</b><br/>Budget total", s_center),
    ]]
    kpi_t = Table(kpi_data, colWidths=[(W - 36*mm) / 5] * 5)
    kpi_t.setStyle(TableStyle([
        ("BOX",        (0, 0), (-1, -1), 0.5, C_BORDER),
        ("INNERGRID",  (0, 0), (-1, -1), 0.5, C_BORDER),
        ("BACKGROUND", (0, 0), (-1, -1), C_BG_HDR),
        ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(kpi_t)
    elements.append(Spacer(1, 8))

    # ─ Formule poids ─────────────────────────────────────────────────────
    formula_txt = (
        f"<b>Formule :</b> Score = {fmt_w('w1')}×ALI + {fmt_w('w2')}×VAL + {fmt_w('w3')}×ROI"
        f" + {fmt_w('w4')}×URG − {fmt_w('w5')}×RSK − {fmt_w('w6')}×CPX  (normalisé 0–100)"
    )
    elements.append(Paragraph(formula_txt, s_small))
    elements.append(Spacer(1, 5))

    # ─ Tableau Scoring ───────────────────────────────────────────────────
    elements.append(Paragraph("Classement Scoring Projets", s_h2))

    SCORE_COL_W = [7*mm, 52*mm, 10*mm, 10*mm, 10*mm, 10*mm, 10*mm, 10*mm, 16*mm, 14*mm]
    thead = [
        Paragraph("#",      s_center),
        Paragraph("Projet", s_cell_b),
        Paragraph("ALI",    s_center),
        Paragraph("VAL",    s_center),
        Paragraph("ROI",    s_center),
        Paragraph("URG",    s_center),
        Paragraph("RSK",    s_center),
        Paragraph("CPX",    s_center),
        Paragraph("SCORE",  s_center),
        Paragraph("RAG",    s_center),
    ]
    table_data = [thead]

    rag_label = {"green": "VERT", "orange": "ORANGE", "red": "ROUGE"}
    rag_hex   = {"green": "#D1FAE5", "orange": "#FEF3C7", "red": "#FEE2E2"}
    rag_text  = {"green": "#065F46", "orange": "#92400E", "red": "#991B1B"}

    table_style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), C_DARK),
        ("TEXTCOLOR",  (0, 0), (-1, 0), white),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, 0), 7.5),
        ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
        ("ALIGN",      (1, 1), (1, -1), "LEFT"),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("GRID",       (0, 0), (-1, -1), 0.4, C_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, C_BG_HDR]),
    ]

    for idx, p in enumerate(projects):
        score = p["score"]
        rag   = p.get("status_rag", "green")
        score_bg = HexColor("#D1FAE5") if score >= 70 else (HexColor("#FEF3C7") if score >= 50 else HexColor("#FEE2E2"))
        rag_bg   = HexColor(rag_hex.get(rag, "#F8FAFC"))

        short_name = p["name"][:40] + ("…" if len(p["name"]) > 40 else "")
        row = [
            Paragraph(f"<b>#{idx+1}</b>", s_center),
            Paragraph(short_name, s_cell),
            Paragraph(str(p.get("strategic_alignment") or "—"), s_center),
            Paragraph(str(p.get("business_value")      or "—"), s_center),
            Paragraph(str(p.get("roi_estimated")       or "—"), s_center),
            Paragraph(str(p.get("urgency")             or "—"), s_center),
            Paragraph(str(p.get("risk_score")          or "—"), s_center),
            Paragraph(str(p.get("complexity")          or "—"), s_center),
            Paragraph(f"<b>{score}</b>", s_center),
            Paragraph(rag_label.get(rag, rag.upper()), s_center),
        ]
        table_data.append(row)
        r = idx + 1
        table_style_cmds.append(("BACKGROUND", (8, r), (8, r), score_bg))
        table_style_cmds.append(("BACKGROUND", (9, r), (9, r), rag_bg))
        table_style_cmds.append(("TEXTCOLOR", (9, r), (9, r), HexColor(rag_text.get(rag, "#000000"))))

    score_table = Table(table_data, colWidths=SCORE_COL_W, repeatRows=1)
    score_table.setStyle(TableStyle(table_style_cmds))
    elements.append(score_table)
    elements.append(Spacer(1, 10))

    # ─ Enveloppes ────────────────────────────────────────────────────────
    if envelopes:
        elements.append(Paragraph("Enveloppes Budgétaires", s_h2))
        for env in envelopes:
            capex_used  = totals["capex_planned"]
            opex_used   = totals["opex_planned"]
            capex_pct   = capex_used  / env["capex_envelope"]  * 100 if env["capex_envelope"]  else 0
            opex_pct    = opex_used   / env["opex_envelope"]   * 100 if env["opex_envelope"]   else 0
            capex_over  = capex_pct > 100
            opex_over   = opex_pct   > 100
            alert_txt   = "DÉPASSEMENT OPEX" if opex_over else ("DÉPASSEMENT CAPEX" if capex_over else "Dans les limites")
            alert_color = C_RED if (opex_over or capex_over) else C_GREEN

            env_hdr = [[
                Paragraph(f"<b>{env['label']}</b> — Exercice {env['year']}", s_cell_b),
                Paragraph(f"<font color='{'#EF4444' if (opex_over or capex_over) else '#10B981'}'>▌ {alert_txt}</font>", ParagraphStyle("al", fontSize=8, fontName="Helvetica-Bold", alignment=TA_RIGHT)),
            ]]
            env_hdr_t = Table(env_hdr, colWidths=[(W - 36*mm) * 0.65, (W - 36*mm) * 0.35])
            env_hdr_t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), C_BG_HDR),
                ("BOX", (0, 0), (-1, -1), 0.5, C_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            elements.append(env_hdr_t)

            env_data = [[
                Paragraph("", s_cell),
                Paragraph("Planifié", s_center),
                Paragraph("Enveloppe", s_center),
                Paragraph("Utilisation", s_center),
                Paragraph("Statut", s_center),
            ]]
            for label, used, envelope, over in [
                ("CAPEX", capex_used, env["capex_envelope"], capex_over),
                ("OPEX",  opex_used,  env["opex_envelope"],  opex_over),
            ]:
                pct_val = min(used / envelope * 100, 100) if envelope else 0
                stat    = f"{'⚠ ' if over else '✓ '}{used/1e6:.1f}M / {envelope/1e6:.1f}M€ ({int(used/envelope*100 if envelope else 0)}%)"
                env_data.append([
                    Paragraph(f"<b>{label}</b>", s_cell_b),
                    Paragraph(f"{used/1e6:.1f} M€", s_center),
                    Paragraph(f"{envelope/1e6:.1f} M€", s_center),
                    Paragraph(f"{int(used/envelope*100 if envelope else 0)}%", s_center),
                    Paragraph(f"{'DÉPASSEMENT' if over else 'OK'}", ParagraphStyle("st", fontSize=8, fontName="Helvetica-Bold",
                        textColor=C_RED if over else C_GREEN, alignment=TA_CENTER)),
                ])

            env_t = Table(env_data, colWidths=[(W - 36*mm) / 5] * 5)
            env_t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#1E293B")),
                ("TEXTCOLOR",  (0, 0), (-1, 0), white),
                ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE",   (0, 0), (-1, -1), 8),
                ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
                ("ALIGN",      (0, 1), (0, -1),  "LEFT"),
                ("GRID",       (0, 0), (-1, -1), 0.4, C_BORDER),
                ("TOPPADDING",    (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, C_BG_HDR]),
            ]))
            elements.append(env_t)
            elements.append(Spacer(1, 8))

    # ─ Bubble Chart ──────────────────────────────────────────────────────
    chart_img_w = (W - 36*mm)
    chart_img_h = chart_img_w * (5 / 9)
    elements.append(Paragraph("Carte Valeur vs Risque", s_h2))
    elements.append(RLImage(chart_buf, width=chart_img_w, height=chart_img_h))

    # ─ Footer ────────────────────────────────────────────────────────────
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER))
    elements.append(Paragraph(
        f"Document généré par MARCEL PPM · {now_str} · Confidentiel",
        ParagraphStyle("footer", fontSize=7, fontName="Helvetica", textColor=C_SLATE, alignment=TA_CENTER, spaceBefore=4),
    ))

    doc.build(elements)
    return buf.getvalue()
