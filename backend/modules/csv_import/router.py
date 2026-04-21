import io
import csv
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from core.auth import TokenPayload, get_current_user
from .schemas import IMPORT_TEMPLATES
from . import service

router = APIRouter(tags=["csv_import"])


@router.get("/import/template/{entity}")
async def download_template(entity: str, current_user: TokenPayload = Depends(get_current_user)):
    if entity not in IMPORT_TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Entité inconnue : {entity}")
    tpl = IMPORT_TEMPLATES[entity]
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(tpl["fields"])
    for sample_row in tpl["sample"]:
        writer.writerow(sample_row)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue().encode("utf-8-sig")]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=template_{entity}.csv"},
    )


@router.post("/import/preview")
async def import_preview(
    file: UploadFile = File(...),
    entity: str = Form(...),
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.preview_import(file, entity, current_user)


@router.post("/import/commit")
async def import_commit(
    file: UploadFile = File(...),
    entity: str = Form(...),
    mapping: str = Form(...),
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.commit_import(file, entity, mapping, current_user)
