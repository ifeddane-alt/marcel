from pydantic import BaseModel
from typing import Optional


class ProgramCreate(BaseModel):
    name: str
    description: Optional[str] = None
    owner: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget_keur: float = 0
    status: str = "active"


class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    owner: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget_keur: Optional[float] = None
    status: Optional[str] = None
