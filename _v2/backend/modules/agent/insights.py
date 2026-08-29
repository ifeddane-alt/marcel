"""Socle IA à coût fixe — analyse quotidienne par règles déterministes,
LLM uniquement pour rédiger la synthèse des NOUVELLES anomalies (0 anomalie = 0 appel)."""
import os
import uuid
import json
import time
import logging
from datetime import datetime, timezone, date, timedelta
from core.database import db
from modules.notifications.service import create_notification

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _detect_anomalies(tenant_id: str) -> list:
    anomalies = []
    today = date.today().isoformat()
    projects = await db.projects.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(None)
    pmap = {p["project_id"]: p for p in projects}

    for p in projects:
        bt = p.get("budget_total") or 0
        eac = p.get("eac") or p.get("budget_forecast") or 0
        if bt > 0 and eac > bt * 1.02:
            anomalies.append({"key": f"budget:{p['project_id']}", "type": "depassement_budget", "severity": "critical",
                              "label": f"{p['name']} — EAC {eac:,.0f} € > budget approuvé {bt:,.0f} € (+{(eac - bt) / bt * 100:.0f}%)"})
        if p.get("status_rag") == "red":
            anomalies.append({"key": f"rag:{p['project_id']}", "type": "projet_rouge", "severity": "warning",
                              "label": f"{p['name']} — projet en statut ROUGE"})

    risks = await db.risks.find(
        {"tenant_id": tenant_id, "status": {"$in": ["identifié", "en cours"]}}, {"_id": 0}
    ).to_list(None)
    for r in risks:
        if (r.get("criticality") or 0) >= 15 and not (r.get("mitigation_plan") or "").strip():
            pname = pmap.get(r.get("project_id"), {}).get("name", "?")
            anomalies.append({"key": f"risk:{r['risk_id']}", "type": "risque_critique_sans_mitigation", "severity": "critical",
                              "label": f"Risque critique sans plan de mitigation : {r.get('title')} ({pname})"})

    ms = await db.milestones.find(
        {"project_id": {"$in": list(pmap)}, "status": {"$nin": ["achieved", "done"]}}, {"_id": 0}
    ).to_list(None)
    for m in ms:
        d = (m.get("date_forecast") or m.get("date_baseline") or "")[:10]
        if d and d < today:
            pname = pmap.get(m.get("project_id"), {}).get("name", "?")
            anomalies.append({"key": f"milestone:{m['milestone_id']}", "type": "jalon_en_retard", "severity": "warning",
                              "label": f"Jalon en retard : {m.get('name')} ({pname}) — prévu le {d}"})

    vulns = await db.vulnerabilities.find(
        {"tenant_id": tenant_id, "severity": "critique", "status": {"$in": ["ouverte", "en_remediation"]}}, {"_id": 0}
    ).to_list(None)
    for v in vulns:
        anomalies.append({"key": f"vuln:{v['vuln_id']}", "type": "vulnerabilite_critique", "severity": "critical",
                          "label": f"Vulnérabilité critique ouverte : {v.get('title')}"})

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    incs = await db.incidents.find(
        {"tenant_id": tenant_id, "severity": "P1", "status": {"$ne": "resolu"}, "opened_at": {"$lt": cutoff}}, {"_id": 0}
    ).to_list(None)
    for i in incs:
        anomalies.append({"key": f"incident:{i['incident_id']}", "type": "incident_p1_prolonge", "severity": "critical",
                          "label": f"Incident P1 non résolu depuis plus de 24h : {i.get('title')}"})

    acts = await db.run_activities.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(None)
    for a in acts:
        ba, bc = a.get("budget_annual") or 0, a.get("budget_consumed") or 0
        if ba > 0 and bc > ba:
            anomalies.append({"key": f"run:{a['activity_id']}", "type": "depassement_budget_run", "severity": "warning",
                              "label": f"Activité run « {a.get('name')} » — consommé {bc:,.0f} € > budget annuel {ba:,.0f} €"})

    return anomalies


async def _llm_budget_ok(tenant_id: str) -> bool:
    since = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    used = await db.ai_insights.count_documents(
        {"tenant_id": tenant_id, "llm_used": True, "run_at": {"$gte": since}}
    )
    return used < int(os.environ.get("AI_INSIGHTS_DAILY_LLM_MAX", "4"))


