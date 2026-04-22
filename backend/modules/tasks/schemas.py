from pydantic import BaseModel
from typing import Optional, List


class PhaseEstimate(BaseModel):
    phase: str
    jh_estimated: float = 0
    jh_actual: Optional[float] = None
    notes: Optional[str] = None


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
    # 3b — Hiérarchie SAFe
    parent_id: Optional[str] = None
    task_level: str = "task"    # task | feature | user_story
    # 3d — Cycle de vie
    lifecycle_phase: str = "backlog"
    # 3e — Estimations par phase
    phase_estimates: Optional[List[PhaseEstimate]] = None
    # Sprint assignment
    sprint_id: Optional[str] = None


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
    # 3b
    parent_id: Optional[str] = None
    task_level: Optional[str] = None
    # 3d
    lifecycle_phase: Optional[str] = None
    # 3e
    phase_estimates: Optional[List[PhaseEstimate]] = None
    # Sprint assignment
    sprint_id: Optional[str] = None


class PhaseTransition(BaseModel):
    to_phase: str
    note: Optional[str] = None

