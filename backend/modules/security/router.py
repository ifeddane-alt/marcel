from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["security"])


@router.get("/security/summary")
async def get_summary(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_summary(current_user)


@router.get("/security/posture")
async def get_posture(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_posture(current_user)


@router.get("/security/vulnerabilities")
async def list_vulns(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_vulns(current_user)


@router.post("/security/vulnerabilities", status_code=201)
async def create_vuln(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.vulns.create(data, current_user)


@router.put("/security/vulnerabilities/{item_id}")
async def update_vuln(item_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.vulns.update(item_id, data, current_user)


@router.delete("/security/vulnerabilities/{item_id}", status_code=204)
async def delete_vuln(item_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.vulns.delete(item_id, current_user)


@router.get("/security/requirements")
async def list_requirements(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_requirements(current_user)


@router.post("/security/requirements", status_code=201)
async def create_requirement(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.requirements.create(data, current_user)


@router.put("/security/requirements/{item_id}")
async def update_requirement(item_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.requirements.update(item_id, data, current_user)


@router.delete("/security/requirements/{item_id}", status_code=204)
async def delete_requirement(item_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.requirements.delete(item_id, current_user)


@router.get("/security/reviews")
async def list_reviews(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_reviews(current_user)


@router.post("/security/reviews", status_code=201)
async def create_review(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.reviews.create(data, current_user)


@router.put("/security/reviews/{item_id}")
async def update_review(item_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.reviews.update(item_id, data, current_user)


@router.delete("/security/reviews/{item_id}", status_code=204)
async def delete_review(item_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.reviews.delete(item_id, current_user)
