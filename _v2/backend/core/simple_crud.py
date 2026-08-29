import uuid
from datetime import datetime, timezone
from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload, require_perm


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def require_dsi_write(user: TokenPayload, permission: str) -> None:
    """Compatibilité interne: toute écriture exige désormais une permission explicite."""
    require_perm(user, permission)


class SimpleCrud:
    """CRUD générique multi-tenant pour les référentiels DSI."""

    def __init__(self, collection: str, id_field: str, allowed: set, required: tuple = (),
                 sort_field: str = "created_at", sort_dir: int = -1, write_permission: str | None = None):
        self.coll = db[collection]
        self.id_field = id_field
        self.allowed = allowed
        self.required = required
        self.sort_field = sort_field
        self.sort_dir = sort_dir
        self.write_permission = write_permission

    def _clean(self, data: dict) -> dict:
        return {k: v for k, v in data.items() if k in self.allowed}

    async def list(self, user: TokenPayload) -> list:
        return await self.coll.find(
            {"tenant_id": user.tenant_id}, {"_id": 0}
        ).sort(self.sort_field, self.sort_dir).to_list(None)

    async def create(self, data: dict, user: TokenPayload) -> dict:
        if not self.write_permission:
            raise HTTPException(500, "Permission d’écriture non configurée")
        require_dsi_write(user, self.write_permission)
        for f in self.required:
            if not data.get(f):
                raise HTTPException(400, f"Champ requis : {f}")
        doc = {
            self.id_field: str(uuid.uuid4()),
            "tenant_id": user.tenant_id,
            **self._clean(data),
            "created_at": _now(),
        }
        await self.coll.insert_one({**doc})
        doc.pop("_id", None)
        return doc

    async def update(self, item_id: str, data: dict, user: TokenPayload) -> dict:
        if not self.write_permission:
            raise HTTPException(500, "Permission d’écriture non configurée")
        require_dsi_write(user, self.write_permission)
        res = await self.coll.update_one(
            {self.id_field: item_id, "tenant_id": user.tenant_id},
            {"$set": {**self._clean(data), "updated_at": _now()}},
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Élément introuvable")
        return await self.coll.find_one({self.id_field: item_id, "tenant_id": user.tenant_id}, {"_id": 0})

    async def delete(self, item_id: str, user: TokenPayload) -> None:
        if not self.write_permission:
            raise HTTPException(500, "Permission d’écriture non configurée")
        require_dsi_write(user, self.write_permission)
        res = await self.coll.delete_one({self.id_field: item_id, "tenant_id": user.tenant_id})
        if res.deleted_count == 0:
            raise HTTPException(404, "Élément introuvable")


async def app_names(tenant_id: str) -> dict:
    return {a["application_id"]: a["name"] for a in await db.applications.find(
        {"tenant_id": tenant_id}, {"_id": 0, "application_id": 1, "name": 1}).to_list(None)}


async def project_names(tenant_id: str) -> dict:
    return {p["project_id"]: p["name"] for p in await db.projects.find(
        {"tenant_id": tenant_id}, {"_id": 0, "project_id": 1, "name": 1}).to_list(None)}
