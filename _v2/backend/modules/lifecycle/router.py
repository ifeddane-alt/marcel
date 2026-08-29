from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user, permission_required
from . import service

router = APIRouter(tags=["lifecycle"])


@router.get("/lifecycle/referential")
async def referential(current_user: TokenPayload = Depends(get_current_user)):
    return service.referential()


@router.get("/lifecycle/portfolio")
async def portfolio(current_user: TokenPayload = Depends(get_current_user)):
    return await service.portfolio(current_user)


@router.get("/lifecycle/my-reviews")
async def my_reviews(current_user: TokenPayload = Depends(get_current_user)):
    return await service.my_reviews(current_user)


@router.get("/projects/{project_id}/lifecycle")
async def project_lifecycle(project_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.project_lifecycle(project_id, current_user)


@router.put("/projects/{project_id}/lifecycle/phase")
async def set_phase(
    project_id: str, data: dict,
    current_user: TokenPayload = Depends(permission_required("lifecycle.decide")),
):
    return await service.set_phase(project_id, data.get("phase"), current_user)


@router.post("/projects/{project_id}/lifecycle/gates", status_code=201)
async def request_gate(
    project_id: str, data: dict,
    current_user: TokenPayload = Depends(permission_required("lifecycle.request")),
):
    return await service.request_gate(project_id, data, current_user)


@router.delete("/lifecycle/gates/{gate_id}", status_code=204)
async def cancel_gate(
    gate_id: str,
    current_user: TokenPayload = Depends(permission_required("lifecycle.request")),
):
    await service.cancel_gate(gate_id, current_user)


@router.put("/lifecycle/gates/{gate_id}/deliverables/{key}")
async def update_deliverable(
    gate_id: str, key: str, data: dict,
    current_user: TokenPayload = Depends(permission_required("lifecycle.request")),
):
    return await service.update_deliverable(gate_id, key, data, current_user)


@router.post("/lifecycle/gates/{gate_id}/deliverables/{key}/review")
async def review_deliverable(
    gate_id: str, key: str, data: dict,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.review_deliverable(gate_id, key, data, current_user)


@router.post("/lifecycle/gates/{gate_id}/decision")
async def decide_gate(
    gate_id: str, data: dict,
    current_user: TokenPayload = Depends(permission_required("lifecycle.decide")),
):
    return await service.decide_gate(gate_id, data, current_user)
