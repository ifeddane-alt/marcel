"""Générateur PowerPoint COPIL — Projetenne"""
import io
from datetime import datetime
from typing import List, Optional

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# ---- Slide dimensions (widescreen 16:9) ----
SW = Inches(13.33)
SH = Inches(7.5)

# ---- Palette (fond blanc, accents Navy Blue) ----
NAVY        = RGBColor(0x0F, 0x17, 0x2A)
BLUE        = RGBColor(0x00, 0x52, 0xCC)
LIGHT_BLUE  = RGBColor(0xEB, 0xF2, 0xFF)
WHITE       = RGBColor(0xFF, 0xFF, 0xFF)
BG          = RGBColor(0xF8, 0xF9, 0xFA)
DARK        = RGBColor(0x1E, 0x29, 0x3B)
MID         = RGBColor(0x64, 0x74, 0x8B)
LIGHT       = RGBColor(0x94, 0xA3, 0xB8)
BORDER      = RGBColor(0xE2, 0xE8, 0xF0)
RED         = RGBColor(0xDC, 0x26, 0x26)
ORANGE_C    = RGBColor(0xD9, 0x77, 0x06)
GREEN_C     = RGBColor(0x16, 0xA3, 0x4A)
LIGHT_RED   = RGBColor(0xFE, 0xF2, 0xF2)
LIGHT_AMBER = RGBColor(0xFF, 0xF7, 0xED)
LIGHT_GREEN = RGBColor(0xF0, 0xFD, 0xF4)

DECISION_STATUS_COLORS = {
    "proposée":  RGBColor(0xE6, 0xF0, 0xFF),
    "prise":     RGBColor(0xED, 0xE9, 0xFE),
    "en_cours":  RGBColor(0xFE, 0xF3, 0xC7),
    "appliquée": RGBColor(0xDC, 0xFC, 0xE7),
    "reportée":  RGBColor(0xF1, 0xF5, 0xF9),
    "annulée":   RGBColor(0xFE, 0xE2, 0xE2),
}


# ---- Helper utilities ----

def _blank_slide(prs: Presentation):
    return prs.slides.add_slide(prs.slide_layouts[6])


def _rect(slide, left, top, width, height, fill=None, no_line=True, line_color=None, line_pt=0.5):
    shape = slide.shapes.add_shape(1, left, top, width, height)
    if fill:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill
    else:
        shape.fill.background()
    if no_line:
        shape.line.width = 0
    elif line_color:
        shape.line.color.rgb = line_color
        shape.line.width = Pt(line_pt)
    return shape


def _tb(slide, left, top, width, height, wrap=True):
    tb = slide.shapes.add_textbox(left, top, width, height)
    tb.text_frame.word_wrap = wrap
    return tb


def _clear(tf):
    for p in tf.paragraphs:
        p.clear()


def _run(tf, text, size=9, bold=False, color=None, align=PP_ALIGN.LEFT, space_before=0, italic=False):
    """Add a paragraph with a single run to a text frame."""
    p = tf.add_paragraph()
    p.alignment = align
    p.space_before = Pt(space_before)
    r = p.add_run()
    r.text = text
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = color or DARK
    return p


def keur(val):
    if val is None:
        return "—"
    return f"{int(val / 1000):,}".replace(",", "\u202f") + " K€"


def fmt_date(d):
    if not d:
        return "—"
    try:
        return datetime.fromisoformat(str(d).replace("Z", "")).strftime("%d/%m/%Y")
    except Exception:
        return str(d)[:10] if d else "—"


def trunc(s, n=55):
    if not s:
        return "—"
    return s[:n] + "…" if len(s) > n else s


def crit_color(c):
    return RED if c >= 16 else ORANGE_C if c >= 7 else GREEN_C


def crit_bg(c):
    return LIGHT_RED if c >= 16 else LIGHT_AMBER if c >= 7 else LIGHT_GREEN


def rag_color(rag):
    return {"green": GREEN_C, "orange": ORANGE_C, "red": RED}.get(str(rag), MID)


def rag_label(rag):
    return {"green": "Vert", "orange": "Orange", "red": "Rouge"}.get(str(rag), "—")


def status_label(s):
    return {
        "en_preparation": "En préparation", "actif": "Actif",
        "en_pause": "En pause", "cloture": "Clôturé", "archive": "Archivé",
    }.get(str(s), str(s) if s else "—")


def decision_status_label(s):
    return {
        "proposée": "Proposée", "prise": "Prise", "en_cours": "En cours",
        "appliquée": "Appliquée", "reportée": "Reportée", "annulée": "Annulée",
    }.get(str(s), str(s) if s else "—")


# ---- Header bar (top of every slide) ----

