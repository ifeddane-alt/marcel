from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from enum import Enum


class ConnectorType(str, Enum):
    jira        = "jira"
    sap         = "sap"
    servicenow  = "servicenow"


class AuthType(str, Enum):
    api_token = "api_token"
    oauth2    = "oauth2"
    basic     = "basic"


class SyncDirection(str, Enum):
    import_     = "import"
    export      = "export"
    bidirectional = "bidirectional"


class SyncFrequency(str, Enum):
    manual  = "manual"
    hourly  = "hourly"
    daily   = "daily"


class SyncStatus(str, Enum):
    success = "success"
    error   = "error"
    partial = "partial"
    running = "running"


class ConnectorConfigUpsert(BaseModel):
    enabled:          Optional[bool]         = None
    base_url:         Optional[str]          = None
    auth_type:        Optional[AuthType]     = None
    auth_credentials: Optional[Dict[str, Any]] = None  # chiffrés en base
    field_mapping:    Optional[Dict[str, Any]] = None
    sync_direction:   Optional[SyncDirection] = None
    sync_frequency:   Optional[SyncFrequency] = None


class MappingUpdate(BaseModel):
    field_mapping: Dict[str, Any]
