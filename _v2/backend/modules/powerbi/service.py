"""Power BI Connector — Service layer.

Retourne des tableaux plats (list of dicts) compatibles Power BI Desktop
Web Connector (JSON Array of Objects, pas de nested).
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Optional

from core.auth import TokenPayload
from core.database import db


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _safe(v, default=None):
    """Retourne la valeur ou default si None/vide."""
    return v if v is not None else default


def _date(v) -> Optional[str]:
    """Convertit datetime ou str ISO en date YYYY-MM-DD."""
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, str):
        return v[:10]
    return str(v)


def _days_remaining(date_str: Optional[str]) -> Optional[int]:
    if not date_str:
        return None
    try:
        d = datetime.fromisoformat(str(date_str)[:10])
        return (d.date() - datetime.now(timezone.utc).date()).days
    except Exception:
        return None


def _in_range(date_str: Optional[str], from_date: Optional[str], to_date: Optional[str]) -> bool:
    """Retourne True si date_str est dans l'intervalle [from_date, to_date].
    Si from_date et to_date sont None, toujours True."""
    if not date_str:
        return True          # pas de date → inclus quand même (cas timesheets vides)
    d = date_str[:10]
    if from_date and d < from_date:
        return False
    if to_date and d > to_date:
        return False
    return True


async def _project_ids_for_program(tenant_id: str, program_id: str) -> set:
    """Retourne l'ensemble des project_id appartenant au programme donné."""
    cursor = db["projects"].find(
        {"tenant_id": tenant_id, "program_id": program_id},
        {"_id": 0, "project_id": 1},
    )
    ids: set = set()
    async for p in cursor:
        if p.get("project_id"):
            ids.add(p["project_id"])
    return ids


# ─── Vérification API Key ─────────────────────────────────────────────────────

async def verify_api_key(api_key: str) -> Optional[str]:
    """Retourne le tenant_id si la clé est valide, sinon None."""
    cfg = await db["tenant_config"].find_one(
        {"powerbi_api_key": api_key},
        {"_id": 0, "tenant_id": 1},
    )
    return cfg["tenant_id"] if cfg else None


# ─── Gestion clé API ─────────────────────────────────────────────────────────

async def get_api_key(user: TokenPayload) -> dict:
    cfg = await db["tenant_config"].find_one(
        {"tenant_id": user.tenant_id},
        {"_id": 0, "powerbi_api_key": 1},
    )
    key = cfg.get("powerbi_api_key") if cfg else None
    masked = f"pbi-...{key[-6:]}" if key else None
    return {"has_key": bool(key), "masked_key": masked}


async def generate_api_key(user: TokenPayload) -> dict:
    key = "pbi-" + secrets.token_urlsafe(32)
    await db["tenant_config"].update_one(
        {"tenant_id": user.tenant_id},
        {"$set": {"powerbi_api_key": key}},
        upsert=True,
    )
    return {"api_key": key}


async def revoke_api_key(user: TokenPayload) -> dict:
    await db["tenant_config"].update_one(
        {"tenant_id": user.tenant_id},
        {"$unset": {"powerbi_api_key": ""}},
    )
    return {"revoked": True}


# ─── Endpoints données ────────────────────────────────────────────────────────

async def get_projects(
    tenant_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    program_id: Optional[str] = None,
) -> list[dict]:
    """Projets — filtre sur start_date si from_date/to_date fournis, ou sur programme."""
    query: dict = {"tenant_id": tenant_id}
    if program_id:
        query["program_id"] = program_id
    cursor = db["projects"].find(query, {"_id": 0})
    rows = []
    async for p in cursor:
        start = _date(p.get("start_date"))
        end   = _date(p.get("end_date"))
        # Inclure le projet si son intervalle [start_date, end_date] chevauche [from_date, to_date]
        if from_date and end and end < from_date:
            continue
        if to_date and start and start > to_date:
            continue
        prog = await db["programs"].find_one(
            {"program_id": p.get("program_id"), "tenant_id": tenant_id},
            {"_id": 0, "name": 1},
        ) if p.get("program_id") else None
        rows.append({
            "id":             p.get("project_id", ""),
            "name":           _safe(p.get("name"), ""),
            "program":        prog["name"] if prog else _safe(p.get("program_id"), ""),
            "methodology":    _safe(p.get("methodology"), ""),
            "status":         _safe(p.get("status"), ""),
            "rag":            _safe(p.get("status_rag"), ""),
            "capex_budget":   _safe(p.get("capex_planned"), 0),
            "opex_budget":    _safe(p.get("opex_planned"), 0),
            "capex_consumed": _safe(p.get("capex_consumed"), 0),
            "opex_consumed":  _safe(p.get("opex_consumed"), 0),
            "eac":            _safe(p.get("eac"), 0),
            "raf":            _safe(p.get("raf"), 0),
            "start_date":     start,
            "end_date":       end,
            "owner":          _safe(p.get("owner"), ""),
        })
    return rows


