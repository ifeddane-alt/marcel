"""Router Status Report."""
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
import io

from core.auth import get_current_user, TokenPayload, has_perm
from fastapi import HTTPException
from . import service

router = APIRouter(tags=["Status Report"])


@router.get("/projects/{project_id}/weather")
async def get_weather(project_id: str, current_user: TokenPayload = Depends(get_current_user)):
    """Calcule les 4 météos automatiques pour un projet."""
    if not has_perm(current_user, "export.status_report"):
        raise HTTPException(403, "Permission export.status_report requise")
    return await service.compute_weather(project_id, current_user.tenant_id)


@router.post("/projects/{project_id}/status-report")
async def generate_status_report(
    project_id: str,
    payload: dict,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Génère le Status Report PPT et le sauvegarde en base."""
    if not has_perm(current_user, "export.status_report"):
        raise HTTPException(403, "Permission export.status_report requise")

    buf, report_id = await service.generate_status_report(project_id, payload, current_user)
    filename = f"status_report_{project_id[:8]}_{report_id[:8]}.pptx"
    return StreamingResponse(
        io.BytesIO(buf),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/projects/{project_id}/status-reports")
async def list_reports(project_id: str, current_user: TokenPayload = Depends(get_current_user)):
    """Historique des status reports d'un projet."""
    if not has_perm(current_user, "export.status_report"):
        raise HTTPException(403, "Permission export.status_report requise")
    return await service.list_reports(project_id, current_user)


# ─── Rapport de statut IA ─────────────────────────────────────────────────────

from . import ai_report as ai_mod


@router.post("/projects/{project_id}/ai-report")
async def generate_ai_report(project_id: str, current_user: TokenPayload = Depends(get_current_user)):
    """Génère un rapport de statut hebdomadaire rédigé par IA."""
    if not has_perm(current_user, "export.status_report"):
        raise HTTPException(403, "Permission export.status_report requise")
    return await ai_mod.generate_ai_report(project_id, current_user)


@router.get("/projects/{project_id}/ai-reports")
async def list_ai_reports(project_id: str, current_user: TokenPayload = Depends(get_current_user)):
    if not has_perm(current_user, "export.status_report"):
        raise HTTPException(403, "Permission export.status_report requise")
    return await ai_mod.list_ai_reports(project_id, current_user)


@router.get("/projects/{project_id}/ai-report/{report_id}/pdf")
async def ai_report_pdf(project_id: str, report_id: str, current_user: TokenPayload = Depends(get_current_user)):
    if not has_perm(current_user, "export.status_report"):
        raise HTTPException(403, "Permission export.status_report requise")
    report = await ai_mod.get_ai_report(project_id, report_id, current_user)
    pdf = ai_mod.build_ai_report_pdf(report)
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="rapport_statut_{report_id[:8]}.pdf"'},
    )


# ─── Rapport IA consolidé du portefeuille ────────────────────────────────────

from . import portfolio_report as ptf_mod


@router.post("/portfolio/ai-report")
async def generate_portfolio_ai_report(current_user: TokenPayload = Depends(get_current_user)):
    if not has_perm(current_user, "export.status_report"):
        raise HTTPException(403, "Permission export.status_report requise")
    from modules.catalog import service as catalog_service
    try:
        vals = await catalog_service.compute_values("dashboard", None, current_user)
        indicators = [
            {"code": i.get("indicator_id"), "nom": i.get("name"),
             "valeur": i.get("display"), "detail": i.get("detail")}
            for i in vals.get("items", []) if i.get("display") not in (None, "—")
        ]
    except Exception:
        indicators = []
    return await ptf_mod.generate_portfolio_report(current_user.tenant_id, current_user.name, indicators)


@router.get("/portfolio/ai-reports")
async def list_portfolio_ai_reports(current_user: TokenPayload = Depends(get_current_user)):
    if not has_perm(current_user, "export.status_report"):
        raise HTTPException(403, "Permission export.status_report requise")
    return await ptf_mod.list_portfolio_reports(current_user.tenant_id)


@router.get("/portfolio/ai-reports/{report_id}")
async def get_portfolio_ai_report(report_id: str, current_user: TokenPayload = Depends(get_current_user)):
    if not has_perm(current_user, "export.status_report"):
        raise HTTPException(403, "Permission export.status_report requise")
    return await ptf_mod.get_portfolio_report(report_id, current_user.tenant_id)


@router.get("/portfolio/ai-reports/{report_id}/pdf")
async def portfolio_ai_report_pdf(report_id: str, current_user: TokenPayload = Depends(get_current_user)):
    if not has_perm(current_user, "export.status_report"):
        raise HTTPException(403, "Permission export.status_report requise")
    report = await ptf_mod.get_portfolio_report(report_id, current_user.tenant_id)
    pdf = ptf_mod.build_portfolio_pdf(report)
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="rapport_portefeuille_{report_id[:8]}.pdf"'},
    )
