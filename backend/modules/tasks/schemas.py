from pydantic import BaseModel
from typing import Optional, List


class TaskCreate(BaseModel):
    project_id: str
    name: str
    type: str
    status: str = "not_started"
    date_start_planned: Optional[str] = None
    date_end_planned: Optional[str] = None
    date_start_actual: Optional[str] = None
    date_end_actual: Optional[str] = None
    budget_planned_k: float = 0
    budget_consumed_k: float = 0
    budget_restant_estime: Optional[float] = None
    jh_planned: float = 0
    jh_consumed: float = 0
    jh_restants_estimes: Optional[float] = None
    resource_id: Optional[str] = None
    dependencies: Optional[List[str]] = None


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    date_start_planned: Optional[str] = None
    date_end_planned: Optional[str] = None
    date_start_actual: Optional[str] = None
    date_end_actual: Optional[str] = None
    budget_planned_k: Optional[float] = None
    budget_consumed_k: Optional[float] = None
    budget_restant_estime: Optional[float] = None
    jh_planned: Optional[float] = None
    jh_consumed: Optional[float] = None
    jh_restants_estimes: Optional[float] = None
    resource_id: Optional[str] = None
    dependencies: Optional[List[str]] = None
