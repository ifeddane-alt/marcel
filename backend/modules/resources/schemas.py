from pydantic import BaseModel
from typing import Optional


class ResourceCreate(BaseModel):
    name: str
    role: str
    team: Optional[str] = None
    team_id: Optional[str] = None
    tjm_eur: Optional[float] = None
    availability_rate: Optional[float] = 100
    capacity_jh_month: float = 15
    email: Optional[str] = None


class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    team: Optional[str] = None
    team_id: Optional[str] = None
    tjm_eur: Optional[float] = None
    availability_rate: Optional[float] = None
    capacity_jh_month: Optional[float] = None
    email: Optional[str] = None
