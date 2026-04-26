"""Schémas Pydantic pour le module Agent IA PMO."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ChatRequest(BaseModel):
    question: str
    session_id: Optional[str] = None   # None = nouvelle session


class ChatResponse(BaseModel):
    answer: str
    session_id: str
    sources: List[str] = []
    duration_ms: int
    verified: bool = True
    warnings: List[str] = []
    is_simulation: bool = False


class ConversationMessage(BaseModel):
    role: str                           # "user" | "assistant"
    content: str
    created_at: datetime
    verified: Optional[bool] = None
    warnings: Optional[List[str]] = None
    is_simulation: Optional[bool] = None


class ConversationSession(BaseModel):
    session_id: str
    first_message: str
    last_activity: str
    message_count: int


class Recommendation(BaseModel):
    id: str
    type: str                           # eac_overrun | unmitigated_risk | delayed_milestone | envelope_breach | red_project | team_overload
    severity: str                       # critical | warning | info
    title: str
    description: str
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    metadata: dict = {}


class AlertRuleCreate(BaseModel):
    metric: str                         # budget_overrun_pct | eac_overrun_pct | delay_days | team_overload_pct | risk_score
    threshold: float
    scope: str = "all"                  # all | project:<id> | program:<id>
    enabled: bool = True
    label: Optional[str] = None


class AlertRuleUpdate(BaseModel):
    threshold: Optional[float] = None
    enabled: Optional[bool] = None
    label: Optional[str] = None
    scope: Optional[str] = None
