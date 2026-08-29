from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import Response
from core.auth import TokenPayload, get_current_user
from core.uploads import read_upload_limited
from . import service

router = APIRouter(tags=["msproject"])


@router.get("/msproject/export/{project_id}")
async def export_msproject(project_id: str, current_user: TokenPayload = Depends(get_current_user)):
    filename, xml_str = await service.export_project_xml(project_id, current_user)
    return Response(
        content=xml_str,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/msproject/analyze/{project_id}")
async def analyze_msproject(
    project_id: str,
    file: UploadFile = File(...),
    current_user: TokenPayload = Depends(get_current_user),
):
    content = await read_upload_limited(file, {".mpp", ".xml"})
    return await service.analyze_import(project_id, file.filename or "", content, current_user)


@router.post("/msproject/import-new")
async def import_new_msproject(
    file: UploadFile = File(...),
    current_user: TokenPayload = Depends(get_current_user),
):
    content = await read_upload_limited(file, {".mpp", ".xml"})
    return await service.import_new_project(file.filename or "", content, current_user)


@router.post("/msproject/import/{project_id}")
async def import_msproject(
    project_id: str,
    file: UploadFile = File(...),
    current_user: TokenPayload = Depends(get_current_user),
):
    content = await read_upload_limited(file, {".mpp", ".xml"})
    return await service.import_project_file(project_id, file.filename or "", content, current_user)