async def get_resources(
    tenant_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    program_id: Optional[str] = None,
) -> list[dict]:
    """Ressources — pas de filtre temporel ni par programme (données de référentiel)."""
    cursor = db["resources"].find({"tenant_id": tenant_id}, {"_id": 0})
    rows = []
    async for r in cursor:
        rows.append({
            "id":                r.get("resource_id", ""),
            "name":              _safe(r.get("name"), ""),
            "role":              _safe(r.get("role"), ""),
            "team":              _safe(r.get("team"), ""),
            "type":              _safe(r.get("type"), ""),
            "vendor":            _safe(r.get("vendor"), ""),
            "tjm":               _safe(r.get("tjm"), 0),
            "availability_rate": _safe(r.get("availability_rate"), 1.0),
            "capacity_jh":       _safe(r.get("capacity_jh"), 0),
        })
    return rows


async def get_timesheets(
    tenant_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    program_id: Optional[str] = None,
) -> list[dict]:
    """Timesheets — lignes dépliées avec filtre sur la date de saisie.

    PMO visibility : si un document timesheet n'a aucune entrée (ou toutes
    filtrées hors-plage), on génère quand même UNE ligne synthétique jh=0
    pour visualiser les ressources qui n'ont pas saisi.
    """
    # Si program_id fourni, ne garder que les projets du programme
    allowed_projects: Optional[set] = None
    if program_id:
        allowed_projects = await _project_ids_for_program(tenant_id, program_id)
    cursor = db["timesheets"].find({"tenant_id": tenant_id}, {"_id": 0})
    rows = []
    async for ts in cursor:
        resource_name = ts.get("resource_name") or ""
        if not resource_name and ts.get("resource_id"):
            res = await db["resources"].find_one(
                {"resource_id": ts["resource_id"], "tenant_id": tenant_id},
                {"_id": 0, "name": 1},
            )
            resource_name = res["name"] if res else ts["resource_id"]

        project_name = ts.get("project_name") or ""
        if not project_name and ts.get("project_id"):
            proj = await db["projects"].find_one(
                {"project_id": ts["project_id"], "tenant_id": tenant_id},
                {"_id": 0, "name": 1},
            )
            project_name = proj["name"] if proj else ts["project_id"]

        status = _safe(ts.get("status"), "")
        entries = ts.get("entries") or []
        period_start = _date(ts.get("week_start") or ts.get("period_start") or ts.get("date"))

        # Filtre par programme : exclure si projet hors programme
        if allowed_projects is not None and ts.get("project_id") not in allowed_projects:
            continue

        # Filtrer les entrées dans la période demandée
        in_range_entries = [
            e for e in entries
            if _in_range(_date(e.get("date")), from_date, to_date)
        ]

        if in_range_entries:
            for entry in in_range_entries:
                rows.append({
                    "resource_name": resource_name,
                    "project_name":  project_name,
                    "date":          _date(entry.get("date")),
                    "jh":            _safe(entry.get("jh"), 0),
                    "status":        status,
                })
        else:
            # Aucune entrée (ou hors plage) → ligne synthétique "non saisi"
            # Inclure seulement si le document lui-même est dans la plage
            if _in_range(period_start, from_date, to_date):
                rows.append({
                    "resource_name": resource_name,
                    "project_name":  project_name,
                    "date":          period_start,
                    "jh":            0,
                    "status":        status,
                })
    return rows


