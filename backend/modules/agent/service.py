"""Agent IA PMO — Service principal.

Fonctionnalités :
1. Chatbot conversationnel via Claude (emergentintegrations) — historique persisté en DB
2. Recommandations proactives déterministes (6 règles)
3. Gestion des règles d'alerte personnalisées (user_alert_rules)
4. Simulations what-if détectées automatiquement
5. Guardrails anti-hallucination post-validation
"""
import re
import time
import uuid
from datetime import datetime, timezone, date
from typing import List, Optional, Tuple

from fastapi import HTTPException

from core.database import db
from core.auth import TokenPayload
from .schemas import ChatRequest, AlertRuleCreate, AlertRuleUpdate

import os
from emergentintegrations.llm.chat import LlmChat, UserMessage

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")

# ── Mots-clés pour détecter les questions what-if ─────────────────────────────
WHAT_IF_KEYWORDS = [
    "si je", "si nous", "si on", "que se passerait-il", "simulons", "simule",
    "que se passe-t-il si", "impact si", "impact de", "et si",
    "scénario", "scenario", "simuler", "que se passe si", "si le projet",
    "si on annule", "si on décale", "si on réduit", "que se passe", "si j'",
]

# ── Prompt système PMO ────────────────────────────────────────────────────────
SYSTEM_PROMPT_TEMPLATE = """Tu es l'Agent IA PMO de Projetenne, assistant expert en gestion de portefeuille de projets (PPM) pour le Groupe Altair Industries.

RÈGLES STRICTES D'ANTI-HALLUCINATION :
1. Tu réponds UNIQUEMENT à partir des données fournies dans le contexte PMO ci-dessous.
2. Tu n'inventes JAMAIS de données, chiffres, noms ou dates qui ne figurent pas dans le contexte.
3. Pour chaque information chiffrée que tu mentionnes, cite la source exacte entre parenthèses (ex : source : Projet Phoenix — EAC 4 550 000 €).
4. Si une information n'est pas disponible dans le contexte, réponds EXACTEMENT : "Cette information n'est pas disponible dans les données actuelles du portefeuille."
5. Tu n'as PAS accès à Internet ni à des données externes à ce contexte.
6. Pour les simulations what-if : utilise UNIQUEMENT les chiffres du contexte, explique tes hypothèses de calcul, et marque le résultat avec "⚠️ SIMULATION — non persistée en base de données".
7. Réponds TOUJOURS en français, de façon concise, structurée et orientée aide à la décision PMO.
8. Ne mentionne jamais le nom d'autres outils (Jira, SAP, etc.) comme sources — tu parles du portefeuille Projetenne.

{context}

{history}"""


