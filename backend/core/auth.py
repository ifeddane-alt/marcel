from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import jwt, JWTError
from datetime import datetime, timezone, timedelta
import os

JWT_SECRET = os.environ.get('JWT_SECRET', 'projetenne-secret-key-2025')
JWT_ALGORITHM = 'HS256'

security = HTTPBearer()


class TokenPayload(BaseModel):
    tenant_id: str
    user_id: str
    email: str
    role: str
    name: str


def create_token(payload: dict) -> str:
    data = {**payload, 'exp': datetime.now(timezone.utc) + timedelta(hours=24)}
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
) -> TokenPayload:
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return TokenPayload(**payload)
    except (JWTError, Exception):
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")


def require_write(user: TokenPayload):
    if user.role == "READ_ONLY":
        raise HTTPException(status_code=403, detail="Droits insuffisants")
