from pydantic import BaseModel
from typing import Optional, List


# ─── Train (ART) ────────────────────────────────────────────────────────────

class TrainCreate(BaseModel):
    name: str
    description: Optional[str] = None
    vision: Optional[str] = None
    team_ids: Optional[List[str]] = None


class TrainUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    vision: Optional[str] = None
    team_ids: Optional[List[str]] = None


# ─── PI (Program Increment) ──────────────────────────────────────────────────

class PICreate(BaseModel):
    train_id: str
    name: str
    start_date: str
    end_date: str
    objectives: Optional[List[str]] = None
    status: str = "planning"   # planning | active | completed


class PIUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    objectives: Optional[List[str]] = None
    status: Optional[str] = None


# ─── Sprint (Iteration) ──────────────────────────────────────────────────────

class SprintCreate(BaseModel):
    pi_id: str
    train_id: str
    name: str
    start_date: str
    end_date: str
    capacity_jh: Optional[float] = None
    velocity_planned: Optional[float] = None
    velocity_actual: Optional[float] = None
    status: str = "planning"   # planning | active | completed


class SprintUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    capacity_jh: Optional[float] = None
    velocity_planned: Optional[float] = None
    velocity_actual: Optional[float] = None
    status: Optional[str] = None


# ─── Capability ──────────────────────────────────────────────────────────────

class CapabilityCreate(BaseModel):
    train_id: str
    pi_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    status: str = "identified"   # identified | committed | in_progress | done
    wsjf: Optional[float] = None
    linked_project_ids: Optional[List[str]] = None


class CapabilityUpdate(BaseModel):
    pi_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    wsjf: Optional[float] = None
    linked_project_ids: Optional[List[str]] = None
