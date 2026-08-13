from core.database import db
from core.auth import TokenPayload
from core.simple_crud import SimpleCrud, app_names, project_names

interfaces = SimpleCrud(
    "app_interfaces", "interface_id",
    {"name", "source_application_id", "target_application_id", "protocol", "frequency", "criticality", "data_desc"},
    required=("name",), sort_field="name", sort_dir=1,
)
standards = SimpleCrud(
    "architecture_standards", "standard_id",
    {"title", "category", "description", "status"},
    required=("title",), sort_field="title", sort_dir=1,
)
exemptions = SimpleCrud(
    "architecture_exemptions", "exemption_id",
    {"standard_id", "scope_label", "justification", "expiry", "status"},
    required=("standard_id",),
)
reviews = SimpleCrud(
    "architecture_reviews", "review_id",
    {"project_id", "status", "comments", "reviewer", "review_date"},
    required=("project_id",), sort_field="review_date",
)
radar = SimpleCrud(
    "tech_radar", "item_id",
    {"techno", "ring", "category", "note"},
    required=("techno",), sort_field="techno", sort_dir=1,
)
debt = SimpleCrud(
    "tech_debt", "debt_id",
    {"application_id", "description", "effort_jh", "priority", "status"},
    required=("description",),
)


async def list_interfaces(user: TokenPayload) -> list:
    items = await interfaces.list(user)
    names = await app_names(user.tenant_id)
    for i in items:
        i["source_name"] = names.get(i.get("source_application_id"))
        i["target_name"] = names.get(i.get("target_application_id"))
    return items


async def list_exemptions(user: TokenPayload) -> list:
    items = await exemptions.list(user)
    stds = {s["standard_id"]: s["title"] for s in await db.architecture_standards.find(
        {"tenant_id": user.tenant_id}, {"_id": 0, "standard_id": 1, "title": 1}).to_list(None)}
    for e in items:
        e["standard_title"] = stds.get(e.get("standard_id"))
    return items


async def list_reviews(user: TokenPayload) -> list:
    items = await reviews.list(user)
    names = await project_names(user.tenant_id)
    for r in items:
        r["project_name"] = names.get(r.get("project_id"))
    return items


async def list_debt(user: TokenPayload) -> list:
    items = await debt.list(user)
    names = await app_names(user.tenant_id)
    for d in items:
        d["application_name"] = names.get(d.get("application_id"))
    return items


async def get_summary(user: TokenPayload) -> dict:
    t = user.tenant_id
    ifaces = await db.app_interfaces.count_documents({"tenant_id": t})
    stds = await db.architecture_standards.count_documents({"tenant_id": t, "status": {"$ne": "deprecie"}})
    exs = await db.architecture_exemptions.count_documents({"tenant_id": t, "status": {"$nin": ["expiree", "levee"]}})
    revs = await db.architecture_reviews.find({"tenant_id": t}, {"_id": 0, "status": 1}).to_list(None)
    debts = await db.tech_debt.find({"tenant_id": t}, {"_id": 0, "effort_jh": 1, "status": 1}).to_list(None)
    open_debt = [d for d in debts if d.get("status") != "traitee"]
    radar_items = await db.tech_radar.find({"tenant_id": t}, {"_id": 0, "ring": 1}).to_list(None)
    rings = {}
    for r in radar_items:
        rings[r.get("ring") or "assess"] = rings.get(r.get("ring") or "assess", 0) + 1
    return {
        "interfaces_count": ifaces,
        "standards_active": stds,
        "exemptions_active": exs,
        "reviews_pending": sum(1 for r in revs if r.get("status", "en_attente") == "en_attente"),
        "debt_items_open": len(open_debt),
        "debt_jh_open": round(sum(d.get("effort_jh") or 0 for d in open_debt), 1),
        "radar_rings": rings,
    }
