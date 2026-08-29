from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["architecture"])


@router.get("/architecture/summary")
async def get_summary(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_summary(current_user)


# ── Interfaces / flux ─────────────────────────────────────────────────────────

@router.get("/architecture/interfaces")
async def list_interfaces(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_interfaces(current_user)


@router.post("/architecture/interfaces", status_code=201)
async def create_interface(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.interfaces.create(data, current_user)


@router.put("/architecture/interfaces/{item_id}")
async def update_interface(item_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.interfaces.update(item_id, data, current_user)


@router.delete("/architecture/interfaces/{item_id}", status_code=204)
async def delete_interface(item_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.interfaces.delete(item_id, current_user)


# ── Standards ─────────────────────────────────────────────────────────────────

@router.get("/architecture/standards")
async def list_standards(current_user: TokenPayload = Depends(get_current_user)):
    return await service.standards.list(current_user)


@router.post("/architecture/standards", status_code=201)
async def create_standard(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.standards.create(data, current_user)


@router.put("/architecture/standards/{item_id}")
async def update_standard(item_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.standards.update(item_id, data, current_user)


@router.delete("/architecture/standards/{item_id}", status_code=204)
async def delete_standard(item_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.standards.delete(item_id, current_user)


# ── Dérogations ───────────────────────────────────────────────────────────────

@router.get("/architecture/exemptions")
async def list_exemptions(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_exemptions(current_user)


@router.post("/architecture/exemptions", status_code=201)
async def create_exemption(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.exemptions.create(data, current_user)


@router.put("/architecture/exemptions/{item_id}")
async def update_exemption(item_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.exemptions.update(item_id, data, current_user)


@router.delete("/architecture/exemptions/{item_id}", status_code=204)
async def delete_exemption(item_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.exemptions.delete(item_id, current_user)


# ── Avis d'architecture ──────────────────────────────────────────────────────

@router.get("/architecture/reviews")
async def list_reviews(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_reviews(current_user)


@router.post("/architecture/reviews", status_code=201)
async def create_review(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.reviews.create(data, current_user)


@router.put("/architecture/reviews/{item_id}")
async def update_review(item_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.reviews.update(item_id, data, current_user)


@router.delete("/architecture/reviews/{item_id}", status_code=204)
async def delete_review(item_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.reviews.delete(item_id, current_user)


# ── Radar techno ─────────────────────────────────────────────────────────────

@router.get("/architecture/radar")
async def list_radar(current_user: TokenPayload = Depends(get_current_user)):
    return await service.radar.list(current_user)


@router.post("/architecture/radar", status_code=201)
async def create_radar(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.radar.create(data, current_user)


@router.put("/architecture/radar/{item_id}")
async def update_radar(item_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.radar.update(item_id, data, current_user)


@router.delete("/architecture/radar/{item_id}", status_code=204)
async def delete_radar(item_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.radar.delete(item_id, current_user)


# ── Dette technique ──────────────────────────────────────────────────────────

@router.get("/architecture/debt")
async def list_debt(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_debt(current_user)


@router.post("/architecture/debt", status_code=201)
async def create_debt(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.debt.create(data, current_user)


@router.put("/architecture/debt/{item_id}")
async def update_debt(item_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.debt.update(item_id, data, current_user)


@router.delete("/architecture/debt/{item_id}", status_code=204)
async def delete_debt(item_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.debt.delete(item_id, current_user)