def _header(slide, title, subtitle=None, height_in=1.15):
    h = Inches(height_in)
    _rect(slide, 0, 0, SW, h, fill=NAVY)
    # Title
    tb = _tb(slide, Inches(0.4), Inches(0.1), SW - Inches(0.8), h - Inches(0.2))
    _clear(tb.text_frame)
    p = tb.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.LEFT
    r = p.add_run()
    r.text = title
    r.font.size = Pt(20)
    r.font.bold = True
    r.font.color.rgb = WHITE
    if subtitle:
        _run(tb.text_frame, subtitle, size=9, color=RGBColor(0xAA, 0xCC, 0xFF))


# ---- Section label ----

def _section_label(slide, left, top, width, height_in, label):
    h = Inches(height_in)
    _rect(slide, left, top, width, h, fill=LIGHT_BLUE, no_line=False, line_color=BORDER, line_pt=0.3)
    tb = _tb(slide, left + Inches(0.12), top + Inches(0.04), width - Inches(0.2), h)
    _clear(tb.text_frame)
    p = tb.text_frame.paragraphs[0]
    r = p.add_run()
    r.text = label.upper()
    r.font.size = Pt(7)
    r.font.bold = True
    r.font.color.rgb = BLUE


# ---- Slide footer ----

def _footer(slide, text="Projetenne · Confidentiel"):
    tb = _tb(slide, Inches(0.4), SH - Inches(0.3), SW - Inches(0.8), Inches(0.25))
    _clear(tb.text_frame)
    p = tb.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.RIGHT
    r = p.add_run()
    r.text = text
    r.font.size = Pt(6.5)
    r.font.color.rgb = LIGHT


# ---- Table helper ----

def _styled_table(slide, headers, rows, left, top, width, col_widths_in, row_height_in=0.38,
                  header_bg=NAVY, header_fg=WHITE):
    n_cols = len(headers)
    n_rows = len(rows) + 1
    h_total = Inches(row_height_in) * n_rows
    tf_shape = slide.shapes.add_table(n_rows, n_cols, left, top, width, h_total)
    tf = tf_shape.table

    for i, w in enumerate(col_widths_in):
        tf.columns[i].width = Inches(w)

    for row in tf.rows:
        row.height = Inches(row_height_in)

    # Header row
    for col, h in enumerate(headers):
        cell = tf.cell(0, col)
        cell.fill.solid()
        cell.fill.fore_color.rgb = header_bg
        cell.margin_left = Inches(0.06)
        cell.margin_right = Inches(0.04)
        cell.margin_top = Inches(0.02)
        cell.text_frame.paragraphs[0].clear()
        r = cell.text_frame.paragraphs[0].add_run()
        r.text = h
        r.font.size = Pt(8)
        r.font.bold = True
        r.font.color.rgb = header_fg
        cell.text_frame.paragraphs[0].alignment = PP_ALIGN.CENTER

    # Data rows
    for row_idx, row_data in enumerate(rows):
        row_num = row_idx + 1
        row_bg = BG if row_idx % 2 == 0 else WHITE
        for col, (val, opts) in enumerate(row_data):
            cell = tf.cell(row_num, col)
            cell.fill.solid()
            bg = opts.get("bg", row_bg)
            cell.fill.fore_color.rgb = bg
            cell.margin_left = Inches(0.06)
            cell.margin_right = Inches(0.04)
            cell.margin_top = Inches(0.02)
            cell.text_frame.paragraphs[0].clear()
            run = cell.text_frame.paragraphs[0].add_run()
            run.text = str(val)
            run.font.size = Pt(opts.get("size", 8))
            run.font.bold = opts.get("bold", False)
            run.font.color.rgb = opts.get("color", DARK)
            cell.text_frame.paragraphs[0].alignment = opts.get("align", PP_ALIGN.LEFT)

    return tf


# ====================================================================
# SLIDE 1 — GARDE
# ====================================================================

