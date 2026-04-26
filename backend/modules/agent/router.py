"""Routeur Agent IA PMO."""
from fastapi import APIRouter, Depends, Query
from core.auth import TokenPayload, get_current_user
from .schemas import ChatRequest, AlertRuleCreate, AlertRuleUpdate
from . import service

router = APIRouter(tags=["agent"])


# ── Chat conversationnel ──────────────────────────────────────────────────────

@router.post("/agent/chat")
async def chat(
    req: ChatRequest,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.chat(req, current_user)


@router.get("/agent/sessions")
async def list_sessions(
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_sessions(current_user)


@router.get("/agent/sessions/{session_id}/history")
async def get_session_history(
    session_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_session_history(session_id, current_user)


# ── Recommandations proactives ────────────────────────────────────────────────

@router.get("/agent/recommendations")
async def get_recommendations(
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_recommendations(current_user)


# ── Règles d'alerte personnalisées ───────────────────────────────────────────

@router.get("/agent/alert-rules")
async def list_alert_rules(
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_alert_rules(current_user)


@router.post("/agent/alert-rules")
async def create_alert_rule(
    data: AlertRuleCreate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.create_alert_rule(data, current_user)


@router.put("/agent/alert-rules/{rule_id}")
async def update_alert_rule(
    rule_id: str,
    data: AlertRuleUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.update_alert_rule(rule_id, data, current_user)


@router.delete("/agent/alert-rules/{rule_id}")
async def delete_alert_rule(
    rule_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.delete_alert_rule(rule_id, current_user)