# ── Construction du contexte PMO ──────────────────────────────────────────────
async def build_pmo_context(tenant_id: str) -> str:
    """Construit un contexte textuel structuré à partir des données MongoDB."""
    today = date.today()

    # 1. Projets
    projects = await db.projects.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "project_id": 1, "name": 1, "status_rag": 1, "budget_total": 1,
         "budget_consumed": 1, "budget_forecast": 1, "methodology": 1,
         "end_date_forecast": 1, "owner": 1, "phase": 1, "status": 1,
         "capex_planned": 1, "opex_planned": 1, "jh_planned": 1, "jh_consumed": 1,
         "start_date": 1, "end_date_baseline": 1}
    ).to_list(50)

    proj_map = {p["project_id"]: p["name"] for p in projects}

    # 2. Risques top 15
    risks = await db.risks.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "risk_id": 1, "title": 1, "criticality": 1, "status": 1,
         "project_id": 1, "category": 1, "owner": 1, "probability": 1, "impact": 1}
    ).sort("criticality", -1).to_list(15)

    # 3. Équipes
    teams = await db.teams.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "team_id": 1, "name": 1}
    ).to_list(20)

    team_map = {t["team_id"]: t["name"] for t in teams}  # noqa: F841

    # Capacité par équipe (via ressources)
    resources = await db.resources.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "resource_id": 1, "name": 1, "team_id": 1,
         "capacity_jh_month": 1, "availability_rate": 1}
    ).to_list(100)

    team_capacity = {}
    for r in resources:
        tid = r.get("team_id") or "__none__"
        capa = (r.get("capacity_jh_month") or 0) * ((r.get("availability_rate") or 100) / 100)
        team_capacity[tid] = team_capacity.get(tid, 0) + capa

    # 4. Enveloppes portefeuille
    envelopes = await db.portfolio_envelopes.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "label": 1, "year": 1, "capex_envelope": 1, "opex_envelope": 1,
         "total_envelope": 1, "envelope_id": 1}
    ).to_list(10)

    # 5. Jalons urgents (prochain 90j ou en retard)
    milestone_filter = {
        "tenant_id": tenant_id,
        "status": {"$nin": ["done", "completed", "annulé"]},
    }
    milestones = await db.milestones.find(
        milestone_filter,
        {"_id": 0, "milestone_id": 1, "name": 1, "target_date": 1, "project_id": 1, "milestone_type": 1}
    ).sort("target_date", 1).to_list(20)

    # ── Assemblage du contexte ──
    lines = []

    lines.append("=== PROJETS DU PORTEFEUILLE ===")
    for p in projects:
        total = p.get("budget_total") or 0
        consumed = p.get("budget_consumed") or 0
        forecast = p.get("budget_forecast") or 0
        eac_overrun = forecast > total * 1.05 if total > 0 else False
        pct_conso = round(consumed / total * 100) if total > 0 else 0
        eac_pct = round(forecast / total * 100) if total > 0 else 0
        jh_p = p.get("jh_planned") or 0
        jh_c = p.get("jh_consumed") or 0

        lines.append(
            f"• {p['name']} (méthodo:{p.get('methodology','?')}) | RAG:{p.get('status_rag','?').upper()} | "
            f"Budget:{total:,.0f}€ | Consommé:{consumed:,.0f}€ ({pct_conso}%) | "
            f"EAC:{forecast:,.0f}€ ({eac_pct}%){' ⚠️ DÉPASSEMENT EAC' if eac_overrun else ''} | "
            f"JH:{jh_c}/{jh_p} | Fin prévue:{p.get('end_date_forecast','?')} | "
            f"CAPEX planifié:{p.get('capex_planned',0):,.0f}€ | OPEX planifié:{p.get('opex_planned',0):,.0f}€ | "
            f"ID:{p['project_id']}"
        )

    # Totaux CAPEX/OPEX
    total_capex = sum((p.get("capex_planned") or 0) for p in projects)
    total_opex = sum((p.get("opex_planned") or 0) for p in projects)
    lines.append(f"\nTOTAL PORTEFEUILLE : CAPEX planifié {total_capex:,.0f}€ | OPEX planifié {total_opex:,.0f}€")

    lines.append("\n=== TOP 15 RISQUES (par criticité décroissante) ===")
    for r in risks:
        proj_name = proj_map.get(r.get("project_id", ""), "inconnu")
        lines.append(
            f"• [{r.get('criticality',0)}/25] {r.get('title','?')} | "
            f"Projet:{proj_name} | Catégorie:{r.get('category','?')} | "
            f"Statut:{r.get('status','?')} | Responsable:{r.get('owner','?')}"
        )

    lines.append("\n=== ÉQUIPES ET CAPACITÉS ===")
    for t in teams:
        tid = t["team_id"]
        capa = round(team_capacity.get(tid, 0), 1)
        lines.append(f"• {t['name']} | Capacité mensuelle: {capa} JH | ID:{tid}")

    if envelopes:
        lines.append("\n=== ENVELOPPES PORTEFEUILLE ===")
        for e in envelopes:
            cap_env = e.get("capex_envelope", 0) or 0
            opx_env = e.get("opex_envelope", 0) or 0
            capex_pct = round(total_capex / cap_env * 100) if cap_env > 0 else 0
            opex_pct = round(total_opex / opx_env * 100) if opx_env > 0 else 0
            lines.append(
                f"• {e.get('label','?')} {e.get('year','?')} | "
                f"CAPEX: {total_capex:,.0f}€ / {cap_env:,.0f}€ ({capex_pct}%){' ⚠️ DÉPASSEMENT' if capex_pct > 100 else ''} | "
                f"OPEX: {total_opex:,.0f}€ / {opx_env:,.0f}€ ({opex_pct}%){' ⚠️ DÉPASSEMENT' if opex_pct > 100 else ''}"
            )

    if milestones:
        lines.append("\n=== JALONS ACTIFS ===")
        for m in milestones[:15]:
            proj_name = proj_map.get(m.get("project_id", ""), "inconnu")
            try:
                d = date.fromisoformat(m["target_date"])
                delta = (d - today).days
                status = f"RETARD {abs(delta)}j" if delta < 0 else f"dans {delta}j"
            except (ValueError, TypeError, KeyError):
                status = "date inconnue"
            lines.append(f"• {m.get('name','?')} | Projet:{proj_name} | Échéance:{m.get('target_date','?')} ({status})")

    lines.append("\n=== DATE ACTUELLE ===")
    lines.append(f"Aujourd'hui : {today.isoformat()} (mois courant : {today.strftime('%B %Y')})")

    return "CONTEXTE PMO ACTUEL :\n" + "\n".join(lines)