def add_slide_garde(prs, instance_name, instance_date, projects):
    slide = _blank_slide(prs)

    # Dark blue top half
    _rect(slide, 0, 0, SW, SH * 0.58, fill=NAVY)

    # App label
    app_tb = _tb(slide, Inches(0.5), Inches(0.35), Inches(5), Inches(0.35))
    _clear(app_tb.text_frame)
    r = app_tb.text_frame.paragraphs[0].add_run()
    r.text = "PROJETENNE  ·  EXPORT COPIL"
    r.font.size = Pt(8)
    r.font.bold = True
    r.font.color.rgb = RGBColor(0x5E, 0x8F, 0xFF)

    # Instance name
    ttb = _tb(slide, Inches(0.5), Inches(0.82), SW - Inches(1.0), Inches(1.6))
    ttb.text_frame.word_wrap = True
    _clear(ttb.text_frame)
    p = ttb.text_frame.paragraphs[0]
    r2 = p.add_run()
    r2.text = instance_name
    r2.font.size = Pt(32)
    r2.font.bold = True
    r2.font.color.rgb = WHITE

    # Date
    dtb = _tb(slide, Inches(0.5), Inches(2.5), Inches(8), Inches(0.4))
    _clear(dtb.text_frame)
    p = dtb.text_frame.paragraphs[0]
    r3 = p.add_run()
    r3.text = fmt_date(instance_date)
    r3.font.size = Pt(13)
    r3.font.color.rgb = RGBColor(0xAA, 0xCC, 0xFF)

    # Scope count
    scope_tb = _tb(slide, Inches(0.5), Inches(3.1), SW - Inches(1.0), Inches(0.35))
    _clear(scope_tb.text_frame)
    p = scope_tb.text_frame.paragraphs[0]
    r4 = p.add_run()
    r4.text = f"{len(projects)} projet{'s' if len(projects) > 1 else ''} en périmètre"
    r4.font.size = Pt(10)
    r4.font.color.rgb = LIGHT

    # Project list rows
    list_top = SH * 0.60
    row_h = Inches(0.43)
    for idx, p_data in enumerate(projects[:8]):
        row_y = list_top + idx * row_h
        rag = p_data.get("status_rag", "green")
        _rect(slide, Inches(0.4), row_y, SW - Inches(0.8), row_h - Inches(0.03),
              fill=BG, no_line=False, line_color=BORDER, line_pt=0.3)
        # RAG strip
        _rect(slide, Inches(0.4), row_y, Inches(0.06), row_h - Inches(0.03), fill=rag_color(rag))
        # Name
        ntb = _tb(slide, Inches(0.58), row_y + Inches(0.07), Inches(10.0), row_h)
        _clear(ntb.text_frame)
        pp = ntb.text_frame.paragraphs[0]
        rn = pp.add_run()
        rn.text = trunc(p_data.get("name", "?"), 65)
        rn.font.size = Pt(9)
        rn.font.bold = True
        rn.font.color.rgb = DARK
        # Budget
        btb = _tb(slide, SW - Inches(2.4), row_y + Inches(0.07), Inches(2.0), row_h)
        _clear(btb.text_frame)
        pp2 = btb.text_frame.paragraphs[0]
        pp2.alignment = PP_ALIGN.RIGHT
        rb = pp2.add_run()
        rb.text = keur(p_data.get("budget_total"))
        rb.font.size = Pt(8)
        rb.font.color.rgb = MID

    if len(projects) > 8:
        etb = _tb(slide, Inches(0.5), list_top + 8 * row_h + Inches(0.08), Inches(8), Inches(0.28))
        _clear(etb.text_frame)
        re = etb.text_frame.paragraphs[0].add_run()
        re.text = f"+ {len(projects) - 8} autre{'s' if len(projects) - 8 > 1 else ''} projet{'s' if len(projects) - 8 > 1 else ''}…"
        re.font.size = Pt(8)
        re.font.color.rgb = LIGHT

    _footer(slide)


# ====================================================================
# SLIDE 2 — SOMMAIRE
# ====================================================================

def add_slide_sommaire(prs, projects):
    slide = _blank_slide(prs)
    _header(slide, "Synthèse du Portefeuille",
            f"{len(projects)} projet{'s' if len(projects) > 1 else ''} sélectionné{'s' if len(projects) > 1 else ''}")

    headers = ["RAG", "Projet", "Responsable", "Budget (K€)", "EAC (K€)", "Écart", "Statut", "Fin forecast"]
    col_w = [0.55, 3.8, 1.7, 1.2, 1.2, 1.0, 1.3, 1.25]
    rows = []

    for p in projects:
        total = p.get("budget_total", 0) or 0
        eac = p.get("eac") or total
        ecart = eac - total
        ecart_pct = (ecart / total * 100) if total else 0
        ecart_str = f"{'+'if ecart>0 else ''}{int(ecart/1000):,}".replace(",", "\u202f")
        ecart_bg = LIGHT_RED if ecart > 0 else LIGHT_GREEN if ecart < 0 else BG
        rag = p.get("status_rag", "green")

        rows.append([
            (rag_label(rag), {"bg": {"green": LIGHT_GREEN, "orange": LIGHT_AMBER, "red": LIGHT_RED}.get(rag, BG),
                              "color": rag_color(rag), "bold": True, "align": PP_ALIGN.CENTER, "size": 8}),
            (trunc(p.get("name", "?"), 50), {}),
            (trunc(p.get("owner_name", p.get("metadata", {}).get("sponsor", "—")), 22), {"color": MID}),
            (f"{int(total/1000):,}".replace(",", "\u202f"), {"align": PP_ALIGN.RIGHT}),
            (f"{int(eac/1000):,}".replace(",", "\u202f"), {"align": PP_ALIGN.RIGHT, "bold": True}),
            (ecart_str + " K€", {"align": PP_ALIGN.RIGHT, "bg": ecart_bg,
                                  "color": RED if ecart > 0 else GREEN_C if ecart < 0 else DARK}),
            (status_label(p.get("status")), {"color": MID, "size": 7}),
            (fmt_date(p.get("end_date_forecast")), {"align": PP_ALIGN.CENTER, "color": MID}),
        ])

    table_left = Inches(0.25)
    table_width = sum(Inches(w) for w in col_w)
    _styled_table(slide, headers, rows, table_left, Inches(1.25), table_width, col_w, row_height_in=0.4)
    _footer(slide)


