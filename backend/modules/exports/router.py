"""Exports PPTX — Router."""
import io
from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from core.auth import TokenPayload, permission_required
from . import service

router = APIRouter(tags=["exports"])

PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"


@router.get("/exports/copil.pptx")
async def copil_pptx(current_user: TokenPayload = Depends(permission_required("portfolio.view"))):
    data = await service.build_copil_pptx(current_user)
    filename = f"COPIL_portefeuille_{date.today().isoformat()}.pptx"
    return StreamingResponse(io.BytesIO(data), media_type=PPTX_MIME,
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})
