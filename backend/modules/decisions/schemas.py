from pydantic import BaseModel
from typing import Optional


class DecisionCreate(BaseModel):
    project_id: str
    title: str
    description: Optional[str] = None
    category: str
    status: str = "proposée"
    decision_date: Optional[str] = None
    due_date: Optional[str] = None
    owner: Optional[str] = None
    impact: Optional[str] = None
    governance_id: Optional[str] = None


class DecisionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    decision_date: Optional[str] = None
    due_date: Optional[str] = None
    owner: Optional[str] = None
    impact: Optional[str] = None
    governance_id: Optional[str] = None
