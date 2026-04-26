"""
conftest.py — fixtures partagées pour tous les tests Projetenne.
"""
import asyncio
import pytest
import pytest_asyncio
import httpx
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8001")

CREDENTIALS = {
    "admin":   {"email": "admin@altair.fr",   "password": "Admin2026!"},
    "pmo":     {"email": "pmo@altair.fr",      "password": "Pmo1234!"},
    "cp":      {"email": "cp@altair.fr",       "password": "Altair2026!"},
    "manager": {"email": "manager@altair.fr",  "password": "Altair2026!"},
    "viewer":  {"email": "viewer@altair.fr",   "password": "View1234!"},
    "user":    {"email": "user@altair.fr",     "password": "Altair2026!"},
    "achats":  {"email": "achats@altair.fr",   "password": "Altair2026!"},
    "beta":    {"email": "admin@betacorp.fr",  "password": "Beta2026!"},
}


@pytest_asyncio.fixture
async def client():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as c:
        yield c


async def _login(client: httpx.AsyncClient, role: str) -> str:
    creds = CREDENTIALS[role]
    resp = await client.post("/api/auth/login", json=creds)
    assert resp.status_code == 200, f"Login failed for {role}: {resp.text}"
    return resp.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def admin_token(client):
    return await _login(client, "admin")


@pytest_asyncio.fixture
async def pmo_token(client):
    return await _login(client, "pmo")


@pytest_asyncio.fixture
async def cp_token(client):
    return await _login(client, "cp")


@pytest_asyncio.fixture
async def viewer_token(client):
    return await _login(client, "viewer")


@pytest_asyncio.fixture
async def beta_token(client):
    return await _login(client, "beta")
