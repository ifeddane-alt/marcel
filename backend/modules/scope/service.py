"""
Module Scope — Service métier.

Gère :
 - Candidats (tâches + estimations)
 - Patch scope_status inline
 - Calcul capa vs charge par équipe / ressource
 - Création + consultation de snapshots figés
 - Transmission au CP (+ PDF)
 - Recalcul Gantt depuis snapshot figé
"""
import io
import uuid
from datetime import datetime, timezone, date, timedelta
from typing import Optional

from fastapi import HTTPException
from core.auth import TokenPayload, has_perm
from core.database import db

VALID_SCOPE_STATUSES = {"sec", "etendu", "out", None}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── 1. Candidats ─────────────────────────────────────────────────────────────

async def get_candidates(
    tenant_id: str,
    project_id: Optional[str],
    team_id: Optional[str],
    resource_id: Optional[str],
    scope_status: Optional[str],
    search: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
) -> list:
    # Récupérer les project_ids autorisés pour ce tenant
    proj_filter: dict = {"tenant_id": tenant_id}
    if project_id:
        proj_filter["project_id"] = project_id
    projects = await db.projects.find(proj_filter, {"_id": 0, "project_id": 1, "name": 1}).to_list(None)
    project_map = {p["project_id"]: p["name"] for p in projects}
    pids = list(project_map.keys())

    if not pids:
        return []

    task_filter: dict = {"project_id": {"$in": pids}}
    if scope_status == "__none__":
        task_filter["scope_status"] = {"$in": [None, ""]}
    elif scope_status and scope_status != "all":
        task_filter["scope_status"] = scope_status
    if resource_id:
        task_filter["resource_id"] = resource_id

    tasks = await db.tasks.find(task_filter, {"_id": 0}).to_list(None)

    # Enrichir avec équipe de la ressource owner
    resource_ids = list({t.get("resource_id") for t in tasks if t.get("resource_id")})
    resources = await db.resources.find(
        {"resource_id": {"$in": resource_ids}, "tenant_id": tenant_id},
        {"_id": 0, "resource_id": 1, "name": 1, "team_id": 1, "team": 1}
    ).to_list(None)
    res_map = {r["resource_id"]: r for r in resources}

    # Filtre équipe
    if team_id:
        tasks = [t for t in tasks if res_map.get(t.get("resource_id"), {}).get("team_id") == team_id]

    # Recherche texte
    if search:
        s = search.lower()
        tasks = [t for t in tasks if s in t.get("name", "").lower()]

    result = []
    for t in tasks:
        res = res_map.get(t.get("resource_id")) or {}
        estimates = t.get("phase_estimates") or []
        phase_map = {e["phase"]: e.get("jh_estimated", 0) for e in estimates}
        total_jh = sum(phase_map.values())
        result.append({
            **t,
            "project_name": project_map.get(t.get("project_id"), ""),
            "resource_name": res.get("name", ""),
            "team_id": res.get("team_id"),
            "team_name": res.get("team", ""),
            "jh_review":     phase_map.get("review", 0),
            "jh_analyse":    phase_map.get("analysis", 0),
            "jh_impl":       phase_map.get("implementation", 0),
            "jh_test":       phase_map.get("test", 0),
            "jh_hypercare":  phase_map.get("hypercare", 0),
            "total_jh_estimated": total_jh,
        })

    return result


# ─── 2. Patch scope_status ────────────────────────────────────────────────────

