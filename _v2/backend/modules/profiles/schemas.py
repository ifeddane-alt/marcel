from pydantic import BaseModel
from typing import List, Optional


class ProfileCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    permissions: List[str] = []


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class ProfileDuplicate(BaseModel):
    new_name: str
    new_code: str
    description: Optional[str] = None
