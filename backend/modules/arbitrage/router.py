from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from .schemas import ScoringPatch, ArbitrageWeightsUpdate, EnvelopeUpsert, ScenarioCreate
from . import service

router = APIRouter(tags=["arbitrage"])


# ── 1. Résumé portefeuille avec scores ────────────────────────────────────────

@router.get("/arbitrage/summary")
async def get_portfolio_summary(
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_portfolio_summary(current_user)


# ── 2. Poids de scoring ───────────────────────────────────────────────────────

@router.get("/arbitrage/weights")
async def get_weights(
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_weights(current_user)


@router.put("/arbitrage/weights")
async def update_weights(
    data: ArbitrageWeightsUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.update_weights(data, current_user)


# ── 3. Scoring d'un projet ────────────────────────────────────────────────────

@router.patch("/arbitrage/projects/{project_id}/scoring")
async def patch_scoring(
    project_id: str,
    data: ScoringPatch,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.patch_project_scoring(project_id, data, current_user)


# ── 4. Enveloppes budgétaires ─────────────────────────────────────────────────

@router.get("/arbitrage/envelopes")
async def list_envelopes(
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_envelopes(current_user)


@router.post("/arbitrage/envelopes", status_code=201)
async def upsert_envelope(
    data: EnvelopeUpsert,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.upsert_envelope(data, current_user)


@router.delete("/arbitrage/envelopes/{envelope_id}")
async def delete_envelope(
    envelope_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.delete_envelope(envelope_id, current_user)


# ── 5. Scénarios What-if ──────────────────────────────────────────────────────

@router.get("/arbitrage/scenarios")
async def list_scenarios(
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_scenarios(current_user)


@router.post("/arbitrage/scenarios", status_code=201)
async def save_scenario(
    data: ScenarioCreate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.save_scenario(data, current_user)


@router.post("/arbitrage/scenarios/{scenario_id}/apply")
async def apply_scenario(
    scenario_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.apply_scenario(scenario_id, current_user)


@router.delete("/arbitrage/scenarios/{scenario_id}")
async def delete_scenario(
    scenario_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.delete_scenario(scenario_id, current_user)
