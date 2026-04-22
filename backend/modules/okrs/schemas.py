from pydantic import BaseModel
from typing import Optional, List


class KeyResult(BaseModel):
    kr_id: Optional[str] = None
    description: str
    target_value: float = 100
    current_value: float = 0
    unit: str = "%"


class OKRCreate(BaseModel):
    train_id: Optional[str] = None
    objective: str
    description: Optional[str] = None
    key_results: Optional[List[KeyResult]] = None
    linked_capability_ids: Optional[List[str]] = None
    status: str = "on_track"   # on_track | at_risk | behind | achieved


class OKRUpdate(BaseModel):
    objective: Optional[str] = None
    description: Optional[str] = None
    key_results: Optional[List[KeyResult]] = None
    linked_capability_ids: Optional[List[str]] = None
    status: Optional[str] = None


class WSJFUpdate(BaseModel):
    """Mise à jour des critères WSJF d'une capability."""
    business_value: Optional[int] = None       # 1-21
    time_criticality: Optional[int] = None     # 1-21
    risk_reduction: Optional[int] = None       # 1-21
    job_size: Optional[int] = None             # 1-21 (Fibonacci: 1,2,3,5,8,13,21)