# ====================================================================
# SLIDE 3 — HEATMAP P×I (matplotlib)
# ====================================================================

def generate_heatmap_img(risks):
    fig, ax = plt.subplots(figsize=(5.5, 5.2))
    ax.set_facecolor("white")
    fig.patch.set_facecolor("white")

    for p in range(1, 6):
        for i in range(1, 6):
            crit = p * i
            fc = "#FEF2F2" if crit >= 16 else "#FFF7ED" if crit >= 7 else "#F0FDF4"
            ec = "#FECACA" if crit >= 16 else "#FED7AA" if crit >= 7 else "#BBF7D0"
            rect = mpatches.FancyBboxPatch(
                (i - 0.48, p - 0.48), 0.96, 0.96,
                boxstyle="square,pad=0", facecolor=fc, edgecolor=ec, linewidth=0.7, zorder=1,
            )
            ax.add_patch(rect)
            ax.text(i, p, str(crit), ha="center", va="center",
                    fontsize=8, color="#CBD5E1", zorder=2)

    risk_pos: dict = {}
    for r in risks:
        k = (int(r.get("impact", 1)), int(r.get("probability", 1)))
        risk_pos[k] = risk_pos.get(k, 0) + 1

    for (imp, prob), count in risk_pos.items():
        crit = prob * imp
        color = "#DC2626" if crit >= 16 else "#D97706" if crit >= 7 else "#16A34A"
        ax.scatter(imp, prob, s=min(180 + count * 40, 450), c=color,
                   zorder=5, edgecolors="white", linewidths=1.5, alpha=0.9)
        if count > 1:
            ax.text(imp, prob, str(count), ha="center", va="center",
                    fontsize=8, color="white", fontweight="bold", zorder=6)

    ax.set_xlim(0.48, 5.52)
    ax.set_ylim(0.48, 5.52)
    ax.set_xticks(range(1, 6))
    ax.set_yticks(range(1, 6))
    ax.set_xticklabels([str(i) for i in range(1, 6)], fontsize=9, color="#475569")
    ax.set_yticklabels([str(i) for i in range(1, 6)], fontsize=9, color="#475569")
    ax.set_xlabel("Impact  →", fontsize=10, color="#334155", labelpad=5)
    ax.set_ylabel("Probabilité  →", fontsize=10, color="#334155", labelpad=5)
    ax.tick_params(length=0)
    for spine in ax.spines.values():
        spine.set_edgecolor("#E2E8F0")
        spine.set_linewidth(0.5)
    ax.set_aspect("equal")
    plt.tight_layout(pad=0.8)

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=150, bbox_inches="tight",
                facecolor="white", edgecolor="none")
    plt.close(fig)
    buf.seek(0)
    return buf


def add_slide_heatmap(prs, risks, proj_names):
    slide = _blank_slide(prs)
    crit_n = sum(1 for r in risks if r.get("criticality", 0) >= 16)
    mod_n = sum(1 for r in risks if 7 <= r.get("criticality", 0) < 16)
    low_n = sum(1 for r in risks if r.get("criticality", 0) < 7)
    _header(slide, "Cartographie des Risques P × I",
            f"{len(risks)} risques au total  ·  Élevés : {crit_n}  ·  Modérés : {mod_n}  ·  Faibles : {low_n}")

    img_buf = generate_heatmap_img(risks)
    slide.shapes.add_picture(img_buf, Inches(0.3), Inches(1.25), width=Inches(6.7))

    # Right side: zone bars + top risks
    rx = Inches(7.3)
    ry = Inches(1.4)
    for label, count, bg, fg in [
        ("Risques ÉLEVÉS (P×I ≥ 16)", crit_n, LIGHT_RED, RED),
        ("Risques MODÉRÉS (P×I 7–15)", mod_n, LIGHT_AMBER, ORANGE_C),
        ("Risques FAIBLES (P×I ≤ 6)", low_n, LIGHT_GREEN, GREEN_C),
    ]:
        _rect(slide, rx, ry, Inches(5.7), Inches(0.75), fill=bg, no_line=False, line_color=BORDER, line_pt=0.3)
        tb_l = _tb(slide, rx + Inches(0.15), ry + Inches(0.08), Inches(4.0), Inches(0.6))
        _clear(tb_l.text_frame)
        _run(tb_l.text_frame, label, size=8, color=DARK)
        tb_n = _tb(slide, rx + Inches(4.2), ry + Inches(0.1), Inches(1.3), Inches(0.5))
        _clear(tb_n.text_frame)
        p = tb_n.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.RIGHT
        r = p.add_run()
        r.text = str(count)
        r.font.size = Pt(22)
        r.font.bold = True
        r.font.color.rgb = fg
        ry += Inches(0.85)

    # Top critical risks list
    top_risks = sorted(risks, key=lambda x: -x.get("criticality", 0))[:5]
    if top_risks:
        ry += Inches(0.15)
        lbl_tb = _tb(slide, rx, ry, Inches(5.7), Inches(0.26))
        _clear(lbl_tb.text_frame)
        _run(lbl_tb.text_frame, "TOP 5 RISQUES CRITIQUES", size=7, bold=True, color=MID)
        ry += Inches(0.28)
        for r_item in top_risks:
            crit = r_item.get("criticality", 0)
            pname = trunc(proj_names.get(r_item.get("project_id", ""), "?"), 20)
            _rect(slide, rx, ry, Inches(5.7), Inches(0.44), fill=BG, no_line=False, line_color=BORDER, line_pt=0.3)
            _rect(slide, rx + Inches(0.08), ry + Inches(0.12), Inches(0.2), Inches(0.2), fill=crit_color(crit))
            tb_r = _tb(slide, rx + Inches(0.38), ry + Inches(0.07), Inches(5.2), Inches(0.35))
            _clear(tb_r.text_frame)
            p = tb_r.text_frame.paragraphs[0]
            r_run = p.add_run()
            r_run.text = f"[{crit}] {trunc(r_item.get('title', '?'), 45)}"
            r_run.font.size = Pt(7.5)
            r_run.font.color.rgb = DARK
            p2 = tb_r.text_frame.add_paragraph()
            r2 = p2.add_run()
            r2.text = pname
            r2.font.size = Pt(6.5)
            r2.font.color.rgb = MID
            ry += Inches(0.47)

    _footer(slide)


