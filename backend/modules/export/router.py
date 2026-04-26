from fastapi import APIRouter, Depends
from fastapi.responses import Response
import re
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
    # Nommage : COPIL_[date]_[nom-slug].pptx
    slug = re.sub(r"[^a-z0-9]+", "-", instance_name.lower()).strip("-")[:40]
    filename = f"COPIL_{instance_date}_{slug}.pptx"
    return Response(
        content=buf.read(),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
