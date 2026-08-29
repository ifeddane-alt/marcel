from pydantic import BaseModel
from typing import Optional, List, Any


class ScopeStatusPatch(BaseModel):
    scope_status: Optional[str] = None   # sec | etendu | out | null


class SnapshotCreate(BaseModel):
    project_id: Optional[str] = None
    period_ref: str
    comment: Optional[str] = None


class TransmitRequest(BaseModel):
    target_user_id: str
    comment: Optional[str] = None