# ====================================================================
# SLIDE 4 — TOP RISQUES CRITIQUES
# ====================================================================

def add_slide_top_risks(prs, risks, proj_names):
    slide = _blank_slide(prs)
    top = sorted(risks, key=lambda x: -x.get("criticality", 0))[:10]
    _header(slide, "Top Risques Critiques",
            f"Projets sélectionnés — {len(top)} risques présentés par criticité décroissante")

    headers = ["#", "Crit.", "Risque", "Catégorie", "Projet", "Statut", "Échéance", "Propriétaire"]
    col_w = [0.35, 0.55, 3.5, 1.1, 2.3, 0.9, 1.1, 1.7]
    rows = []
    for idx, r in enumerate(top):
        crit = r.get("criticality", 0)
        rows.append([
            (str(idx + 1), {"align": PP_ALIGN.CENTER, "color": MID}),
            (str(crit), {"align": PP_ALIGN.CENTER, "bold": True, "color": crit_color(crit), "bg": crit_bg(crit)}),
            (trunc(r.get("title", "?"), 55), {}),
            (r.get("category", "—"), {"color": MID}),
            (trunc(proj_names.get(r.get("project_id", ""), "?"), 32), {"color": BLUE}),
            (r.get("status", "—"), {"color": MID, "size": 7}),
            (fmt_date(r.get("due_date")), {"align": PP_ALIGN.CENTER, "color": MID}),
            (trunc(r.get("owner", "—") or "—", 22), {"color": MID}),
        ])

    left = Inches(0.25)
    width = sum(Inches(w) for w in col_w)
    _styled_table(slide, headers, rows, left, Inches(1.25), width, col_w, row_height_in=0.42)
    _footer(slide)


# ====================================================================
# SLIDE 5 — DÉCISIONS CLÉS
# ====================================================================

def add_slide_decisions(prs, decisions, governance_id=None):
    slide = _blank_slide(prs)
    subtitle = "Instance de gouvernance sélectionnée" if governance_id else "10 dernières décisions du périmètre"
    _header(slide, "Décisions Clés",
            f"{len(decisions)} décision{'s' if len(decisions) != 1 else ''}  ·  {subtitle}")

    headers = ["Date", "Décision", "Catégorie", "Statut", "Projet", "Responsable"]
    col_w = [1.1, 4.0, 1.3, 1.1, 3.0, 1.7]
    rows = []
    for d in decisions[:12]:
        status = d.get("status", "—")
        rows.append([
            (fmt_date(d.get("decision_date")), {"align": PP_ALIGN.CENTER, "color": MID}),
            (trunc(d.get("title", "?"), 65), {}),
            (d.get("category", "—"), {"color": MID}),
            (decision_status_label(status), {
                "align": PP_ALIGN.CENTER, "size": 7,
                "bg": DECISION_STATUS_COLORS.get(status, BG), "bold": True,
            }),
            (trunc(d.get("project_name", "?"), 38), {"color": BLUE}),
            (trunc(d.get("owner", "—") or "—", 22), {"color": MID}),
        ])

    left = Inches(0.25)
    width = sum(Inches(w) for w in col_w)
    _styled_table(slide, headers, rows, left, Inches(1.25), width, col_w, row_height_in=0.42)
    _footer(slide)


# ====================================================================
# SLIDE 6+N — FICHE PROJET
# ====================================================================

