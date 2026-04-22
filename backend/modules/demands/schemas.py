from pydantic import BaseModel, Field
from typing import Optional, Literal

DemandUrgency = Literal["low", "medium", "high", "critical"]
DemandStatus  = Literal["nouvelle", "qualifiee", "priorisee", "acceptee", "refusee", "convertie"]
DemandAction  = Literal["qualify", "prioritize", "accept", "refuse"]


class DemandCreate(BaseModel):
    title: str
    description: Optional[str] = None
    requester: str
    requester_department: Optional[str] = None
    business_value: Optional[str] = None
    estimated_budget: Optional[float] = None
    urgency: DemandUrgency = "medium"


class DemandUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requester: Optional[str] = None
    requester_department: Optional[str] = None
    business_value: Optional[str] = None
    estimated_budget: Optional[float] = None
    urgency: Optional[DemandUrgency] = None


class DemandTransitionRequest(BaseModel):
    action: DemandAction
    priority_score: Optional[int] = Field(None, ge=0, le=100)
    rejection_reason: Optional[str] = None


class ConvertToProjectRequest(BaseModel):
    name: str
    description: Optional[str] = None
    status_rag: str = "green"
    budget_total: Optional[float] = None
    start_date: str
    end_date_baseline: str
    end_date_forecast: str
    program_id: Optional[str] = None
