from fastapi import APIRouter, HTTPException, Depends
import bcrypt
from core.auth import TokenPayload, get_current_user, create_token
from core.database import db
from .schemas import LoginRequest

router = APIRouter(tags=["auth"])


@router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    if not bcrypt.checkpw(req.password.encode(), user['password_hash'].encode()):
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    token = create_token({
        "tenant_id":   user["tenant_id"],
        "user_id":     user["user_id"],
        "email":       user["email"],
        "role":        user["role"],
        "name":        user["name"],
        "resource_id": user.get("resource_id"),
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {k: user.get(k) for k in ("user_id", "email", "name", "role", "tenant_id", "resource_id")},
    }


@router.get("/auth/me")
async def get_me(current_user: TokenPayload = Depends(get_current_user)):
    return current_user.model_dump()