def add_slide_fiche(prs, project, milestones, risks, decisions):
    slide = _blank_slide(prs)

    name = project.get("name", "?")
    code = project.get("source_id", "")
    rag = project.get("status_rag", "green")
    status = project.get("status", "")
    methodology = project.get("methodology", "—")
    owner = project.get("owner_name") or project.get("metadata", {}).get("sponsor", "—") or "—"

    # ---- Header ----
    HEADER_H = Inches(1.2)
    _rect(slide, 0, 0, SW, HEADER_H, fill=NAVY)

    # RAG strip
    _rect(slide, 0, 0, Inches(0.18), HEADER_H, fill=rag_color(rag))

    ttb = _tb(slide, Inches(0.32), Inches(0.1), SW - Inches(4.0), Inches(0.65))
    _clear(ttb.text_frame)
    p = ttb.text_frame.paragraphs[0]
    r = p.add_run()
    r.text = trunc(name, 72)
    r.font.size = Pt(17)
    r.font.bold = True
    r.font.color.rgb = WHITE

    ctb = _tb(slide, Inches(0.32), Inches(0.78), Inches(4), Inches(0.32))
    _clear(ctb.text_frame)
    p2 = ctb.text_frame.paragraphs[0]
    r2 = p2.add_run()
    r2.text = code if code else ""
    r2.font.size = Pt(8)
    r2.font.color.rgb = LIGHT

    meta_tb = _tb(slide, Inches(4.0), Inches(0.78), SW - Inches(4.4), Inches(0.32))
    _clear(meta_tb.text_frame)
    p3 = meta_tb.text_frame.paragraphs[0]
    p3.alignment = PP_ALIGN.RIGHT
    r3 = p3.add_run()
    r3.text = f"{owner}  ·  {methodology.upper()}  ·  {status_label(status)}  ·  RAG {rag_label(rag).upper()}"
    r3.font.size = Pt(8)
    r3.font.color.rgb = rag_color(rag)

    # ---- Layout grid ----
    BODY_Y = HEADER_H + Inches(0.08)
    COL_W = Inches(6.35)
    L_X = Inches(0.2)
    R_X = SW - COL_W - Inches(0.2)
    TOP_H = Inches(2.7)
    BTM_H = SH - BODY_Y - TOP_H - Inches(0.25) - Inches(0.08)
    TOP_Y = BODY_Y
    BTM_Y = BODY_Y + TOP_H + Inches(0.1)

    # ---- BUDGET (top-left) ----
    _section_label(slide, L_X, TOP_Y, COL_W, 0.26, "Budget")
    bud_y = TOP_Y + Inches(0.26)

    capex_p = project.get("capex_planned", 0) or 0
    capex_c = project.get("capex_consumed", 0) or 0
    opex_p = project.get("opex_planned", 0) or 0
    opex_c = project.get("opex_consumed", 0) or 0
    total = project.get("budget_total", 0) or 0
    consumed = project.get("budget_consumed", 0) or (capex_c + opex_c)
    eac = project.get("eac") or total
    ecart = eac - total
    ecart_pct = (ecart / total * 100) if total else 0
    cons_pct = min(int(consumed / total * 100), 100) if total else 0

    # 2-column CAPEX / OPEX rows
    for (lbl1, v1, lbl2, v2) in [
        ("CAPEX prévu", keur(capex_p), "CAPEX consommé", keur(capex_c)),
        ("OPEX prévu", keur(opex_p), "OPEX consommé", keur(opex_c)),
    ]:
        half = COL_W // 2 - Inches(0.04)
        for lbl, val, bx in [(lbl1, v1, L_X), (lbl2, v2, L_X + half + Inches(0.06))]:
            _rect(slide, bx, bud_y, half, Inches(0.5), fill=BG, no_line=False, line_color=BORDER, line_pt=0.3)
            tb_b = _tb(slide, bx + Inches(0.1), bud_y + Inches(0.04), half - Inches(0.15), Inches(0.46))
            _clear(tb_b.text_frame)
            _run(tb_b.text_frame, lbl, size=7, color=LIGHT)
            _run(tb_b.text_frame, val, size=10, bold=True, color=DARK)
        bud_y += Inches(0.54)

    # EAC row
    eac_col = RED if ecart > 0 else GREEN_C if ecart < 0 else DARK
    ecart_str = (f"{'+'if ecart>0 else ''}{int(ecart/1000):,}".replace(",", "\u202f") +
                 f" K€  ({'+' if ecart_pct > 0 else ''}{ecart_pct:.1f}%)" if total else "—")
    _rect(slide, L_X, bud_y, COL_W, Inches(0.54), fill=LIGHT_BLUE, no_line=False, line_color=BORDER, line_pt=0.4)
    eac_tb = _tb(slide, L_X + Inches(0.12), bud_y + Inches(0.06), COL_W - Inches(0.2), Inches(0.46))
    _clear(eac_tb.text_frame)
    p_eac = eac_tb.text_frame.paragraphs[0]
    r_l = p_eac.add_run()
    r_l.text = "EAC : "
    r_l.font.size = Pt(9)
    r_l.font.color.rgb = MID
    r_v = p_eac.add_run()
    r_v.text = keur(eac)
    r_v.font.size = Pt(12)
    r_v.font.bold = True
    r_v.font.color.rgb = DARK
    r_e = p_eac.add_run()
    r_e.text = f"     Écart : {ecart_str}"
    r_e.font.size = Pt(8.5)
    r_e.font.color.rgb = eac_col
    bud_y += Inches(0.58)

    # Progress bar
    _rect(slide, L_X, bud_y, COL_W, Inches(0.13), fill=BORDER)
    if cons_pct > 0:
        bar_w = int(COL_W * cons_pct / 100)
        _rect(slide, L_X, bud_y, bar_w, Inches(0.13), fill=RED if cons_pct >= 90 else BLUE)
    bud_y += Inches(0.15)
    pct_tb = _tb(slide, L_X, bud_y, COL_W, Inches(0.2))
    _clear(pct_tb.text_frame)
    pp_pct = pct_tb.text_frame.paragraphs[0]
    r_pct = pp_pct.add_run()
    r_pct.text = f"Avancement budgétaire : {cons_pct}%  ({keur(consumed)} / {keur(total)})"
    r_pct.font.size = Pt(7)
    r_pct.font.color.rgb = MID

    # ---- PLANNING (top-right) ----
    _section_label(slide, R_X, TOP_Y, COL_W, 0.26, "Planning")
    plan_y = TOP_Y + Inches(0.26)

    start = project.get("start_date", "") or ""
    end_base = project.get("end_date_baseline", "") or ""
    end_fore = project.get("end_date_forecast", "") or ""
    delay_str, delay_color = "—", DARK
    if end_base and end_fore:
        try:
            d_base = datetime.fromisoformat(str(end_base).replace("Z", ""))
            d_fore = datetime.fromisoformat(str(end_fore).replace("Z", ""))
            days = (d_fore - d_base).days
            if days > 0:
                delay_str, delay_color = f"+{days} jours (retard)", RED
            elif days < 0:
                delay_str, delay_color = f"{abs(days)} jours (avance)", GREEN_C
            else:
                delay_str, delay_color = "Dans les délais", GREEN_C
        except Exception:
            pass

    for i, (lbl, val, vc) in enumerate([
        ("Début", fmt_date(start), MID),
        ("Fin baseline (initiale)", fmt_date(end_base), MID),
        ("Fin forecast (actuelle)", fmt_date(end_fore), RED if delay_color == RED else MID),
        ("Délai vs baseline", delay_str, delay_color),
    ]):
        ry_plan = plan_y + i * Inches(0.42)
        _rect(slide, R_X, ry_plan, COL_W, Inches(0.4), fill=BG if i % 2 == 0 else WHITE,
              no_line=False, line_color=BORDER, line_pt=0.3)
        lbl_tb = _tb(slide, R_X + Inches(0.1), ry_plan + Inches(0.07), COL_W * 0.42, Inches(0.3))
        _clear(lbl_tb.text_frame)
        _run(lbl_tb.text_frame, lbl, size=8, color=MID)
        val_tb = _tb(slide, R_X + COL_W * 0.44, ry_plan + Inches(0.07), COL_W * 0.54, Inches(0.3))
        _clear(val_tb.text_frame)
        _run(val_tb.text_frame, val, size=9, bold=True, color=vc)

    # ---- JALONS (bottom-left) ----
    _section_label(slide, L_X, BTM_Y, COL_W, 0.26, "Jalons Clés")
    mil_y = BTM_Y + Inches(0.26)
    now_str = datetime.now().isoformat()
    past = [m for m in milestones if (m.get("date_forecast") or "") < now_str][-3:]
    future = [m for m in milestones if (m.get("date_forecast") or "") >= now_str][:3]
    combined = [(False, m) for m in reversed(past)] + [(True, m) for m in future]

    for i, (upcoming, ms) in enumerate(combined[:6]):
        my = mil_y + i * Inches(0.4)
        _rect(slide, L_X, my, COL_W, Inches(0.38), fill=LIGHT_BLUE if upcoming else BG,
              no_line=False, line_color=BORDER, line_pt=0.3)
        dtb = _tb(slide, L_X + Inches(0.1), my + Inches(0.07), Inches(1.1), Inches(0.28))
        _clear(dtb.text_frame)
        _run(dtb.text_frame, fmt_date(ms.get("date_forecast")), size=7.5,
             color=BLUE if upcoming else MID, bold=upcoming)
        ntb = _tb(slide, L_X + Inches(1.25), my + Inches(0.07), COL_W - Inches(1.4), Inches(0.28))
        _clear(ntb.text_frame)
        _run(ntb.text_frame, trunc(ms.get("name", "?"), 42), size=7.5, color=DARK)

    if not combined:
        ntb = _tb(slide, L_X + Inches(0.1), mil_y + Inches(0.1), COL_W - Inches(0.2), Inches(0.3))
        _clear(ntb.text_frame)
        _run(ntb.text_frame, "Aucun jalon défini.", size=8, color=LIGHT, italic=True)

    # ---- RISQUES & DÉCISIONS (bottom-right) ----
    _section_label(slide, R_X, BTM_Y, COL_W, 0.26, "Risques & Décisions")
    rd_y = BTM_Y + Inches(0.26)

    top3 = sorted(risks, key=lambda x: -x.get("criticality", 0))[:3]
    for r_item in top3:
        crit = r_item.get("criticality", 0)
        _rect(slide, R_X, rd_y, COL_W, Inches(0.4), fill=crit_bg(crit),
              no_line=False, line_color=BORDER, line_pt=0.3)
        _rect(slide, R_X + Inches(0.1), rd_y + Inches(0.12), Inches(0.2), Inches(0.18), fill=crit_color(crit))
        rtb = _tb(slide, R_X + Inches(0.4), rd_y + Inches(0.07), COL_W - Inches(0.55), Inches(0.3))
        _clear(rtb.text_frame)
        _run(rtb.text_frame, f"[{crit}] {trunc(r_item.get('title', '?'), 46)}", size=7.5, color=DARK)
        rd_y += Inches(0.43)

    if not top3:
        ntb = _tb(slide, R_X + Inches(0.1), rd_y + Inches(0.05), COL_W, Inches(0.3))
        _clear(ntb.text_frame)
        _run(ntb.text_frame, "Aucun risque enregistré.", size=8, color=LIGHT, italic=True)
        rd_y += Inches(0.35)

    # Separator
    _rect(slide, R_X, rd_y + Inches(0.04), COL_W, Inches(0.01), fill=BORDER)
    rd_y += Inches(0.15)

    last3 = decisions[:3]
    for d in last3:
        dstatus = d.get("status", "—")
        _rect(slide, R_X, rd_y, COL_W, Inches(0.4), fill=DECISION_STATUS_COLORS.get(dstatus, BG),
              no_line=False, line_color=BORDER, line_pt=0.3)
        dtb = _tb(slide, R_X + Inches(0.1), rd_y + Inches(0.07), COL_W - Inches(1.7), Inches(0.3))
        _clear(dtb.text_frame)
        _run(dtb.text_frame, trunc(d.get("title", "?"), 42), size=7.5, color=DARK)
        date_tb = _tb(slide, R_X + COL_W - Inches(1.6), rd_y + Inches(0.07), Inches(1.5), Inches(0.3))
        _clear(date_tb.text_frame)
        pp_d = date_tb.text_frame.paragraphs[0]
        pp_d.alignment = PP_ALIGN.RIGHT
        rr = pp_d.add_run()
        rr.text = f"{fmt_date(d.get('decision_date'))}  ·  {decision_status_label(dstatus)[:4]}"
        rr.font.size = Pt(6.5)
        rr.font.color.rgb = MID
        rd_y += Inches(0.43)

    if not last3:
        ntb = _tb(slide, R_X + Inches(0.1), rd_y + Inches(0.05), COL_W, Inches(0.3))
        _clear(ntb.text_frame)
        _run(ntb.text_frame, "Aucune décision enregistrée.", size=8, color=LIGHT, italic=True)

    _footer(slide, f"{rag_label(rag)}  ·  {trunc(name, 40)}")