async def patch_scope_status(
    task_id: str, scope_status: Optional[str], user: TokenPayload
) -> dict:
    if not has_perm(user, "scope.arbitrate"):
        raise HTTPException(403, "Permission scope.arbitrate requise")
    if scope_status is not None and scope_status not in ("sec", "etendu", "out"):
        raise HTTPException(422, "scope_status doit être sec | etendu | out | null")

    task = await db.tasks.find_one(
        {"task_id": task_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not task:
        raise HTTPException(404, "Tâche introuvable")

    await db.tasks.update_one(
        {"task_id": task_id, "tenant_id": user.tenant_id},
        {"$set": {"scope_status": scope_status}},
    )
    updated = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    return updated


# ─── 3. Capacité vs charge ────────────────────────────────────────────────────

async def get_capacity_summary(
    tenant_id: str,
    project_id: Optional[str],
    team_id: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
) -> list:
    """
    Retourne la capacité vs charge par équipe (avec détail ressource).
    Capa = capacity_jh_month × (availability_rate/100) × nb_months
    Charge SEC/ÉTENDU = somme des jh_estimated des features avec scope_status correspondant
    """
    # Période
    today = date.today()
    dt_start = date.fromisoformat(start_date) if start_date else today.replace(day=1)
    dt_end = date.fromisoformat(end_date) if end_date else (
        today.replace(day=1) + timedelta(days=90)
    )
    nb_months = max(1, ((dt_end.year - dt_start.year) * 12 + dt_end.month - dt_start.month) + 1)

    # Toutes les équipes du tenant
    team_filter: dict = {"tenant_id": tenant_id}
    if team_id:
        team_filter["team_id"] = team_id
    teams = await db.teams.find(team_filter, {"_id": 0}).to_list(None)
    if not teams:
        return []
    team_map = {t["team_id"]: t for t in teams}
    team_ids = list(team_map.keys())

    # Toutes les ressources de ces équipes
    resources = await db.resources.find(
        {"team_id": {"$in": team_ids}, "tenant_id": tenant_id},
        {"_id": 0, "resource_id": 1, "name": 1, "team_id": 1,
         "capacity_jh_month": 1, "availability_rate": 1}
    ).to_list(None)
    res_by_team: dict = {}
    for r in resources:
        tid = r["team_id"]
        res_by_team.setdefault(tid, []).append(r)

    # Projets du tenant
    proj_filter: dict = {"tenant_id": tenant_id}
    if project_id:
        proj_filter["project_id"] = project_id
    projects = await db.projects.find(proj_filter, {"_id": 0, "project_id": 1}).to_list(None)
    pids = [p["project_id"] for p in projects]

    # Toutes les tasks avec scope_status défini
    tasks = await db.tasks.find(
        {"project_id": {"$in": pids}, "scope_status": {"$in": ["sec", "etendu", "out"]}},
        {"_id": 0, "resource_id": 1, "scope_status": 1, "phase_estimates": 1}
    ).to_list(None)

    # Congés validés sur la période (optionnel – évite div-by-zero si absents)
    leaves_by_res: dict = {}
    all_res_ids = [r["resource_id"] for r in resources]
    leaves = await db.leaves.find(
        {
            "resource_id": {"$in": all_res_ids},
            "status": "approved",
            "date": {"$gte": start_date or dt_start.isoformat(), "$lte": end_date or dt_end.isoformat()},
        },
        {"_id": 0, "resource_id": 1}
    ).to_list(None)
    for l in leaves:
        leaves_by_res[l["resource_id"]] = leaves_by_res.get(l["resource_id"], 0) + 1

    # Charge par ressource
    charge_by_res: dict = {}
    for t in tasks:
        rid = t.get("resource_id")
        if not rid:
            continue
        estimates = t.get("phase_estimates") or []
        total = sum(e.get("jh_estimated", 0) for e in estimates)
        s = t.get("scope_status")
        charge_by_res.setdefault(rid, {"sec": 0, "etendu": 0})
        if s in ("sec", "etendu"):
            charge_by_res[rid][s] = charge_by_res[rid].get(s, 0) + total

    # Résultat par équipe
    result = []
    for tid, team in team_map.items():
        team_res = res_by_team.get(tid, [])
        team_capa = 0.0
        team_sec = 0.0
        team_etendu = 0.0
        detail_resources = []

        for r in team_res:
            capa_month = r.get("capacity_jh_month", 0)
            avail = r.get("availability_rate", 100) / 100
            leaves_days = leaves_by_res.get(r["resource_id"], 0)
            capa = max(0, capa_month * avail * nb_months - leaves_days)
            charge = charge_by_res.get(r["resource_id"], {})
            sec = charge.get("sec", 0)
            etendu = charge.get("etendu", 0)
            marge = capa - sec

            detail_resources.append({
                "resource_id": r["resource_id"],
                "name": r["name"],
                "capa": round(capa, 1),
                "charge_sec": round(sec, 1),
                "charge_etendu": round(etendu, 1),
                "marge": round(marge, 1),
                "taux_pct": round((sec / capa * 100) if capa > 0 else 0, 1),
                "status": "vert" if marge > capa * 0.2 else ("orange" if marge >= 0 else "rouge"),
            })
            team_capa += capa
            team_sec += sec
            team_etendu += etendu

        marge_team = team_capa - team_sec
        result.append({
            "team_id": tid,
            "team_name": team.get("name", ""),
            "capa": round(team_capa, 1),
            "charge_sec": round(team_sec, 1),
            "charge_etendu": round(team_etendu, 1),
            "marge": round(marge_team, 1),
            "taux_pct": round((team_sec / team_capa * 100) if team_capa > 0 else 0, 1),
            "status": "vert" if marge_team > team_capa * 0.2 else ("orange" if marge_team >= 0 else "rouge"),
            "resources": detail_resources,
        })

    return result


# ─── 4. Snapshots ────────────────────────────────────────────────────────────

async def create_snapshot(data, user: TokenPayload) -> dict:
    if not has_perm(user, "scope.freeze"):
        raise HTTPException(403, "Permission scope.freeze requise")

    # Version auto-incrémentée
    last = await db.scope_snapshots.find_one(
        {"tenant_id": user.tenant_id, "project_id": data.project_id},
        sort=[("version", -1)]
    )
    version = (last.get("version", 0) + 1) if last else 1

    # Snapshot des features courantes
    proj_filter: dict = {"tenant_id": user.tenant_id}
    if data.project_id:
        proj_filter["project_id"] = data.project_id
    projects = await db.projects.find(proj_filter, {"_id": 0, "project_id": 1}).to_list(None)
    pids = [p["project_id"] for p in projects]

    features = await db.tasks.find(
        {"project_id": {"$in": pids}},
        {"_id": 0}
    ).to_list(None)

    # Snapshot de la capa vs charge
    cap_summary = await get_capacity_summary(user.tenant_id, data.project_id, None, None, None)

    now = _now()
    snap = {
        "snapshot_id": str(uuid.uuid4()),
        "tenant_id": user.tenant_id,
        "project_id": data.project_id,
        "period_ref": data.period_ref,
        "version": version,
        "status": "frozen",
        "comment": data.comment,
        "features": features,
        "capacity_summary": cap_summary,
        "frozen_at": now,
        "frozen_by": user.user_id,
        "transmitted_at": None,
        "transmitted_to": None,
    }
    await db.scope_snapshots.insert_one(snap)
    snap.pop("_id", None)
    return snap


async def list_snapshots(user: TokenPayload, project_id: Optional[str] = None) -> list:
    flt: dict = {"tenant_id": user.tenant_id}
    if project_id:
        flt["project_id"] = project_id
    return await db.scope_snapshots.find(flt, {"_id": 0, "features": 0}).sort("version", -1).to_list(None)


async def get_snapshot(snapshot_id: str, user: TokenPayload) -> dict:
    snap = await db.scope_snapshots.find_one(
        {"snapshot_id": snapshot_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not snap:
        raise HTTPException(404, "Snapshot introuvable")
    return snap


# ─── 5. Transmission ─────────────────────────────────────────────────────────

async def transmit_snapshot(snapshot_id: str, request, user: TokenPayload) -> dict:
    if not has_perm(user, "scope.transmit") and not has_perm(user, "scope.freeze"):
        raise HTTPException(403, "Permission scope.transmit requise")

    snap = await get_snapshot(snapshot_id, user)
    if snap.get("status") == "transmitted":
        raise HTTPException(409, "Ce snapshot a déjà été transmis")

    # Vérifier le CP cible
    target_user = await db.users.find_one(
        {"user_id": request.target_user_id, "tenant_id": user.tenant_id},
        {"_id": 0, "email": 1, "name": 1}
    )
    if not target_user:
        raise HTTPException(404, "Utilisateur cible introuvable")

    now = _now()
    await db.scope_snapshots.update_one(
        {"snapshot_id": snapshot_id, "tenant_id": user.tenant_id},
        {"$set": {
            "status": "transmitted",
            "transmitted_at": now,
            "transmitted_to": request.target_user_id,
            "transmit_comment": request.comment,
        }}
    )

    # Notification in-app
    notif = {
        "notification_id": str(uuid.uuid4()),
        "tenant_id": user.tenant_id,
        "user_id": request.target_user_id,
        "type": "scope_transmitted",
        "message": (
            f"Le scope {snap.get('period_ref', '')} v{snap.get('version', '')} "
            f"vous a été transmis par {user.name}"
        ),
        "snapshot_id": snapshot_id,
        "read": False,
        "created_at": now,
    }
    await db.notifications.insert_one(notif)
    notif.pop("_id", None)

    # PDF scope
    pdf_bytes = _generate_scope_pdf(snap, target_user, user, request.comment)

    return {
        "snapshot_id": snapshot_id,
        "transmitted_to_name": target_user.get("name"),
        "transmitted_to_email": target_user.get("email"),
        "pdf_base64": __import__("base64").b64encode(pdf_bytes).decode(),
    }


def _generate_scope_pdf(snap: dict, target_user: dict, sender, comment: str = "") -> bytes:
    """Génère un PDF du scope figé (tableau features + capa vs charge)."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import cm

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            rightMargin=1.5*cm, leftMargin=1.5*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    elems = []

    # Titre
    elems.append(Paragraph(f"Scope Figé — {snap.get('period_ref', '')} v{snap.get('version', '')}", styles["Title"]))
    elems.append(Paragraph(
        f"Transmis par : {sender.name} | Destinataire : {target_user.get('name', '')} | "
        f"Date : {snap.get('frozen_at', '')[:10]}",
        styles["Normal"]
    ))
    if comment:
        elems.append(Paragraph(f"<i>Commentaire PMO : {comment}</i>", styles["Italic"]))
    elems.append(Spacer(1, 0.5*cm))

    # Tableau features
    STATUS_LABELS = {"sec": "SEC", "etendu": "ÉTENDU", "out": "OUT"}
    features = snap.get("features") or []
    header = ["Feature", "Projet", "Équipe", "Total JH", "Statut"]
    rows = [header]
    for f in features:
        s = f.get("scope_status")
        if s not in ("sec", "etendu", "out"):
            continue
        estimates = f.get("phase_estimates") or []
        total = sum(e.get("jh_estimated", 0) for e in estimates)
        rows.append([
            Paragraph(f.get("name", "")[:60], styles["Normal"]),
            f.get("project_name", f.get("project_id", ""))[:30],
            f.get("team_name", ""),
            str(round(total, 1)),
            STATUS_LABELS.get(s, s or "–"),
        ])

    if len(rows) > 1:
        tbl = Table(rows, colWidths=[7*cm, 4*cm, 3*cm, 2*cm, 2*cm])
        tbl.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, 0),  colors.HexColor("#0F172A")),
            ("TEXTCOLOR",    (0, 0), (-1, 0),  colors.white),
            ("FONTSIZE",     (0, 0), (-1, 0),  9),
            ("FONTSIZE",     (0, 1), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8F9FA")]),
            ("GRID",         (0, 0), (-1, -1), 0.4, colors.lightgrey),
            ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elems.append(tbl)
        elems.append(Spacer(1, 0.5*cm))

    # Capa vs charge
    elems.append(Paragraph("Capacité vs Charge par Équipe", styles["Heading2"]))
    cap_rows = [["Équipe", "Capa (JH)", "SEC (JH)", "ÉTENDU (JH)", "Marge (JH)", "Taux", "Statut"]]
    for team in snap.get("capacity_summary") or []:
        cap_rows.append([
            team.get("team_name", ""),
            str(team.get("capa", 0)),
            str(team.get("charge_sec", 0)),
            str(team.get("charge_etendu", 0)),
            str(team.get("marge", 0)),
            f"{team.get('taux_pct', 0)}%",
            {"vert": "OK", "orange": "Attention", "rouge": "SURCHARGE"}.get(team.get("status", "vert"), ""),
        ])
    if len(cap_rows) > 1:
        cap_tbl = Table(cap_rows, colWidths=[4*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2.5*cm, 1.5*cm, 2.5*cm])
        cap_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
            ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
            ("FONTSIZE",   (0, 0), (-1, -1), 8),
            ("GRID",       (0, 0), (-1, -1), 0.4, colors.lightgrey),
        ]))
        elems.append(cap_tbl)

    doc.build(elems)
    return buffer.getvalue()


# ─── 6. Recalcul Gantt ───────────────────────────────────────────────────────

async def compute_gantt_from_snapshot(snapshot_id: str, user: TokenPayload) -> dict:
    """
    Positionne les features SEC (puis ÉTENDU si capacité restante) sur le Gantt.
    Ne modifie que les tasks où gantt_source != 'manual'.
    """
    if not has_perm(user, "scope.freeze"):
        raise HTTPException(403, "Permission scope.freeze requise")

    snap = await get_snapshot(snapshot_id, user)
    if snap.get("status") not in ("frozen", "transmitted"):
        raise HTTPException(422, "Le snapshot doit être figé pour calculer le Gantt")

    features = snap.get("features") or []
    period_ref = snap.get("period_ref", "")

    # Déduction d'une date de départ depuis period_ref (ex: "PI-1 2026" → 2026-01-01)
    import re
    today = date.today()
    start = today.replace(day=1)
    m = re.search(r"(\d{4})", period_ref)
    if m:
        year = int(m.group(1))
        q = re.search(r"Q(\d)", period_ref)
        pi = re.search(r"PI-?(\d)", period_ref)
        if q:
            start = date(year, (int(q.group(1)) - 1) * 3 + 1, 1)
        elif pi:
            start = date(year, (int(pi.group(1)) - 1) * 3 + 1, 1)
        else:
            start = date(year, 1, 1)

    # Grouper par équipe, ordonner SEC d'abord puis ÉTENDU
    teams_queue: dict = {}
    for f in features:
        s = f.get("scope_status")
        if s not in ("sec", "etendu"):
            continue
        tid = f.get("team_id")
        if not tid:
            continue
        estimates = f.get("phase_estimates") or []
        total_jh = sum(e.get("jh_estimated", 0) for e in estimates)
        if total_jh <= 0:
            continue
        teams_queue.setdefault(tid, {"sec": [], "etendu": []})
        teams_queue[tid][s].append({
            "task_id": f.get("task_id"),
            "name": f.get("name"),
            "total_jh": total_jh,
            "gantt_source": f.get("gantt_source"),
        })

    # Capacité par ressource/équipe (JH/mois = capacity_jh_month × avail/100)
    all_team_ids = list(teams_queue.keys())
    resources = await db.resources.find(
        {"team_id": {"$in": all_team_ids}, "tenant_id": user.tenant_id},
        {"_id": 0, "team_id": 1, "capacity_jh_month": 1, "availability_rate": 1}
    ).to_list(None)
    team_capa_month: dict = {}
    for r in resources:
        tid = r["team_id"]
        c = r.get("capacity_jh_month", 0) * (r.get("availability_rate", 100) / 100)
        team_capa_month[tid] = team_capa_month.get(tid, 0) + c

    updated_tasks = []
    alerts = []

    for tid, queues in teams_queue.items():
        capa_month = team_capa_month.get(tid, 20)  # fallback 20 JH/mois
        current_date = start
        remaining_capa = capa_month  # JH restantes ce mois

        for priority_group in [queues["sec"], queues["etendu"]]:
            for feature in priority_group:
                task_id = feature["task_id"]
                total_jh = feature["total_jh"]

                # Ne pas toucher les tâches saisies manuellement
                if feature.get("gantt_source") == "manual":
                    continue

                feat_start = current_date
                remaining = total_jh

                while remaining > 0:
                    consumed = min(remaining_capa, remaining)
                    remaining -= consumed
                    remaining_capa -= consumed
                    if remaining_capa <= 0 and remaining > 0:
                        # Passer au mois suivant
                        month = current_date.month % 12 + 1
                        year = current_date.year + (1 if current_date.month == 12 else 0)
                        current_date = current_date.replace(year=year, month=month, day=1)
                        remaining_capa = capa_month

                feat_end = current_date + timedelta(days=int(total_jh / max(capa_month, 1) * 30))

                await db.tasks.update_one(
                    {"task_id": task_id, "tenant_id": user.tenant_id},
                    {"$set": {
                        "date_start_planned": feat_start.isoformat(),
                        "date_end_planned": feat_end.isoformat(),
                        "gantt_source": "scope_computed",
                    }}
                )
                updated_tasks.append(task_id)

        # Alerte surcharge
        total_sec_jh = sum(f["total_jh"] for f in queues["sec"])
        total_etendu_jh = sum(f["total_jh"] for f in queues["etendu"])
        capa_total = capa_month * 3  # 3 mois estimation
        if total_sec_jh > capa_total:
            alerts.append({
                "team_id": tid,
                "message": f"Surcharge équipe : {total_sec_jh:.0f} JH SEC > {capa_total:.0f} JH capa",
                "severity": "critical",
            })

    return {
        "snapshot_id": snapshot_id,
        "updated_tasks": len(updated_tasks),
        "alerts": alerts,
    }
