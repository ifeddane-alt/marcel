from pydantic import BaseModel
from typing import Optional, Literal


PHASES = Literal["analyse", "conception", "implementation", "review", "test", "hypercare"]


class WorkAllocationCreate(BaseModel):
    task_id: str
    resource_id: str
    phase: PHASES
    planned_md: float
    consumed_md: float = 0.0


class WorkAllocationUpdate(BaseModel):
    phase: Optional[PHASES] = None
    planned_md: Optional[float] = None
    consumed_md: Optional[float] = None