# ── Détection what-if ─────────────────────────────────────────────────────────
def detect_what_if(question: str) -> bool:
    q = question.lower()
    return any(kw in q for kw in WHAT_IF_KEYWORDS)


# ── Guardrail anti-hallucination ──────────────────────────────────────────────
def validate_response(response_text: str, context: str, project_names: List[str]) -> Tuple[bool, List[str]]:
    """
    Vérifie que :
    1. Les noms de projets cités dans la réponse existent dans le portefeuille.
    2. Les grands montants (> 100 k€) mentionnés sont présents dans le contexte.
    """
    warnings = []

    # 1. Vérification noms de projets
    # Extrait les mots capitalissés après "projet" dans la réponse
    proj_mentions = re.findall(r'[Pp]rojet\s+([A-ZÁÀÂÉÈÊÏÎÔÙÛÜ][^\s,\.]+(?:\s+[A-ZÁÀÂÉÈÊÏÎÔÙÛÜ][^\s,\.]+)?)', response_text)
    known_names_lower = {n.lower() for n in project_names}
    unknown = []
    for mention in proj_mentions:
        mention_clean = mention.strip().lower()
        if len(mention_clean) > 3 and not any(mention_clean in kn or kn in mention_clean for kn in known_names_lower):
            unknown.append(mention.strip())

    if unknown:
        warnings.append(f"Projet(s) non identifié(s) dans le portefeuille mentionné(s) par l'IA : {', '.join(unknown[:3])}")

    # 2. Vérification des grands montants (heuristique)
    money_pattern = r'(\d[\d\s\u202f]*(?:[.,]\d+)?)\s*(?:€|M€|k€|euros?)'
    matches = re.findall(money_pattern, response_text, re.IGNORECASE)
    suspicious = []
    for m in matches:
        try:
            val = float(m.replace('\u202f', '').replace(' ', '').replace(',', '.').replace('\xa0', ''))
            if val > 100000:  # Vérifie uniquement les montants > 100k€
                val_normalized = str(int(val))
                # Cherche si ce nombre est dans le contexte (en format entier ou arrondi)
                if val_normalized not in context.replace(' ', '').replace(',', '').replace('.', ''):
                    # Tolérance : vérifie ±5%
                    in_context = any(
                        abs(val - float(s.replace('\u202f', '').replace(' ', '').replace(',', '.'))) / max(val, 1) < 0.06
                        for s in re.findall(r'\d[\d\s\u202f]*(?:[.,]\d+)?', context)
                        if len(s.replace(' ', '')) >= 5
                        if float(s.replace('\u202f', '').replace(' ', '').replace(',', '.')) > 50000
                    )
                    if not in_context:
                        suspicious.append(f"{val:,.0f}€")
        except (ValueError, TypeError):
            pass

    if len(suspicious) > 1:
        warnings.append(
            f"Valeur(s) financière(s) non vérifiée(s) dans les données sources : {', '.join(suspicious[:3])}. "
            "Ces chiffres peuvent résulter d'un calcul — veuillez vérifier."
        )

    return len(warnings) == 0, warnings


