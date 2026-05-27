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
