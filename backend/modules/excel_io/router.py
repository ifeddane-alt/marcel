from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from urllib.parse import quote
from core.auth import TokenPayload, get_current_user
from core.uploads import read_upload_limited
from . import service

router = APIRouter(tags=["excel"])


class CommitBody(BaseModel):
    rows: list[dict]


@router.get("/excel/{entity}/export")
async def export_excel(entity: str, current_user: TokenPayload = Depends(get_current_user)):
    filename, data = await service.export_entity(entity, current_user)
    return Response(
        content=data,
        media_type=service.XLSX_MIME,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.post("/excel/{entity}/import/preview")
async def import_preview(
    entity: str,
    file: UploadFile = File(...),
    current_user: TokenPayload = Depends(get_current_user),
):
    content = await read_upload_limited(file, {".xlsx", ".xlsm"})
    return await service.preview_import(entity, content, current_user)


@router.post("/excel/{entity}/import/commit")
async def import_commit(
    entity: str,
    body: CommitBody,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.commit_import(entity, body.rows, current_user)