async def _write_synthesis(new_anoms: list, all_anoms: list, tenant_id: str) -> tuple:
    """Retourne (texte, llm_used)."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    fallback = (f"{len(new_anoms)} nouvelle(s) anomalie(s) détectée(s), "
                f"{len(all_anoms)} au total. Priorité : "
                + " ; ".join(a["label"] for a in sorted(new_anoms, key=lambda x: x["severity"])[:3]))
    if not new_anoms or not api_key or not await _llm_budget_ok(tenant_id):
        return fallback, False
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=api_key,
            session_id=f"insights-{uuid.uuid4()}",
            system_message=("Tu es un analyste PMO. Rédige en français une synthèse concise (4 phrases max, sans markdown) "
                            "des anomalies détectées dans le portefeuille DSI, en priorisant les plus critiques et en "
                            "recommandant une action. Ne rien inventer au-delà des données fournies."),
        ).with_model("openai", os.environ.get("AGENT_MODEL", "gpt-5.4"))
        payload = {
            "nouvelles_anomalies": [a["label"] for a in new_anoms[:25]],
            "anomalies_totales": len(all_anoms),
            "types": sorted({a["type"] for a in all_anoms}),
        }
        raw = await chat.send_message(UserMessage(text=json.dumps(payload, ensure_ascii=False)))
        return str(raw).strip()[:1200], True
    except Exception as e:
        logger.error("[Insights] LLM indisponible : %s", e)
        return fallback, False


async def analyze_tenant(tenant_id: str, triggered_by: str = "scheduler") -> dict:
    start = time.time()
    anomalies = await _detect_anomalies(tenant_id)
    cur_keys = {a["key"] for a in anomalies}
    prev = await db.ai_insights.find_one(
        {"tenant_id": tenant_id}, {"_id": 0, "anomaly_keys": 1}, sort=[("run_at", -1)]
    )
    prev_keys = set((prev or {}).get("anomaly_keys") or [])
    new_keys = cur_keys - prev_keys
    resolved_keys = prev_keys - cur_keys
    new_anoms = [a for a in anomalies if a["key"] in new_keys]

    synthesis, llm_used = await _write_synthesis(new_anoms, anomalies, tenant_id) \
        if new_anoms else (f"Aucune nouvelle anomalie — {len(anomalies)} anomalie(s) connue(s) toujours ouverte(s)."
                           if anomalies else "Aucune anomalie détectée sur le portefeuille.", False)

    doc = {
        "insight_id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "run_at": _now(),
        "triggered_by": triggered_by,
        "anomalies": anomalies,
        "anomaly_keys": sorted(cur_keys),
        "new_count": len(new_keys),
        "resolved_count": len(resolved_keys),
        "critical_count": sum(1 for a in anomalies if a["severity"] == "critical"),
        "synthesis": synthesis,
        "llm_used": llm_used,
        "duration_ms": int((time.time() - start) * 1000),
    }
    await db.ai_insights.insert_one({**doc})
    doc.pop("_id", None)

    if new_keys:
        recipients = await db.users.find(
            {"tenant_id": tenant_id, "role": {"$in": ["TENANT_ADMIN", "PMO_USER"]}, "is_active": {"$ne": False}},
            {"_id": 0, "user_id": 1},
        ).to_list(None)
        msg = f"Analyse IA : {len(new_keys)} nouvelle(s) anomalie(s) détectée(s) — {synthesis[:160]}"
        for u in recipients:
            try:
                await create_notification(tenant_id, u["user_id"], "ai_insight", msg,
                                          metadata={"insight_id": doc["insight_id"]})
            except Exception:
                pass
    return doc


async def list_insights(tenant_id: str, limit: int = 10) -> list:
    return await db.ai_insights.find(
        {"tenant_id": tenant_id}, {"_id": 0}
    ).sort("run_at", -1).to_list(min(limit, 50))


async def run_insights_all_tenants():
    tenant_ids = await db.tenants.distinct("tenant_id")
    for tid in tenant_ids:
        try:
            d = await analyze_tenant(tid)
            logger.info("[Insights] %s : %d anomalies (%d nouvelles, LLM=%s)",
                        tid, len(d["anomalies"]), d["new_count"], d["llm_used"])
        except Exception as e:
            logger.error("[Insights] Échec tenant %s : %s", tid, e)
