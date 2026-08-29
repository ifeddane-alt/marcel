"""Non-régression SSRF : tous les chemins sortants des connecteurs utilisent le client
durci (IP-pinning + anti-rebinding + pas de redirection). Couvre SEC-001 (SAP test path)."""
import asyncio
import inspect

import pytest

from core.ssrf import hardened_async_client, validate_public_url
from modules.connectors import sap, jira, servicenow


def test_no_raw_httpx_client_in_connectors():
    """Aucun connecteur ne doit instancier httpx.AsyncClient(...) directement."""
    offenders = []
    for mod in (sap, jira, servicenow):
        src = inspect.getsource(mod)
        # tolère les annotations de type "client: httpx.AsyncClient" (pas d'appel)
        for line in src.splitlines():
            stripped = line.strip()
            if "httpx.AsyncClient(" in stripped:
                offenders.append(f"{mod.__name__}: {stripped}")
    assert not offenders, f"Client httpx brut (non durci) détecté: {offenders}"


def test_sap_test_connection_uses_hardened_client():
    src = inspect.getsource(sap.test_connection)
    assert "hardened_async_client(" in src, "SAP test_connection doit utiliser le client durci"
    assert "httpx.AsyncClient(" not in src, "SAP test_connection ne doit pas utiliser un client brut"


@pytest.mark.parametrize("bad_url", [
    "http://169.254.169.254/latest/meta-data/",
    "http://127.0.0.1:8000/",
    "http://10.0.0.5/",
    "http://[::1]/",
])
def test_validate_public_url_blocks_internal(bad_url):
    with pytest.raises(Exception):
        validate_public_url(bad_url)


def test_hardened_client_no_redirects():
    async def _run():
        client = hardened_async_client(timeout=5)
        try:
            assert client.follow_redirects is False
        finally:
            await client.aclose()
    asyncio.run(_run())
