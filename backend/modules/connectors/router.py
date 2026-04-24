from fastapi import APIRouter, Depends, Query
from core.auth import TokenPayload, get_current_user
from .schemas import ConnectorConfigUpsert, MappingUpdate
from . import service

router = APIRouter(tags=["connectors"])

VALID_TYPES = {"jira", "sap", "servicenow"}


def _check_type(t: str):
    if t not in VALID_TYPES:
        from fastapi import HTTPException
        raise HTTPException(400, f"Type de connecteur invalide : {t}. Valeurs : {', '.join(VALID_TYPES)}")


# ── Liste tous les connecteurs ────────────────────────────────────────────────

@router.get("/connectors")
async def list_connectors(
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_all_configs(current_user)


# ── Config ────────────────────────────────────────────────────────────────────

@router.get("/connectors/{connector_type}/config")
async def get_config(
    connector_type: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    _check_type(connector_type)
    return await service.get_config(connector_type, current_user)


@router.put("/connectors/{connector_type}/config")
async def upsert_config(
    connector_type: str,
    data: ConnectorConfigUpsert,
    current_user: TokenPayload = Depends(get_current_user),
):
    _check_type(connector_type)
    return await service.upsert_config(connector_type, data, current_user)


# ── Mapping ───────────────────────────────────────────────────────────────────

@router.put("/connectors/{connector_type}/mapping")
async def update_mapping(
    connector_type: str,
    data: MappingUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    _check_type(connector_type)
    return await service.update_mapping(connector_type, data, current_user)


# ── Test connexion ────────────────────────────────────────────────────────────

@router.post("/connectors/{connector_type}/test")
async def test_connection(
    connector_type: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    _check_type(connector_type)
    return await service.test_connection(connector_type, current_user)


# ── Sync manuelle ──────────────────────────────────────────────────────────────

@router.post("/connectors/{connector_type}/sync")
async def trigger_sync(
    connector_type: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    _check_type(connector_type)
    return await service.trigger_sync(connector_type, current_user)


# ── Statut ────────────────────────────────────────────────────────────────────

@router.get("/connectors/{connector_type}/status")
async def get_status(
    connector_type: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    _check_type(connector_type)
    return await service.get_status(connector_type, current_user)


# ── Logs ──────────────────────────────────────────────────────────────────────

@router.get("/connectors/{connector_type}/logs")
async def get_logs(
    connector_type: str,
    limit: int = Query(20, ge=1, le=100),
    current_user: TokenPayload = Depends(get_current_user),
):
    _check_type(connector_type)
    return await service.get_logs(connector_type, current_user, limit)
