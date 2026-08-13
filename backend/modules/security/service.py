from core.database import db
from core.auth import TokenPayload
from core.simple_crud import SimpleCrud, app_names, project_names

FRAMEWORKS = ["DORA", "NIS2", "RGPD", "ISO27001", "Autre"]

vulns = SimpleCrud(
    "vulnerabilities", "vuln_id",
    {"title", "application_id", "severity", "source", "discovered_at", "due_date", "status", "description"},
    required=("title",), sort_field="discovered_at",
)
requirements = SimpleCrud(
    "compliance_requirements", "req_id",
    {"framework", "ref", "title", "status", "application_id", "action_plan", "due_date", "owner"},
    required=("title", "framework"), sort_field="framework", sort_dir=1,
)
reviews = SimpleCrud(
    "security_reviews", "review_id",
    {"project_id", "status", "comments", "reviewer", "review_date"},
    required=("project_id",), sort_field="review_date",
)

_VULN_WEIGHT = {"critique": 25, "haute": 15, "moyenne": 8, "basse": 3}
_OPEN_STATUSES = ("ouverte", "en_remediation")


async def list_vulns(user: TokenPayload) -> list:
    items = await vulns.list(user)
    names = await app_names(user.tenant_id)
    for v in items:
        v["application_name"] = names.get(v.get("application_id"))
    return items


async def list_requirements(user: TokenPayload) -> list:
    items = await requirements.list(user)
    names = await app_names(user.tenant_id)
    for r in items:
        r["application_name"] = names.get(r.get("application_id"))
    return items


async def list_reviews(user: TokenPayload) -> list:
    items = await reviews.list(user)
    names = await project_names(user.tenant_id)
    for r in items:
        r["project_name"] = names.get(r.get("project_id"))
    return items


async def get_posture(user: TokenPayload) -> list:
    apps = await db.applications.find(
        {"tenant_id": user.tenant_id},
        {"_id": 0, "application_id": 1, "name": 1, "criticality": 1},
    ).sort("name", 1).to_list(None)
    all_vulns = await db.vulnerabilities.find(
        {"tenant_id": user.tenant_id, "status": {"$in": list(_OPEN_STATUSES)}}, {"_id": 0}
    ).to_list(None)
    all_reqs = await db.compliance_requirements.find(
        {"tenant_id": user.tenant_id, "status": "non_conforme"}, {"_id": 0, "application_id": 1}
    ).to_list(None)
    result = []
    for a in apps:
        aid = a["application_id"]
        app_vulns = [v for v in all_vulns if v.get("application_id") == aid]
        nc = sum(1 for r in all_reqs if r.get("application_id") == aid)
        score = 100 - sum(_VULN_WEIGHT.get(v.get("severity"), 3) for v in app_vulns) - 10 * nc
        result.append({
            "application_id": aid,
            "name": a["name"],
            "criticality": a.get("criticality"),
            "score": max(0, min(100, score)),
            "open_vulns": len(app_vulns),
            "critical_vulns": sum(1 for v in app_vulns if v.get("severity") == "critique"),
            "non_conforme": nc,
        })
    return result


async def get_summary(user: TokenPayload) -> dict:
    all_vulns = await db.vulnerabilities.find({"tenant_id": user.tenant_id}, {"_id": 0}).to_list(None)
    open_vulns = [v for v in all_vulns if v.get("status") in _OPEN_STATUSES]
    reqs = await db.compliance_requirements.find({"tenant_id": user.tenant_id}, {"_id": 0}).to_list(None)
    by_framework = {}
    for r in reqs:
        fw = r.get("framework") or "Autre"
        d = by_framework.setdefault(fw, {"total": 0, "conforme": 0, "partiel": 0, "non_conforme": 0, "na": 0})
        d["total"] += 1
        st = r.get("status") or "non_conforme"
        if st in d:
            d[st] += 1
    for fw, d in by_framework.items():
        evaluable = d["total"] - d["na"]
        d["pct_conforme"] = round(d["conforme"] / evaluable * 100) if evaluable > 0 else 0
    revs = await db.security_reviews.find({"tenant_id": user.tenant_id}, {"_id": 0, "status": 1}).to_list(None)
    posture = await get_posture(user)
    return {
        "vulns_open": len(open_vulns),
        "vulns_critical_open": sum(1 for v in open_vulns if v.get("severity") == "critique"),
        "by_framework": by_framework,
        "reviews_pending": sum(1 for r in revs if r.get("status", "en_attente") == "en_attente"),
        "apps_at_risk": sum(1 for p in posture if p["score"] < 60),
    }