async def get_budget(
    tenant_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    program_id: Optional[str] = None,
) -> list[dict]:
    """Budget — même filtre que projects (chevauchement de période)."""
    query: dict = {"tenant_id": tenant_id}
    if program_id:
        query["program_id"] = program_id
    cursor = db["projects"].find(query, {"_id": 0})
    rows = []
    async for p in cursor:
        start = _date(p.get("start_date"))
        end   = _date(p.get("end_date"))
        if from_date and end and end < from_date:
            continue
        if to_date and start and start > to_date:
            continue
        prog = await db["programs"].find_one(
            {"program_id": p.get("program_id"), "tenant_id": tenant_id},
            {"_id": 0, "name": 1},
        ) if p.get("program_id") else None

        capex_prev = _safe(p.get("capex_planned"), 0)
        opex_prev  = _safe(p.get("opex_planned"), 0)
        eac        = _safe(p.get("eac"), 0)
        total_prev = capex_prev + opex_prev
        ecart_pct  = round(((eac - total_prev) / total_prev * 100), 2) if total_prev else 0

        rows.append({
            "project_name": _safe(p.get("name"), ""),
            "program":      prog["name"] if prog else "",
            "capex_prev":   capex_prev,
            "capex_cons":   _safe(p.get("capex_consumed"), 0),
            "opex_prev":    opex_prev,
            "opex_cons":    _safe(p.get("opex_consumed"), 0),
            "eac":          eac,
            "raf":          _safe(p.get("raf"), 0),
            "ecart_pct":    ecart_pct,
        })
    return rows


async def get_risks(
    tenant_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    program_id: Optional[str] = None,
) -> list[dict]:
    """Risques — filtre sur created_at/updated_at si disponible."""
    allowed_projects: Optional[set] = None
    if program_id:
        allowed_projects = await _project_ids_for_program(tenant_id, program_id)
    cursor = db["risks"].find({"tenant_id": tenant_id}, {"_id": 0})
    rows = []
    async for r in cursor:
        if allowed_projects is not None and r.get("project_id") not in allowed_projects:
            continue
        # Utilise created_at ou updated_at comme date de référence
        ref_date = _date(r.get("updated_at") or r.get("created_at"))
        if not _in_range(ref_date, from_date, to_date):
            continue
        proj = await db["projects"].find_one(
            {"project_id": r.get("project_id"), "tenant_id": tenant_id},
            {"_id": 0, "name": 1},
        ) if r.get("project_id") else None
        rows.append({
            "project_name": proj["name"] if proj else _safe(r.get("project_id"), ""),
            "name":         _safe(r.get("name"), ""),
            "probability":  _safe(r.get("probability"), 0),
            "impact":       _safe(r.get("impact"), 0),
            "criticality":  _safe(r.get("criticality"), 0),
            "category":     _safe(r.get("category"), ""),
            "status":       _safe(r.get("status"), ""),
        })
    return rows


async def get_milestones(
    tenant_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    program_id: Optional[str] = None,
) -> list[dict]:
    """Jalons — filtre sur la date du jalon."""
    allowed_projects: Optional[set] = None
    if program_id:
        allowed_projects = await _project_ids_for_program(tenant_id, program_id)
    cursor = db["milestones"].find({"tenant_id": tenant_id}, {"_id": 0})
    rows = []
    async for m in cursor:
        if allowed_projects is not None and m.get("project_id") not in allowed_projects:
            continue
        date_str = _date(m.get("date"))
        if not _in_range(date_str, from_date, to_date):
            continue
        proj = await db["projects"].find_one(
            {"project_id": m.get("project_id"), "tenant_id": tenant_id},
            {"_id": 0, "name": 1},
        ) if m.get("project_id") else None
        rows.append({
            "project_name":    proj["name"] if proj else _safe(m.get("project_id"), ""),
            "name":            _safe(m.get("name"), ""),
            "family":          _safe(m.get("family"), ""),
            "type":            _safe(m.get("type"), ""),
            "date":            date_str,
            "days_remaining":  _days_remaining(date_str),
            "attribute":       _safe(m.get("attribute"), ""),
            "status":          _safe(m.get("status"), ""),
        })
    return rows


# ─── Template ZIP ─────────────────────────────────────────────────────────────

