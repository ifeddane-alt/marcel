"""Socle API publique MARCEL v1 (lecture seule) — tokens tenant scoped + rate limit + audit.

Sécurité : tenant_id dérivé UNIQUEMENT du token ; token stocké en SHA-256 (jamais en clair) ;
comparaison à temps constant ; scopes par domaine ; rate-limit atomique Mongo par token.
"""
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException, Request
from pymongo import ReturnDocument

from core.database import db

TOKEN_PREFIX = "mrcl_live_"
STORE_PREFIX_LEN = len(TOKEN_PREFIX) + 8  # préfixe indexé pour lookup (identifiant, non secret)
DEFAULT_RATE_PER_MIN = int(os.environ.get("PUBLIC_API_RATE_LIMIT", "120"))

# Scopes lecture disponibles (un token n'accède qu'aux domaines explicitement autorisés)
SCOPES = [
    "projects.read", "programs.read", "portfolio.read", "budgets.read",
    "milestones.read", "risks.read", "dependencies.read", "capacity.read",
    "decisions.read", "applications.read", "incidents.read",
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def generate_raw_token() -> str:
    return TOKEN_PREFIX + secrets.token_hex(32)  # 256 bits


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("ascii")).hexdigest()


def store_prefix(raw: str) -> str:
    return raw[:STORE_PREFIX_LEN]


class PublicApiContext:
    def __init__(self, tenant_id: str, token_id: str, scopes: list, prefix: str):
        self.tenant_id = tenant_id
        self.token_id = token_id
        self.scopes = scopes
        self.prefix = prefix


def _reject():
    raise HTTPException(401, "Invalid API credentials", headers={"WWW-Authenticate": "Bearer"})


def _extract(request: Request):
    auth = request.headers.get("Authorization")
    xkey = request.headers.get("X-API-Key")
    if auth and xkey:
        _reject()  # credentials ambigus
    if xkey:
        return xkey.strip()
    if auth:
        scheme, _, val = auth.partition(" ")
        if scheme.lower() == "bearer" and val.strip():
            return val.strip()
    return None


async def _authenticate(request: Request) -> PublicApiContext:
    raw = _extract(request)
    if not raw or not raw.startswith(TOKEN_PREFIX):
        _reject()
    cands = await db.api_tokens.find({"token_prefix": store_prefix(raw)}).to_list(5)
    presented = hash_token(raw)
    tok = next((d for d in cands if hmac.compare_digest(presented, d.get("token_hash", ""))), None)
    if not tok or tok.get("revoked_at"):
        _reject()
    exp = tok.get("expires_at")
    if exp:
        try:
            if datetime.fromisoformat(exp) <= _now():
                _reject()
        except (ValueError, TypeError):
            pass

    # rate-limit atomique par token (fenêtre fixe 60 s)
    limit = tok.get("rate_limit_per_min") or DEFAULT_RATE_PER_MIN
    epoch = int(_now().timestamp())
    window = 60
    start = epoch - (epoch % window)
    ctr = await db.api_rate_limits.find_one_and_update(
        {"token_id": tok["token_id"], "window_start": start},
        {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": _now() + timedelta(seconds=window * 2)}},
        upsert=True, return_document=ReturnDocument.AFTER,
    )
    if ctr["count"] > limit:
        raise HTTPException(429, "Rate limit exceeded", headers={"Retry-After": str(window - (epoch % window))})

    await db.api_tokens.update_one({"token_id": tok["token_id"]}, {"$set": {"last_used_at": _now().isoformat()}})
    request.state.api_token_id = tok["token_id"]
    request.state.api_tenant_id = tok["tenant_id"]
    request.state.api_prefix = tok["token_prefix"]
    return PublicApiContext(tok["tenant_id"], tok["token_id"], tok.get("scopes", []), tok["token_prefix"])


def require_scope(scope: str):
    """Dépendance FastAPI : authentifie le token puis exige le scope lecture."""
    async def dep(request: Request) -> PublicApiContext:
        ctx = await _authenticate(request)
        request.state.api_scope = scope
        if scope not in ctx.scopes:
            raise HTTPException(403, "Insufficient scope for this resource")
        return ctx
    return dep


# ─── Pagination / tri / filtres ───────────────────────────────────────────────
def parse_params(request: Request, filterable: list, sortable: list, default_sort: str):
    q = request.query_params
    try:
        page = max(1, int(q.get("page", 1)))
    except (ValueError, TypeError):
        page = 1
    try:
        limit = min(100, max(1, int(q.get("limit", 50))))
    except (ValueError, TypeError):
        limit = 50
    filters = {}
    for f in filterable:
        if f in q and q.get(f) != "":
            v = q.get(f)
            if v in ("true", "false"):
                v = (v == "true")
            filters[f] = v
    sort_field = default_sort
    direction = -1
    raw_sort = q.get("sort")
    if raw_sort:
        desc = raw_sort.startswith("-")
        field = raw_sort[1:] if desc else raw_sort
        if field in sortable:
            sort_field = field
            direction = -1 if desc else 1
    return page, limit, filters, [(sort_field, direction)]


async def query_collection(collection, ctx, request, projection_fields, filterable, sortable, default_sort):
    page, limit, filters, sort = parse_params(request, filterable, sortable, default_sort)
    query = {"tenant_id": ctx.tenant_id, **filters}
    projection = {"_id": 0, **{f: 1 for f in projection_fields}}
    total = await collection.count_documents(query)
    cursor = collection.find(query, projection).sort(sort).skip((page - 1) * limit).limit(limit)
    data = await cursor.to_list(limit)
    return {
        "data": data,
        "pagination": {
            "page": page, "limit": limit, "total": total,
            "pages": (total + limit - 1) // limit if limit else 0,
        },
    }


# ─── Audit ────────────────────────────────────────────────────────────────────
async def log_api_call(request: Request, status_code: int):
    try:
        await db.api_audit_logs.insert_one({
            "at": _now().isoformat(),
            "method": request.method,
            "path": request.url.path,
            "query": str(request.url.query)[:300],
            "status": status_code,
            "tenant_id": getattr(request.state, "api_tenant_id", None),
            "token_id": getattr(request.state, "api_token_id", None),
            "token_prefix": getattr(request.state, "api_prefix", None),
            "scope": getattr(request.state, "api_scope", None),
            "ip": request.headers.get("x-forwarded-for", request.client.host if request.client else None),
        })
    except Exception:
        pass


async def init_public_api_indexes():
    await db.api_tokens.create_index("token_prefix", name="ix_api_token_prefix")
    await db.api_tokens.create_index([("tenant_id", 1)], name="ix_api_token_tenant")
    await db.api_rate_limits.create_index([("token_id", 1), ("window_start", 1)], unique=True, name="uq_api_rate_window")
    await db.api_rate_limits.create_index("expires_at", expireAfterSeconds=0, name="ttl_api_rate")
    await db.api_audit_logs.create_index([("tenant_id", 1), ("at", -1)], name="ix_api_audit_tenant")