# ── Chat conversationnel ──────────────────────────────────────────────────────
async def chat(request: ChatRequest, user: TokenPayload) -> dict:
    start = time.time()

    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "Clé LLM non configurée. Contactez l'administrateur.")

    # 1. Session ID
    session_id = request.session_id or str(uuid.uuid4())

    # 2. Historique de la session depuis la DB (max 8 échanges)
    prior_logs = await db.agent_logs.find(
        {"tenant_id": user.tenant_id, "session_id": session_id},
        {"_id": 0, "question": 1, "response": 1, "created_at": 1}
    ).sort("created_at", 1).to_list(8)

    # 3. Contexte PMO
    context = await build_pmo_context(user.tenant_id)

    # 4. Historique de la session (format texte pour le prompt)
    history_lines = []
    if prior_logs:
        history_lines.append("HISTORIQUE DE CETTE CONVERSATION :")
        for log in prior_logs[-6:]:
            history_lines.append(f"UTILISATEUR: {log['question']}")
            resp_excerpt = log["response"][:600] + ("..." if len(log["response"]) > 600 else "")
            history_lines.append(f"ASSISTANT PMO: {resp_excerpt}")
    history_section = "\n".join(history_lines) if history_lines else ""

    # 5. Détection simulation what-if
    is_simulation = detect_what_if(request.question)

    # 6. Prompt système final
    system_msg = SYSTEM_PROMPT_TEMPLATE.format(
        context=context,
        history=history_section
    )
    if is_simulation:
        system_msg += (
            "\n\nATTENTION : La question suivante est une SIMULATION what-if. "
            "Calcule uniquement à partir des données du contexte fourni. "
            "Explique tes hypothèses de calcul étape par étape. "
            "Termine obligatoirement par '⚠️ SIMULATION — non persistée en base de données'."
        )

    # 7. Appel Claude via emergentintegrations
    internal_session = str(uuid.uuid4())
    llm_chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=internal_session,
        system_message=system_msg
    ).with_model("anthropic", os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"))

    try:
        response_text = await llm_chat.send_message(UserMessage(text=request.question))
    except Exception as e:
        raise HTTPException(500, f"Erreur lors de l'appel à l'IA : {str(e)}")

    duration_ms = int((time.time() - start) * 1000)

    # 8. Guardrails anti-hallucination
    projects = await db.projects.find(
        {"tenant_id": user.tenant_id}, {"_id": 0, "name": 1}
    ).to_list(50)
    proj_names = [p["name"] for p in projects]
    verified, warnings = validate_response(response_text, context, proj_names)

    # 9. Persistance en DB
    await db.agent_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "tenant_id": user.tenant_id,
        "user_id": user.user_id,
        "session_id": session_id,
        "question": request.question,
        "response": response_text,
        "sources": [],
        "duration_ms": duration_ms,
        "verified": verified,
        "warnings": warnings,
        "is_simulation": is_simulation,
        "created_at": datetime.now(timezone.utc)
    })

    return {
        "answer": response_text,
        "session_id": session_id,
        "sources": [],
        "duration_ms": duration_ms,
        "verified": verified,
        "warnings": warnings,
        "is_simulation": is_simulation,
    }


