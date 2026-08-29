from pydantic import BaseModel
from typing import Optional


class RiskCreate(BaseModel):
    project_id: str
    title: str
    description: Optional[str] = None
    category: str
    probability: int
    impact: int
    status: str = "identifié"
    mitigation_plan: Optional[str] = None
    owner: Optional[str] = None
    due_date: Optional[str] = None


class RiskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    probability: Optional[int] = None
    impact: Optional[int] = None
    status: Optional[str] = None
    mitigation_plan: Optional[str] = None
    owner: Optional[str] = None
    due_date: Optional[str] = None
