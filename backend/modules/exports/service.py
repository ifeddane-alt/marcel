"""Exports PowerPoint — COPIL portefeuille."""
from datetime import date

from core.database import db
from core.pptx import MarcelDeck, GREEN, AMBER, RED, INDIGO, MUTED

RAG_COLOR = {"green": GREEN, "orange": AMBER, "red": RED}
RAG_LABEL = {"green": "Vert", "orange": "Orange", "red": "Rouge"}
STATUS_LABEL = {"actif": "Actif", "pause": "En pause", "termine": "Terminé", "annule": "Annulé"}


def _eur(v) -> str:
    v = v or 0
    if abs(v) >= 1_000_000:
        return f"{v/1_000_000:.1f} M€".replace(".", ",")
    if abs(v) >= 1_000:
        return f"{v/1_000:.0f} K€"
    return f"{v:.0f} €"


async def build_copil_pptx(user) -> bytes:
    tenant = await db.tenants.find_one({"tenant_id": user.tenant_id}, {"_id": 0, "name": 1}) or {}
    deck = MarcelDeck(tenant.get("name", ""))

    projects = await db.projects.find(
        {"tenant_id": user.tenant_id},
        {"_id": 0, "project_id": 1, "name": 1, "code": 1, "status": 1, "status_rag": 1,
         "budget_total": 1, "budget_consumed": 1, "eac": 1, "end_date": 1}).to_list(None)
    actifs = [p for p in projects if p.get("status") == "actif"]
    rag = {"green": 0, "orange": 0, "red": 0}
    for p in actifs:
        rag[p.get("status_rag", "green")] = rag.get(p.get("status_rag", "green"), 0) + 1
    budget = sum(p.get("budget_total") or 0 for p in actifs)
    consumed = sum(p.get("budget_consumed") or 0 for p in actifs)

    deck.cover("COPIL Portefeuille", "Comité de pilotage — synthèse mensuelle")

    deck.kpis("Vue d'ensemble du portefeuille", [
        {"label": "Projets actifs", "value": len(actifs)},
        {"label": "Verts", "value": rag["green"], "color": GREEN},
        {"label": "Orange", "value": rag["orange"], "color": AMBER},
        {"label": "Rouges", "value": rag["red"], "color": RED},
        {"label": "Budget engagé", "value": _eur(budget), "hint": f"Consommé : {_eur(consumed)}"},
    ])

    top = sorted(actifs, key=lambda p: -(p.get("budget_total") or 0))[:10]
    rows, colors = [], {}
    for i, p in enumerate(top):
        r = p.get("status_rag", "green")
        rows.append([p.get("code") or "—", p.get("name", "")[:52], RAG_LABEL.get(r, r),
                     _eur(p.get("budget_total")), _eur(p.get("budget_consumed")), _eur(p.get("eac"))])
        colors[(i, 2)] = RAG_COLOR.get(r, INDIGO)
    deck.table("Projets du portefeuille", ["Code", "Projet", "RAG", "Budget", "Consommé", "EAC"],
               rows, subtitle="Top 10 par budget", col_widths=[1.1, 4.2, 0.9, 1.3, 1.3, 1.3], cell_colors=colors)

    alerts = [p for p in actifs if p.get("status_rag") in ("red", "orange")]
    if alerts:
        arows, acolors = [], {}
        for i, p in enumerate(sorted(alerts, key=lambda x: 0 if x.get("status_rag") == "red" else 1)[:10]):
            r = p.get("status_rag")
            over = (p.get("eac") or 0) - (p.get("budget_total") or 0)
            arows.append([p.get("code") or "—", p.get("name", "")[:50], RAG_LABEL.get(r, r),
                          _eur(over) if over > 0 else "—", p.get("end_date") or "—"])
            acolors[(i, 2)] = RAG_COLOR.get(r, INDIGO)
        deck.table("Projets sous surveillance", ["Code", "Projet", "RAG", "Dépassement EAC", "Fin prévue"],
                   arows, col_widths=[1.1, 4.5, 0.9, 1.6, 1.4], cell_colors=acolors)

    decisions = await db.decisions.find(
        {"tenant_id": user.tenant_id}, {"_id": 0, "title": 1, "status": 1, "decision_date": 1, "owner": 1}
    ).sort("decision_date", -1).limit(8).to_list(None)
    if decisions:
        deck.table("Décisions récentes", ["Décision", "Statut", "Date", "Porteur"],
                   [[d.get("title", "")[:60], d.get("status", ""), d.get("decision_date") or "—",
                     d.get("owner") or "—"] for d in decisions],
                   col_widths=[4.6, 1.2, 1.2, 1.6])

    events = await db.events.find(
        {"tenant_id": user.tenant_id, "date": {"$gte": date.today().isoformat()}, "status": "planifie"},
        {"_id": 0, "title": 1, "date": 1, "level": 1}).sort("date", 1).limit(10).to_list(None)
    if events:
        deck.table("Prochaines instances", ["Date", "Instance", "Niveau"],
                   [[e["date"], e["title"], e["level"].capitalize()] for e in events],
                   subtitle="Calendrier des instances MARCEL", col_widths=[1.2, 4.5, 1.5])

    deck.section("Merci", "Généré automatiquement par MARCEL")
    return deck.to_bytes()