# ── Historique de session ─────────────────────────────────────────────────────
async def get_session_history(session_id: str, user: TokenPayload) -> list:
    logs = await db.agent_logs.find(
        {"tenant_id": user.tenant_id, "session_id": session_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    return logs


async def list_sessions(user: TokenPayload) -> list:
    """Liste les sessions de conversation de l'utilisateur courant (max 20)."""
    pipeline = [
        {"$match": {"tenant_id": user.tenant_id, "user_id": user.user_id}},
        {"$sort": {"created_at": 1}},
        {"$group": {
            "_id": "$session_id",
            "first_message": {"$first": "$question"},
            "last_activity": {"$last": "$created_at"},
            "message_count": {"$sum": 1}
        }},
        {"$sort": {"last_activity": -1}},
        {"$limit": 20}
    ]
    result = await db.agent_logs.aggregate(pipeline).to_list(20)
    return [
        {
            "session_id": r["_id"],
            "first_message": r["first_message"][:80] + "..." if len(r["first_message"]) > 80 else r["first_message"],
            "last_activity": r["last_activity"].isoformat() if hasattr(r["last_activity"], "isoformat") else str(r["last_activity"]),
            "message_count": r["message_count"]
        }
        for r in result
    ]


# ── Recommandations proactives déterministes ──────────────────────────────────
async def get_recommendations(user: TokenPayload) -> list:
    """
    6 règles déterministes :
    1. EAC > budget initial +5%
    2. Risques critiques non mitigés (criticité >= 15)
    3. Jalons en retard (>7j)
    4. Dépassement enveloppe portefeuille (CAPEX ou OPEX)
    5. Projets rouge sans décision dans le mois courant
    6. Surcharge équipe (capacité dépassée >10%)
    """
    tenant_id = user.tenant_id
    today = date.today()
    recs = []

    # ── Données communes ──
    projects = await db.projects.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "project_id": 1, "name": 1, "budget_total": 1,
         "budget_forecast": 1, "status_rag": 1,
         "capex_planned": 1, "opex_planned": 1}
    ).to_list(100)
    proj_map = {p["project_id"]: p["name"] for p in projects}

    # ── 1. Dépassements EAC ──
    for p in projects:
        total = p.get("budget_total") or 0
        eac = p.get("budget_forecast") or 0
        if total > 0 and eac > total * 1.05:
            pct = round((eac / total - 1) * 100, 1)
            delta = eac - total
            recs.append({
                "id": f"eac_{p['project_id']}",
                "type": "eac_overrun",
                "severity": "critical" if pct > 15 else "warning",
                "title": f"Dépassement EAC — {p['name']}",
                "description": (
                    f"Le forecast ({eac:,.0f}\u202f€) dépasse le budget initial de "
                    f"{delta:,.0f}\u202f€ (+{pct}\u202f%). Action corrective recommandée."
                ),
                "project_id": p["project_id"],
                "project_name": p["name"],
                "metadata": {"overrun_pct": pct, "overrun_eur": delta, "eac": eac, "budget": total}
            })

    # ── 2. Risques critiques non mitigés ──
    critical_risks = await db.risks.find(
        {"tenant_id": tenant_id, "criticality": {"$gte": 15}, "status": {"$in": ["identifié", "en cours"]}},
        {"_id": 0, "risk_id": 1, "title": 1, "criticality": 1, "project_id": 1}
    ).sort("criticality", -1).to_list(10)

    for r in critical_risks:
        proj_name = proj_map.get(r.get("project_id", ""), "Portefeuille")
        recs.append({
            "id": f"risk_{r['risk_id']}",
            "type": "unmitigated_risk",
            "severity": "critical" if r["criticality"] >= 20 else "warning",
            "title": f"Risque critique non mitigé — {proj_name}",
            "description": (
                f"« {r['title']} » (criticité {r['criticality']}/25) "
                f"reste sans plan de mitigation actif."
            ),
            "project_id": r.get("project_id"),
            "project_name": proj_name,
            "metadata": {"criticality": r["criticality"], "risk_title": r["title"]}
        })

    # ── 3. Jalons en retard (>7j) ──
    overdue = await db.milestones.find(
        {
            "tenant_id": tenant_id,
            "target_date": {"$lt": today.isoformat()},
            "status": {"$nin": ["done", "completed", "annulé"]}
        },
        {"_id": 0, "milestone_id": 1, "name": 1, "target_date": 1, "project_id": 1}
    ).to_list(20)

    for m in overdue:
        try:
            delay = (today - date.fromisoformat(m["target_date"])).days
        except (ValueError, TypeError):
            continue
        if delay < 7:
            continue
        proj_name = proj_map.get(m.get("project_id", ""), "inconnu")
        recs.append({
            "id": f"ms_{m['milestone_id']}",
            "type": "delayed_milestone",
            "severity": "critical" if delay > 30 else "warning",
            "title": f"Jalon en retard — {proj_name}",
            "description": (
                f"Le jalon « {m['name']} » avait une échéance au {m['target_date']} "
                f"({delay}\u202fj de retard)."
            ),
            "project_id": m.get("project_id"),
            "project_name": proj_name,
            "metadata": {"delay_days": delay, "milestone_name": m["name"], "target_date": m["target_date"]}
        })

    # ── 4. Dépassements enveloppe portefeuille ──
    envelopes = await db.portfolio_envelopes.find(
        {"tenant_id": tenant_id}, {"_id": 0}
    ).to_list(10)

    total_capex = sum((p.get("capex_planned") or 0) for p in projects)
    total_opex = sum((p.get("opex_planned") or 0) for p in projects)

    for e in envelopes:
        cap_env = e.get("capex_envelope") or 0
        opx_env = e.get("opex_envelope") or 0
        label = f"{e.get('label','')} {e.get('year','')}"

        if cap_env > 0 and total_capex > cap_env:
            pct = round((total_capex / cap_env - 1) * 100, 1)
            recs.append({
                "id": f"env_capex_{e.get('envelope_id','')}",
                "type": "envelope_breach",
                "severity": "critical",
                "title": f"Dépassement enveloppe CAPEX — {label}",
                "description": (
                    f"Le CAPEX planifié ({total_capex:,.0f}\u202f€) dépasse l'enveloppe "
                    f"({cap_env:,.0f}\u202f€) de +{pct}\u202f%."
                ),
                "metadata": {"overrun_pct": pct, "total": total_capex, "envelope": cap_env, "budget_type": "CAPEX"}
            })

        if opx_env > 0 and total_opex > opx_env:
            pct = round((total_opex / opx_env - 1) * 100, 1)
            recs.append({
                "id": f"env_opex_{e.get('envelope_id','')}",
                "type": "envelope_breach",
                "severity": "critical",
                "title": f"Dépassement enveloppe OPEX — {label}",
                "description": (
                    f"Le OPEX planifié ({total_opex:,.0f}\u202f€) dépasse l'enveloppe "
                    f"({opx_env:,.0f}\u202f€) de +{pct}\u202f%. Révision du portefeuille urgente."
                ),
                "metadata": {"overrun_pct": pct, "total": total_opex, "envelope": opx_env, "budget_type": "OPEX"}
            })

    # ── 5. Projets rouge sans décision récente ──
    red_projects = [p for p in projects if p.get("status_rag") == "red"]
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    for p in red_projects:
        recent = await db.decisions.find_one({
            "tenant_id": tenant_id,
            "project_id": p["project_id"],
            "created_at": {"$gte": month_start}
        })
        if not recent:
            recs.append({
                "id": f"red_{p['project_id']}",
                "type": "red_project",
                "severity": "critical",
                "title": f"Projet rouge sans décision — {p['name']}",
                "description": (
                    f"Le projet « {p['name']} » est en statut ROUGE sans qu'aucune décision "
                    f"ou action ne soit enregistrée ce mois-ci."
                ),
                "project_id": p["project_id"],
                "project_name": p["name"],
                "metadata": {}
            })

    # ── 6. Surcharge équipes ──
    resources = await db.resources.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "resource_id": 1, "team_id": 1, "capacity_jh_month": 1, "availability_rate": 1}
    ).to_list(100)

    res_map = {r["resource_id"]: r for r in resources}

    team_capa = {}  # team_id → total capacity JH/mois
    for r in resources:
        tid = r.get("team_id")
        if not tid:
            continue
        capa = (r.get("capacity_jh_month") or 0) * ((r.get("availability_rate") or 100) / 100)
        team_capa[tid] = team_capa.get(tid, 0) + capa

    # Allocations du mois courant
    current_month = today.replace(day=1).isoformat()
    alloc_cursor = db.allocations.aggregate([
        {"$match": {"tenant_id": tenant_id, "period_month": current_month}},
        {"$group": {"_id": "$resource_id", "total_jh": {"$sum": "$jh_allocated"}}}
    ])
    resource_alloc = {doc["_id"]: doc["total_jh"] async for doc in alloc_cursor}

    team_alloc = {}  # team_id → total allocated
    for res_id, jh in resource_alloc.items():
        r = res_map.get(res_id)
        if r and r.get("team_id"):
            tid = r["team_id"]
            team_alloc[tid] = team_alloc.get(tid, 0) + jh

    teams = await db.teams.find(
        {"tenant_id": tenant_id}, {"_id": 0, "team_id": 1, "name": 1}
    ).to_list(20)

    for t in teams:
        tid = t["team_id"]
        capa = team_capa.get(tid, 0)
        alloc = team_alloc.get(tid, 0)
        if capa > 0 and alloc > capa * 1.10:
            pct = round((alloc / capa - 1) * 100, 1)
            recs.append({
                "id": f"team_{tid}",
                "type": "team_overload",
                "severity": "critical" if pct > 30 else "warning",
                "title": f"Surcharge équipe — {t['name']}",
                "description": (
                    f"L'équipe « {t['name']} » est surchargée de {pct}\u202f% "
                    f"({alloc:.0f}\u202fJH alloués vs {capa:.0f}\u202fJH de capacité ce mois-ci)."
                ),
                "metadata": {"overload_pct": pct, "allocated": alloc, "capacity": capa}
            })

    # Tri : critical en premier, puis warning
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    recs.sort(key=lambda x: severity_order.get(x["severity"], 2))

    return recs


