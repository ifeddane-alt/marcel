from fastapi import APIRouter, Depends
from fastapi.responses import Response
from core.auth import TokenPayload, get_current_user
from .schemas import ExportCopilRequest
from . import service

router = APIRouter(tags=["export"])


@router.post("/export/copil")
async def export_copil(
    data: ExportCopilRequest,
    current_user: TokenPayload = Depends(get_current_user),
):
    buf, instance_name, instance_date = await service.export_copil(data, current_user)
    safe_name = "".join(c if c.isalnum() else "_" for c in instance_name)[:40]
    filename = f"COPIL_{safe_name}_{instance_date}.pptx"
    return Response(
        content=buf.read(),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
