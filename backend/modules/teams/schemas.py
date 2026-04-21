from pydantic import BaseModel
from typing import Optional


class TeamCreate(BaseModel):
    name: str
    manager_resource_id: Optional[str] = None
    train_id: Optional[str] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    manager_resource_id: Optional[str] = None
    train_id: Optional[str] = None
