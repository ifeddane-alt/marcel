from typing import Optional
from datetime import datetime
from core.database import db

STATUS_PROGRESS = {
    "not_started": 0.0,
    "in_progress": 0.50,
    "completed": 1.0,
    "delayed": 0.45,
    "cancelled": 1.0,
}


def calculate_task_rag(
    task: dict,
    budget_threshold_pct: float = 115.0,
    delay_threshold_days: int = 5,
    reference_date_str: Optional[str] = None,
) -> dict:
    """Compute budget_landing, jh_landing and task_rag (green/orange/red)."""
    status = task.get("status", "not_started")

    if status == "cancelled":
        return {
            "budget_landing": round(task.get("budget_consumed_k", 0), 1),
            "jh_landing": round(task.get("jh_consumed", 0), 1),
            "task_rag": "green",
            "rag_details": {"budget_ratio": 100.0, "jh_ratio": 100.0, "delay_days": 0},
        }

    pct = STATUS_PROGRESS.get(status, 0.5)

    budget_planned = task.get("budget_planned_k") or 0.0
    budget_consumed = task.get("budget_consumed_k") or 0.0
    budget_restant = task.get("budget_restant_estime")

    jh_planned = task.get("jh_planned") or 0.0
    jh_consumed = task.get("jh_consumed") or 0.0
    jh_restant = task.get("jh_restants_estimes")

    if budget_restant is not None:
        budget_landing = budget_consumed + budget_restant
    elif pct > 0:
        budget_landing = budget_consumed / pct
    else:
        budget_landing = budget_planned

    if jh_restant is not None:
        jh_landing = jh_consumed + jh_restant
    elif pct > 0:
        jh_landing = jh_consumed / pct
    else:
        jh_landing = jh_planned

    delay_days = 0
    date_end_planned = task.get("date_end_planned")
    date_end_actual = task.get("date_end_actual")

    if date_end_planned:
        try:
            planned_dt = datetime.strptime(date_end_planned, "%Y-%m-%d")
            if date_end_actual:
                actual_dt = datetime.strptime(date_end_actual, "%Y-%m-%d")
                delay_days = (actual_dt - planned_dt).days
            elif status in ("in_progress", "delayed"):
                if reference_date_str:
                    ref_dt = datetime.strptime(reference_date_str, "%Y-%m-%d")
                else:
                    ref_dt = datetime.now()
                delay_days = max(0, (ref_dt - planned_dt).days)
        except Exception:
            pass

    budget_ratio = (budget_landing / budget_planned * 100) if budget_planned > 0 else 100.0
    jh_ratio = (jh_landing / jh_planned * 100) if jh_planned > 0 else 100.0

    def _rag(ratio: float, d: int) -> str:
        if ratio > budget_threshold_pct or d > delay_threshold_days:
            return "red"
        if ratio > 100.0 or 1 <= d <= delay_threshold_days:
            return "orange"
        return "green"

    budget_rag = _rag(budget_ratio, delay_days)
    jh_rag = "green" if jh_ratio <= 100.0 else ("red" if jh_ratio > budget_threshold_pct else "orange")

    rag_order = {"red": 2, "orange": 1, "green": 0}
    final_rag = max([budget_rag, jh_rag], key=lambda r: rag_order[r])

    return {
        "budget_landing": round(budget_landing, 1),
        "jh_landing": round(jh_landing, 1),
        "task_rag": final_rag,
        "rag_details": {
            "budget_ratio": round(budget_ratio, 1),
            "jh_ratio": round(jh_ratio, 1),
            "delay_days": delay_days,
        },
    }


async def _get_task_rag_settings(tenant_id: str) -> dict:
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0, "settings": 1})
    settings = (tenant or {}).get("settings", {})
    tr = settings.get("task_rag", {})
    return {
        "budget_threshold_pct": float(tr.get("budget_threshold_pct", 115)),
        "delay_threshold_days": int(tr.get("delay_threshold_days", 5)),
        "reference_date": tr.get("reference_date"),
    }