# ====================================================================
# MAIN ENTRY POINT
# ====================================================================

def generate_copil_pptx(instance_name, instance_date, projects,
                        all_milestones, all_risks, all_decisions,
                        governance_id=None):
    prs = Presentation()
    prs.slide_width = SW
    prs.slide_height = SH

    proj_names = {p["project_id"]: p["name"] for p in projects}

    # Enrich decisions with project_name
    for d in all_decisions:
        d["project_name"] = proj_names.get(d.get("project_id", ""), "?")

    # Slide 1 — Garde
    add_slide_garde(prs, instance_name, instance_date, projects)

    # Slide 2 — Sommaire
    add_slide_sommaire(prs, projects)

    # Slide 3 — Heatmap
    if all_risks:
        add_slide_heatmap(prs, all_risks, proj_names)

    # Slide 4 — Top risques
    if all_risks:
        add_slide_top_risks(prs, all_risks, proj_names)

    # Slide 5 — Décisions
    if all_decisions:
        add_slide_decisions(prs, all_decisions[:10], governance_id)

    # Slide 6+N — Fiche par projet
    for p in projects:
        pid = p["project_id"]
        ms = [m for m in all_milestones if m.get("project_id") == pid]
        ms_sorted = sorted(ms, key=lambda x: x.get("date_forecast") or "")
        r_proj = sorted([r for r in all_risks if r.get("project_id") == pid],
                        key=lambda x: -x.get("criticality", 0))
        d_proj = [d for d in all_decisions if d.get("project_id") == pid]
        add_slide_fiche(prs, p, ms_sorted, r_proj, d_proj)

    buf = io.BytesIO()
    prs.save(buf)
    buf.seek(0)
    return buf
