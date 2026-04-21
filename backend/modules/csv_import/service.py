import csv
import io
import json as _json
import uuid
from datetime import datetime, timezone
from fastapi import HTTPException, UploadFile
from core.database import db
from core.auth import TokenPayload, require_write
from .schemas import IMPORT_TEMPLATES, FIELD_ALIASES, VALID_VALUES


def _auto_suggest_mapping(csv_cols: list, entity: str) -> dict:
    aliases = FIELD_ALIASES.get(entity, {})
    mapping: dict = {}
    used_fields: set = set()
    for col in csv_cols:
        col_lower = col.lower().strip().replace(" ", "_").replace("-", "_")
        for field, field_aliases in aliases.items():
            if field in used_fields:
                continue
            if col_lower in field_aliases or col.lower() in field_aliases:
                mapping[col] = field
                used_fields.add(field)
                break
        else:
            mapping[col] = ""
    return mapping


def _parse_csv_bytes(content: bytes) -> tuple:
    text = ""
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            text = content.decode(enc)
            break
        except Exception:
            continue
    sample = text[:2048]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    rows = list(reader)
    if not rows:
        return [], []
    headers = [h.strip() for h in rows[0]]
    data_rows = [[cell.strip() for cell in r] for r in rows[1:] if any(c.strip() for c in r)]
    return headers, data_rows


def _validate_row(row_dict: dict, entity: str, row_num: int) -> list:
    errors = []
    tpl = IMPORT_TEMPLATES.get(entity, {})
    for req_field in tpl.get("required", []):
        if not row_dict.get(req_field, "").strip():
            errors.append({"row": row_num, "field": req_field,
                           "message": f"Champ requis manquant : {req_field}"})
    date_fields = ["start_date", "end_date_baseline", "end_date_forecast",
                   "date_start_planned", "date_end_planned", "date_start_actual", "date_end_actual"]
    for df in date_fields:
        val = row_dict.get(df, "")
        if val:
            try:
                datetime.strptime(val, "%Y-%m-%d")
            except ValueError:
                errors.append({"row": row_num, "field": df,
                               "message": f"Format date invalide '{val}' (attendu AAAA-MM-JJ)"})
    numeric_fields = ["budget_total", "budget_consumed", "budget_forecast",
                      "jh_planned", "jh_consumed", "budget_planned_k", "budget_consumed_k",
                      "capacity_jh_month"]
    for nf in numeric_fields:
        val = row_dict.get(nf, "")
        if val:
            try:
                float(val.replace(",", "."))
            except ValueError:
                errors.append({"row": row_num, "field": nf,
                               "message": f"Valeur non numérique '{val}'"})
    for field, allowed in VALID_VALUES.get(entity, {}).items():
        val = row_dict.get(field, "")
        if val and val not in allowed:
            errors.append({"row": row_num, "field": field,
                           "message": f"Valeur invalide '{val}' (attendu : {', '.join(allowed)})"})
    return errors


async def preview_import(file: UploadFile, entity: str, current_user: TokenPayload) -> dict:
    require_write(current_user)
    if entity not in IMPORT_TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Entité inconnue : {entity}")
    content = await file.read()
    headers, rows = _parse_csv_bytes(content)
    if not headers:
        raise HTTPException(status_code=422, detail="Fichier CSV vide ou illisible")
    suggested_mapping = _auto_suggest_mapping(headers, entity)
    preview = []
    for i, row in enumerate(rows[:5]):
        row_dict = dict(zip(headers, row + [""] * max(0, len(headers) - len(row))))
        preview.append({"row_num": i + 1, "data": row_dict})
    return {
        "entity": entity,
        "columns": headers,
        "suggested_mapping": suggested_mapping,
        "entity_fields": IMPORT_TEMPLATES[entity]["fields"],
        "required_fields": IMPORT_TEMPLATES[entity]["required"],
        "preview_rows": preview,
        "total_rows": len(rows),
    }