# ── Règles d'alerte personnalisées ───────────────────────────────────────────
async def list_alert_rules(user: TokenPayload) -> list:
    rules = await db.user_alert_rules.find(
        {"tenant_id": user.tenant_id, "user_id": user.user_id},
        {"_id": 0}
    ).to_list(50)
    return rules


async def create_alert_rule(data: AlertRuleCreate, user: TokenPayload) -> dict:
    rule = {
        "rule_id": str(uuid.uuid4()),
        "tenant_id": user.tenant_id,
        "user_id": user.user_id,
        "metric": data.metric,
        "threshold": data.threshold,
        "scope": data.scope,
        "enabled": data.enabled,
        "label": data.label or _default_label(data.metric, data.threshold),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_alert_rules.insert_one(rule)
    rule.pop("_id", None)
    return rule


def _default_label(metric: str, threshold: float) -> str:
    labels = {
        "budget_overrun_pct": f"Alerte dépassement budget > {threshold}\u202f%",
        "eac_overrun_pct": f"Alerte dépassement EAC > {threshold}\u202f%",
        "delay_days": f"Alerte retard jalon > {threshold}\u202fj",
        "team_overload_pct": f"Alerte surcharge équipe > {threshold}\u202f%",
        "risk_score": f"Alerte criticité risque > {threshold}",
    }
    return labels.get(metric, f"Alerte {metric} > {threshold}")


async def update_alert_rule(rule_id: str, data: AlertRuleUpdate, user: TokenPayload) -> dict:
    rule = await db.user_alert_rules.find_one(
        {"rule_id": rule_id, "tenant_id": user.tenant_id, "user_id": user.user_id}
    )
    if not rule:
        raise HTTPException(404, "Règle d'alerte introuvable")

    updates = data.model_dump(exclude_unset=True)
    await db.user_alert_rules.update_one({"rule_id": rule_id}, {"$set": updates})
    rule.update(updates)
    rule.pop("_id", None)
    return rule


async def delete_alert_rule(rule_id: str, user: TokenPayload) -> dict:
    result = await db.user_alert_rules.delete_one(
        {"rule_id": rule_id, "tenant_id": user.tenant_id, "user_id": user.user_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "Règle d'alerte introuvable")
    return {"deleted": True}
