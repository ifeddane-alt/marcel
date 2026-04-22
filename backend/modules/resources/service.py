from fastapi import HTTPException
from datetime import datetime, timezone, date
import uuid
from core.database import db
from core.auth import TokenPayload, require_write
from .schemas import ResourceCreate, ResourceUpdate


async def list_resources(current_user: TokenPayload) -> list:
    return await db.resources.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)


async def create_resource(data: ResourceCreate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    doc = {
        "resource_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.resources.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_resource(resource_id: str, data: ResourceUpdate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    # Inclure les champs None explicitement pour permettre la mise à null
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    # Permettre la mise à null de validator_resource_id
    raw = data.model_dump()
    if "validator_resource_id" in raw:
        update_data["validator_resource_id"] = raw["validator_resource_id"]

    result = await db.resources.update_one(
        {"resource_id": resource_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ressource introuvable")
    updated = await db.resources.find_one({"resource_id": resource_id}, {"_id": 0})
    return updated


async def delete_resource(resource_id: str, current_user: TokenPayload) -> None:
    require_write(current_user)
    result = await db.resources.delete_one(
        {"resource_id": resource_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ressource introuvable")


async def get_vendors_summary(current_user: TokenPayload) -> dict:
    """Agrège toutes les ressources externes par fournisseur avec alertes."""
    external = await db.resources.find(
        {
            "tenant_id": current_user.tenant_id,
            "resource_type": {"$in": ["externe_regie", "externe_forfait"]},
        },
        {"_id": 0},
    ).to_list(None)

    today = date.today()
    vendors: dict = {}

    for res in external:
        vendor_name = res.get("vendor") or "Fournisseur inconnu"
        if vendor_name not in vendors:
            vendors[vendor_name] = {
                "vendor": vendor_name,
                "resources_regie": [],
                "resources_forfait": [],
                "total_tjm_contractuel": 0,
                "total_tjm_factuel": 0,
                "total_forfait_envelope": 0,
                "total_forfait_consumed": 0,
                "expiring_soon": [],
                "alerts": [],
            }
        v = vendors[vendor_name]

        # Vérifier expiration du contrat (< 90 jours)
        contract_end = res.get("contract_end")
        if contract_end:
            try:
                end_date = date.fromisoformat(str(contract_end)[:10])
                days_left = (end_date - today).days
                if 0 <= days_left <= 90:
                    v["expiring_soon"].append({
                        "resource_id": res["resource_id"],
                        "name": res["name"],
                        "contract_end": contract_end,
                        "days_left": days_left,
                    })
                    v["alerts"].append({
                        "type": "contrat_expiration",
                        "message": f"{res['name']} : contrat expire dans {days_left}j",
                        "level": "critical" if days_left <= 30 else "warning",
                    })
            except (ValueError, TypeError):
                pass

        if res.get("resource_type") == "externe_regie":
            ctjm = res.get("contract_tjm") or 0
            ftjm = res.get("tjm_eur") or 0
            v["resources_regie"].append({
                "resource_id": res["resource_id"],
                "name": res["name"],
                "role": res.get("role", ""),
                "tjm_eur": ftjm,
                "contract_tjm": ctjm,
                "contract_start": res.get("contract_start"),
                "contract_end": res.get("contract_end"),
            })
            v["total_tjm_contractuel"] += ctjm
            v["total_tjm_factuel"] += ftjm
            # Alerte variance TJM > 10 %
            if ctjm > 0 and ftjm > 0:
                variance_pct = abs(ftjm - ctjm) / ctjm * 100
                if variance_pct > 10:
                    v["alerts"].append({
                        "type": "tjm_variance",
                        "message": f"{res['name']} : TJM facturé {ftjm}€ vs contrat {ctjm}€ ({variance_pct:.0f}%)",
                        "level": "critical" if variance_pct > 20 else "warning",
                    })

        elif res.get("resource_type") == "externe_forfait":
            envelope = res.get("forfait_envelope") or 0
            consumed = res.get("forfait_consumed") or 0
            pct = round(consumed / envelope * 100, 1) if envelope else 0
            v["resources_forfait"].append({
                "resource_id": res["resource_id"],
                "name": res["name"],
                "role": res.get("role", ""),
                "forfait_envelope": envelope,
                "forfait_consumed": consumed,
                "pct_consumed": pct,
                "contract_start": res.get("contract_start"),
                "contract_end": res.get("contract_end"),
            })
            v["total_forfait_envelope"] += envelope
            v["total_forfait_consumed"] += consumed
            # Alerte forfait > 85 %
            if envelope > 0 and consumed / envelope > 0.85:
                v["alerts"].append({
                    "type": "forfait_consumption",
                    "message": f"{res['name']} : forfait consommé à {pct:.0f}%",
                    "level": "critical" if consumed / envelope > 0.95 else "warning",
                })

    vendors_list = list(vendors.values())
    total_alerts = sum(len(v["alerts"]) for v in vendors_list)
    total_expiring = sum(len(v["expiring_soon"]) for v in vendors_list)

    return {
        "vendors": vendors_list,
        "summary": {
            "total_vendors": len(vendors_list),
            "total_regie_resources": sum(len(v["resources_regie"]) for v in vendors_list),
            "total_forfait_resources": sum(len(v["resources_forfait"]) for v in vendors_list),
            "total_tjm_envelope": sum(v["total_tjm_contractuel"] for v in vendors_list),
            "total_forfait_envelope": sum(v["total_forfait_envelope"] for v in vendors_list),
            "total_forfait_consumed": sum(v["total_forfait_consumed"] for v in vendors_list),
            "total_alerts": total_alerts,
            "total_expiring_soon": total_expiring,
        },
    }


async def get_project_external_costs(project_id: str, current_user: TokenPayload) -> dict:
    """Coûts externes d'un projet (régie + forfait) depuis les allocations."""
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id},
        {"_id": 0, "project_id": 1},
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    allocations = await db.allocations.find(
        {"project_id": project_id},
        {"_id": 0, "resource_id": 1, "jh_allocated": 1, "jh_consumed": 1},
    ).to_list(None)

    if not allocations:
        return {"total_regie_eur": 0, "total_forfait_envelope": 0, "total_forfait_consumed": 0, "total_external": 0, "resources": []}

    resource_ids = list({a["resource_id"] for a in allocations})

    external = await db.resources.find(
        {
            "resource_id": {"$in": resource_ids},
            "tenant_id": current_user.tenant_id,
            "resource_type": {"$in": ["externe_regie", "externe_forfait"]},
        },
        {"_id": 0},
    ).to_list(None)

    if not external:
        return {"total_regie_eur": 0, "total_forfait_envelope": 0, "total_forfait_consumed": 0, "total_external": 0, "resources": []}

    ext_map = {r["resource_id"]: r for r in external}

    # Consolider JH par ressource
    alloc_by_resource: dict = {}
    for a in allocations:
        rid = a["resource_id"]
        if rid in ext_map:
            if rid not in alloc_by_resource:
                alloc_by_resource[rid] = {"jh_allocated": 0, "jh_consumed": 0}
            alloc_by_resource[rid]["jh_allocated"] += a.get("jh_allocated", 0)
            alloc_by_resource[rid]["jh_consumed"] += a.get("jh_consumed", 0)

    total_regie_eur = 0
    total_forfait_envelope = 0
    total_forfait_consumed = 0
    resources_detail = []

    for rid, alloc in alloc_by_resource.items():
        res = ext_map[rid]
        if res["resource_type"] == "externe_regie":
            tjm = res.get("contract_tjm") or res.get("tjm_eur") or 0
            cost = alloc["jh_allocated"] * tjm
            total_regie_eur += cost
            resources_detail.append({
                "resource_id": rid,
                "name": res["name"],
                "vendor": res.get("vendor", ""),
                "type": "regie",
                "jh_allocated": alloc["jh_allocated"],
                "jh_consumed": alloc["jh_consumed"],
                "tjm": tjm,
                "cost_estimated": cost,
            })
        elif res["resource_type"] == "externe_forfait":
            envelope = res.get("forfait_envelope") or 0
            consumed = res.get("forfait_consumed") or 0
            total_forfait_envelope += envelope
            total_forfait_consumed += consumed
            resources_detail.append({
                "resource_id": rid,
                "name": res["name"],
                "vendor": res.get("vendor", ""),
                "type": "forfait",
                "forfait_envelope": envelope,
                "forfait_consumed": consumed,
                "pct_consumed": round(consumed / envelope * 100, 1) if envelope else 0,
            })

    return {
        "total_regie_eur": total_regie_eur,
        "total_forfait_envelope": total_forfait_envelope,
        "total_forfait_consumed": total_forfait_consumed,
        "total_external": total_regie_eur + total_forfait_envelope,
        "resources": resources_detail,
    }


async def export_vendors_csv(current_user: TokenPayload) -> bytes:
    """Exporte tous les contrats fournisseurs en CSV."""
    import io, csv as csv_module
    external = await db.resources.find(
        {
            "tenant_id": current_user.tenant_id,
            "resource_type": {"$in": ["externe_regie", "externe_forfait"]},
        },
        {"_id": 0},
    ).to_list(None)

    buf = io.StringIO()
    writer = csv_module.writer(buf, delimiter=";", quoting=csv_module.QUOTE_MINIMAL)
    # En-tête
    writer.writerow([
        "Fournisseur", "Nom / Prestation", "Rôle", "Type",
        "TJM Contrat (€/j)", "TJM Facturé (€/j)", "Variance TJM (%)",
        "Enveloppe Forfait (€)", "Consommé Forfait (€)", "% Consommé",
        "Début Contrat", "Fin Contrat",
    ])
    today = date.today()
    for res in sorted(external, key=lambda r: r.get("vendor", "")):
        rtype = res.get("resource_type", "")
        contract_end = res.get("contract_end", "")
        if contract_end:
            try:
                end_date = date.fromisoformat(str(contract_end)[:10])
                days_left = (end_date - today).days
            except (ValueError, TypeError):
                days_left = None
        else:
            days_left = None
        if rtype == "externe_regie":
            ctjm = res.get("contract_tjm") or 0
            ftjm = res.get("tjm_eur") or 0
            variance = round((ftjm - ctjm) / ctjm * 100, 1) if ctjm > 0 else ""
            writer.writerow([
                res.get("vendor", ""), res.get("name", ""), res.get("role", ""), "Régie",
                ctjm, ftjm, variance,
                "", "", "",
                res.get("contract_start", ""), contract_end,
            ])
        elif rtype == "externe_forfait":
            env = res.get("forfait_envelope") or 0
            cons = res.get("forfait_consumed") or 0
            pct = round(cons / env * 100, 1) if env else ""
            writer.writerow([
                res.get("vendor", ""), res.get("name", ""), res.get("role", ""), "Forfait",
                "", "", "",
                env, cons, pct,
                res.get("contract_start", ""), contract_end,
            ])
    return buf.getvalue().encode("utf-8-sig")  # BOM pour Excel FR
