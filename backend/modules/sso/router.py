from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel

from . import service

router = APIRouter(tags=["sso"])


class ExchangeRequest(BaseModel):
    code: str


def _error_redirect(detail: str) -> RedirectResponse:
    return RedirectResponse(f"/login?sso_error={quote(detail[:200])}", status_code=302)


@router.get("/auth/sso/providers")
async def sso_providers(email: str):
    try:
        return {"providers": await service.enabled_providers(email)}
    except HTTPException:
        return {"providers": []}


@router.get("/auth/sso/login/{provider}")
async def sso_login(provider: str, email: str, request: Request):
    try:
        if provider in ("google", "entra"):
            url = await service.oidc_login_url(provider, email, service.base_url_of(request))
        elif provider == "saml":
            url = await service.saml_login_url(email, request)
        else:
            raise HTTPException(400, "Fournisseur SSO inconnu")
        return RedirectResponse(url, status_code=302)
    except HTTPException as e:
        return _error_redirect(str(e.detail))


@router.get("/auth/sso/callback/{provider}")
async def sso_callback(provider: str, request: Request):
    qp = request.query_params
    if qp.get("error"):
        return _error_redirect(qp.get("error_description") or qp["error"])
    code, state = qp.get("code"), qp.get("state")
    if not code or not state:
        return _error_redirect("Réponse du fournisseur d'identité incomplète")
    try:
        ticket = await service.oidc_callback(provider, code, state, service.base_url_of(request))
        return RedirectResponse(f"/login?sso={ticket}", status_code=302)
    except HTTPException as e:
        return _error_redirect(str(e.detail))


@router.post("/auth/sso/saml/acs/{tenant_id}")
async def sso_saml_acs(tenant_id: str, request: Request):
    form = dict(await request.form())
    try:
        ticket = await service.saml_acs(tenant_id, request, form)
        return RedirectResponse(f"/login?sso={ticket}", status_code=303)
    except HTTPException as e:
        return _error_redirect(str(e.detail))


@router.get("/auth/sso/saml/metadata/{tenant_id}")
async def sso_saml_metadata(tenant_id: str, request: Request):
    xml = await service.saml_metadata(tenant_id, request)
    return Response(content=xml, media_type="application/xml")


@router.post("/auth/sso/exchange")
async def sso_exchange(data: ExchangeRequest):
    return await service.exchange_ticket(data.code)