def generate_template_zip(base_url: str, api_key: str) -> bytes:
    """Génère un ZIP contenant les scripts M-Query Power BI pour les 6 tables."""
    import io, zipfile

    tables = {
        "Projets": ("projects", _M_PROJECTS),
        "Ressources": ("resources", _M_RESOURCES),
        "Timesheets": ("timesheets", _M_TIMESHEETS),
        "Budget": ("budget", _M_BUDGET),
        "Risques": ("risks", _M_RISKS),
        "Jalons": ("milestones", _M_MILESTONES),
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for table_name, (endpoint, template) in tables.items():
            script = template.replace("{{BASE_URL}}", base_url).replace("{{API_KEY}}", api_key)
            zf.writestr(f"MARCEL_{table_name}.m", script)

        zf.writestr("README.txt", _M_README.replace("{{BASE_URL}}", base_url))

    buf.seek(0)
    return buf.read()


# ─── M-Query templates ────────────────────────────────────────────────────────

_M_PROJECTS = '''let
    BaseUrl = "{{BASE_URL}}",
    ApiKey  = "{{API_KEY}}",
    Source  = Json.Document(Web.Contents(
        BaseUrl & "/api/powerbi/projects",
        [Headers = [Authorization = "Bearer " & ApiKey]]
    )),
    #"Converti en tableau" = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Colonnes développées" = Table.ExpandRecordColumn(
        #"Converti en tableau", "Column1",
        {"project_id","name","status","status_rag","program","owner","start_date",
         "end_date_baseline","end_date_forecast","budget_total","budget_consumed",
         "budget_forecast","capex_planned","capex_consumed","opex_planned","opex_consumed","eac"}
    ),
    #"Types" = Table.TransformColumnTypes(#"Colonnes développées", {
        {"project_id", type text}, {"name", type text}, {"status", type text},
        {"status_rag", type text}, {"program", type text}, {"owner", type text},
        {"start_date", type date}, {"end_date_baseline", type date}, {"end_date_forecast", type date},
        {"budget_total", Int64.Type}, {"budget_consumed", Int64.Type}, {"budget_forecast", Int64.Type},
        {"capex_planned", Int64.Type}, {"capex_consumed", Int64.Type},
        {"opex_planned", Int64.Type}, {"opex_consumed", Int64.Type}, {"eac", Int64.Type}
    })
in
    #"Types"'''

_M_RESOURCES = '''let
    BaseUrl = "{{BASE_URL}}",
    ApiKey  = "{{API_KEY}}",
    Source  = Json.Document(Web.Contents(
        BaseUrl & "/api/powerbi/resources",
        [Headers = [Authorization = "Bearer " & ApiKey]]
    )),
    #"Converti en tableau" = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Colonnes développées" = Table.ExpandRecordColumn(
        #"Converti en tableau", "Column1",
        {"resource_id","name","email","role","seniority","tjm","type","department"}
    ),
    #"Types" = Table.TransformColumnTypes(#"Colonnes développées", {
        {"resource_id", type text}, {"name", type text}, {"email", type text},
        {"role", type text}, {"seniority", type text}, {"tjm", type number},
        {"type", type text}, {"department", type text}
    })
in
    #"Types"'''

_M_TIMESHEETS = '''let
    BaseUrl = "{{BASE_URL}}",
    ApiKey  = "{{API_KEY}}",
    Source  = Json.Document(Web.Contents(
        BaseUrl & "/api/powerbi/timesheets",
        [Headers = [Authorization = "Bearer " & ApiKey]]
    )),
    #"Converti en tableau" = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Colonnes développées" = Table.ExpandRecordColumn(
        #"Converti en tableau", "Column1",
        {"resource_id","resource_name","project_id","project_name","date","jh","week","month","year","status"}
    ),
    #"Types" = Table.TransformColumnTypes(#"Colonnes développées", {
        {"resource_id", type text}, {"resource_name", type text},
        {"project_id", type text}, {"project_name", type text},
        {"date", type date}, {"jh", type number},
        {"week", Int64.Type}, {"month", Int64.Type}, {"year", Int64.Type},
        {"status", type text}
    })
in
    #"Types"'''

_M_BUDGET = '''let
    BaseUrl = "{{BASE_URL}}",
    ApiKey  = "{{API_KEY}}",
    Source  = Json.Document(Web.Contents(
        BaseUrl & "/api/powerbi/budget",
        [Headers = [Authorization = "Bearer " & ApiKey]]
    )),
    #"Converti en tableau" = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Colonnes développées" = Table.ExpandRecordColumn(
        #"Converti en tableau", "Column1",
        {"project_id","project_name","budget_total","budget_consumed","budget_forecast",
         "capex_planned","capex_consumed","opex_planned","opex_consumed","eac","variance_pct"}
    ),
    #"Types" = Table.TransformColumnTypes(#"Colonnes développées", {
        {"project_id", type text}, {"project_name", type text},
        {"budget_total", Int64.Type}, {"budget_consumed", Int64.Type}, {"budget_forecast", Int64.Type},
        {"capex_planned", Int64.Type}, {"capex_consumed", Int64.Type},
        {"opex_planned", Int64.Type}, {"opex_consumed", Int64.Type},
        {"eac", Int64.Type}, {"variance_pct", type number}
    })
in
    #"Types"'''

_M_RISKS = '''let
    BaseUrl = "{{BASE_URL}}",
    ApiKey  = "{{API_KEY}}",
    Source  = Json.Document(Web.Contents(
        BaseUrl & "/api/powerbi/risks",
        [Headers = [Authorization = "Bearer " & ApiKey]]
    )),
    #"Converti en tableau" = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Colonnes développées" = Table.ExpandRecordColumn(
        #"Converti en tableau", "Column1",
        {"risk_id","project_id","project_name","title","category","probability",
         "impact","criticality","owner","status","created_at"}
    ),
    #"Types" = Table.TransformColumnTypes(#"Colonnes développées", {
        {"risk_id", type text}, {"project_id", type text}, {"project_name", type text},
        {"title", type text}, {"category", type text},
        {"probability", Int64.Type}, {"impact", Int64.Type}, {"criticality", Int64.Type},
        {"owner", type text}, {"status", type text}, {"created_at", type date}
    })
in
    #"Types"'''

_M_MILESTONES = '''let
    BaseUrl = "{{BASE_URL}}",
    ApiKey  = "{{API_KEY}}",
    Source  = Json.Document(Web.Contents(
        BaseUrl & "/api/powerbi/milestones",
        [Headers = [Authorization = "Bearer " & ApiKey]]
    )),
    #"Converti en tableau" = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Colonnes développées" = Table.ExpandRecordColumn(
        #"Converti en tableau", "Column1",
        {"milestone_id","project_id","project_name","name","family","type","date","days_remaining","status"}
    ),
    #"Types" = Table.TransformColumnTypes(#"Colonnes développées", {
        {"milestone_id", type text}, {"project_id", type text}, {"project_name", type text},
        {"name", type text}, {"family", type text}, {"type", type text},
        {"date", type date}, {"days_remaining", Int64.Type}, {"status", type text}
    })
in
    #"Types"'''

_M_README = """MARCEL Power BI Template — Scripts M-Query
===========================================

URL API : {{BASE_URL}}

INSTRUCTIONS D'IMPORT
---------------------
1. Ouvrez Power BI Desktop
2. Cliquez sur "Obtenir des données" > "Requête vide"
3. Dans l'Éditeur Power Query, cliquez sur "Éditeur avancé"
4. Copiez-collez le contenu du fichier .m correspondant
5. Remplacez la valeur ApiKey par votre clé (depuis MARCEL > Admin > Power BI)
6. Répétez pour chaque table (Projets, Ressources, Timesheets, Budget, Risques, Jalons)

TABLES DISPONIBLES
------------------
- MARCEL_Projets.m      → /api/powerbi/projects
- MARCEL_Ressources.m   → /api/powerbi/resources
- MARCEL_Timesheets.m   → /api/powerbi/timesheets
- MARCEL_Budget.m       → /api/powerbi/budget
- MARCEL_Risques.m      → /api/powerbi/risks
- MARCEL_Jalons.m       → /api/powerbi/milestones

RELATIONS RECOMMANDÉES
----------------------
Projets[project_id] → Timesheets[project_id]  (1:N)
Projets[project_id] → Budget[project_id]      (1:1)
Projets[project_id] → Risques[project_id]     (1:N)
Projets[project_id] → Jalons[project_id]      (1:N)
Ressources[resource_id] → Timesheets[resource_id]  (1:N)
"""

