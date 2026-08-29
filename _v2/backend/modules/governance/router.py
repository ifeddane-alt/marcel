from fastapi import APIRouter, Depends, Response
from core.auth import TokenPayload, get_current_user, permission_required
from . import service

router = APIRouter(tags=["governance"])


@router.get("/governance")
async def list_governance(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_governance(current_user)


@router.get("/governance/{governance_id}/invitation-pdf")
async def invitation_pdf(
    governance_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    instance = await service.get_governance(governance_id, current_user)
    from .pdf_invitation import build_invitation_pdf
    data = await build_invitation_pdf(instance, current_user.tenant_id)
    safe_name = "".join(c if c.isalnum() else "_" for c in (instance.get("name") or "comite"))[:60]
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Invitation_{safe_name}.pdf"'},
    )


@router.post("/governance", status_code=201)
async def create_governance(
    data: dict,
    current_user: TokenPayload = Depends(permission_required("governance.edit")),
):
    return await service.create_governance(data, current_user)


@router.put("/governance/{governance_id}")
async def update_governance(
    governance_id: str,
    data: dict,
    current_user: TokenPayload = Depends(permission_required("governance.edit")),
):
    return await service.update_governance(governance_id, data, current_user)


@router.delete("/governance/{governance_id}", status_code=204)
async def delete_governance(
    governance_id: str,
    current_user: TokenPayload = Depends(permission_required("governance.edit")),
):
    await service.delete_governance(governance_id, current_user)