async def commit_import(
    file: UploadFile,
    entity: str,
    mapping: str,
    current_user: TokenPayload,
) -> dict:
    require_write(current_user)
    if entity not in IMPORT_TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Entité inconnue : {entity}")
    try:
        col_mapping: dict = _json.loads(mapping)
    except Exception:
        raise HTTPException(status_code=422, detail="Mapping JSON invalide")

    content = await file.read()
    headers, rows = _parse_csv_bytes(content)
    if not headers:
        raise HTTPException(status_code=422, detail="Fichier CSV vide ou illisible")

    created = 0
    skipped = 0
    errors = []

    projects_lookup: dict = {}
    resources_lookup: dict = {}
    if entity == "tasks":
        projs = await db.projects.find(
            {"tenant_id": current_user.tenant_id}, {"_id": 0, "project_id": 1, "name": 1}
        ).to_list(None)
        projects_lookup = {p["name"]: p["project_id"] for p in projs}
        ress = await db.resources.find(
            {"tenant_id": current_user.tenant_id}, {"_id": 0, "resource_id": 1, "name": 1}
        ).to_list(None)
        resources_lookup = {r["name"]: r["resource_id"] for r in ress}
    programs_lookup: dict = {}
    if entity == "projects":
        progs = await db.programs.find(
            {"tenant_id": current_user.tenant_id}, {"_id": 0, "program_id": 1, "name": 1}
        ).to_list(None)
        programs_lookup = {p["name"]: p["program_id"] for p in progs}

    for row_num, row in enumerate(rows, start=1):
        raw = dict(zip(headers, row + [""] * max(0, len(headers) - len(row))))
        mapped: dict = {}
        for csv_col, entity_field in col_mapping.items():
            if entity_field and entity_field.strip():
                mapped[entity_field] = raw.get(csv_col, "").strip()

        row_errors = _validate_row(mapped, entity, row_num)
        if row_errors:
            errors.extend(row_errors)
            skipped += 1
            continue

        try:
            doc: dict = {}
            if entity == "projects":
                program_id = programs_lookup.get(mapped.get("program_name", ""))
                doc = {
                    "project_id": str(uuid.uuid4()),
                    "tenant_id": current_user.tenant_id,
                    "name": mapped["name"],
                    "methodology": mapped["methodology"],
                    "status_rag": mapped["status_rag"],
                    "budget_total": float(mapped["budget_total"].replace(",", ".")),
                    "budget_consumed": float(mapped.get("budget_consumed", "0").replace(",", ".") or "0"),
                    "budget_forecast": float(mapped["budget_forecast"].replace(",", ".")),
                    "jh_planned": float(mapped["jh_planned"].replace(",", ".")),
                    "jh_consumed": float(mapped.get("jh_consumed", "0").replace(",", ".") or "0"),
                    "start_date": mapped["start_date"],
                    "end_date_baseline": mapped["end_date_baseline"],
                    "end_date_forecast": mapped["end_date_forecast"],
                    "source_id": mapped.get("source_id") or None,
                    "program_id": program_id,
                    "metadata": {},
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.projects.insert_one(doc)
            elif entity == "tasks":
                project_id = projects_lookup.get(mapped.get("project_name", ""))
                if not project_id:
                    errors.append({"row": row_num, "field": "project_name",
                                   "message": f"Projet introuvable : '{mapped.get('project_name')}'"})
                    skipped += 1
                    continue
                resource_id = resources_lookup.get(mapped.get("resource_name", ""))
                doc = {
                    "task_id": str(uuid.uuid4()),
                    "tenant_id": current_user.tenant_id,
                    "project_id": project_id,
                    "name": mapped["name"],
                    "type": mapped.get("type", "tâche"),
                    "status": mapped.get("status", "not_started"),
                    "date_start_planned": mapped.get("date_start_planned") or None,
                    "date_end_planned": mapped.get("date_end_planned") or None,
                    "date_start_actual": mapped.get("date_start_actual") or None,
                    "date_end_actual": mapped.get("date_end_actual") or None,
                    "budget_planned_k": float(mapped.get("budget_planned_k", "0").replace(",", ".") or "0"),
                    "budget_consumed_k": float(mapped.get("budget_consumed_k", "0").replace(",", ".") or "0"),
                    "jh_planned": float(mapped.get("jh_planned", "0").replace(",", ".") or "0"),
                    "jh_consumed": float(mapped.get("jh_consumed", "0").replace(",", ".") or "0"),
                    "resource_id": resource_id,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.tasks.insert_one(doc)
            elif entity == "resources":
                # Résoudre team_id si team_name est fourni
                team_id = None
                if mapped.get("team_id"):
                    team_id = mapped["team_id"]
                elif mapped.get("team"):
                    team_doc = await db.teams.find_one(
                        {"tenant_id": current_user.tenant_id, "name": mapped["team"]}
                    )
                    if team_doc:
                        team_id = team_doc["team_id"]
                doc = {
                    "resource_id": str(uuid.uuid4()),
                    "tenant_id": current_user.tenant_id,
                    "name": mapped["name"],
                    "role": mapped.get("role", ""),
                    "capacity_jh_month": float(
                        mapped.get("capacity_jh_month", "15").replace(",", ".") or "15"
                    ),
                    "tjm_eur": float(mapped.get("tjm_eur", "0").replace(",", ".") or "0") or None,
                    "availability_rate": float(mapped.get("availability_rate", "100").replace(",", ".") or "100"),
                    "team": mapped.get("team", ""),
                    "team_id": team_id,
                    "email": mapped.get("email", ""),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.resources.insert_one(doc)
            doc.pop("_id", None)
            created += 1
        except Exception as e:
            errors.append({"row": row_num, "field": "—", "message": str(e)})
            skipped += 1

    return {
        "entity": entity,
        "total_rows": len(rows),
        "created": created,
        "skipped": skipped,
        "errors": errors[:50],
    }
