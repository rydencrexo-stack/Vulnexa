from __future__ import annotations

import secrets
from urllib.parse import urlsplit

from fastapi import APIRouter, Query, status

from app.api.common import contains_search, query_items, visible_items, visible_record
from app.api.deps import AppSettings, CurrentUser, Repositories, ensure_workspace_access
from app.schemas.requests import TargetCreate, TargetUpdate, TargetVerify
from app.services.audit import audit
from app.utils.errors import AppError, conflict, unsafe
from app.utils.scope import ensure_scope_consistent, evaluate_url_scope, validate_target_url


router = APIRouter(prefix="/api/targets", tags=["targets"])


def _enrich(target: object, repositories: object) -> dict[str, object]:
    data = target.model_dump(mode="json", by_alias=True)
    target_id = target.id
    data["counts"] = {
        "assets": len(repositories["assets"].filter(target_id=target_id)),
        "endpoints": len(repositories["endpoints"].filter(target_id=target_id)),
        "findings": len(repositories["findings"].filter(target_id=target_id)),
    }
    return data


@router.get("")
def list_targets(
    repositories: Repositories,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, alias="pageSize", ge=1, le=200),
    search: str | None = Query(default=None, max_length=120),
    verification: str | None = None,
    environment: str | None = None,
    sort_by: str = Query("createdAt", alias="sortBy"),
    sort_order: str = Query("desc", alias="sortOrder", pattern=r"^(asc|desc)$"),
) -> dict[str, object]:
    items = visible_items(repositories["targets"], user)
    if search:
        items = [item for item in items if contains_search(item, search, ("name", "domain"))]
    if verification:
        items = [item for item in items if item.verification.status == verification]
    if environment:
        items = [item for item in items if item.environment == environment]
    result = query_items(
        repositories["targets"], items, page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )
    result["items"] = [_enrich(item, repositories) for item in result["items"]]
    return result


@router.post("", status_code=status.HTTP_201_CREATED)
def create_target(payload: TargetCreate, repositories: Repositories, settings: AppSettings, user: CurrentUser) -> object:
    ensure_workspace_access(user, payload.workspace_id)
    _, host, _ = validate_target_url(str(payload.base_url), cloud_mode=settings.cloud_mode)
    domain = (payload.domain or host).lower().rstrip(".")
    if host != domain and not host.endswith("." + domain):
        raise unsafe("The target URL hostname must equal or be a subdomain of the declared domain")
    scope = payload.scope or {"includedHosts": [host], "includedPaths": ["/*"], "allowedPorts": [80, 443]}
    from app.models.domain import TargetScope

    validated_scope = scope if isinstance(scope, TargetScope) else TargetScope.model_validate(scope)
    ensure_scope_consistent(domain, validated_scope)
    if any(target.workspace_id == payload.workspace_id and target.domain == domain for target in repositories["targets"].get_all()):
        raise conflict("This domain is already registered in the workspace")
    challenge = f"pan-verification={secrets.token_urlsafe(18)}"
    target = repositories["targets"].create(
        {
            "workspaceId": payload.workspace_id,
            "name": payload.name.strip(),
            "baseUrl": str(payload.base_url),
            "domain": domain,
            "environment": payload.environment,
            "verification": {
                "status": "pending",
                "method": payload.verification_method,
                "challenge": challenge,
            },
            "scope": validated_scope.model_dump(mode="json", by_alias=True),
            "scanProfile": payload.scan_profile,
            "createdBy": user.id,
            "risk": "unknown",
        }
    )
    audit(
        repositories,
        "target.create",
        "target",
        actor=user,
        resource_id=target.id,
        workspace_id=target.workspace_id,
        details={"authorizationAcknowledged": True, "domain": domain},
    )
    return target


@router.get("/{target_id}")
def get_target(target_id: str, repositories: Repositories, user: CurrentUser) -> dict[str, object]:
    target = visible_record(repositories["targets"], target_id, user, "Target")
    return _enrich(target, repositories)


@router.patch("/{target_id}")
def update_target(payload: TargetUpdate, target_id: str, repositories: Repositories, user: CurrentUser) -> object:
    target = visible_record(repositories["targets"], target_id, user, "Target")
    changes = payload.model_dump(mode="json", by_alias=True, exclude_unset=True)
    if payload.scope is not None:
        ensure_scope_consistent(target.domain, payload.scope)
    updated = repositories["targets"].update(target.id, changes)
    audit(repositories, "target.update", "target", actor=user, resource_id=target.id, workspace_id=target.workspace_id)
    return updated


@router.delete("/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_target(target_id: str, repositories: Repositories, user: CurrentUser) -> None:
    target = visible_record(repositories["targets"], target_id, user, "Target")
    active = [
        scan for scan in repositories["scans"].filter(target_id=target.id) if scan.status in {"queued", "running", "paused"}
    ]
    active += [
        job for job in repositories["recon_jobs"].filter(target_id=target.id) if job.status in {"queued", "running"}
    ]
    if active:
        raise conflict("Cancel active jobs before deleting this target")
    repositories["targets"].delete(target.id)
    audit(repositories, "target.delete", "target", actor=user, resource_id=target.id, workspace_id=target.workspace_id)
    return None


@router.post("/{target_id}/verify")
def verify_target(
    payload: TargetVerify,
    target_id: str,
    repositories: Repositories,
    settings: AppSettings,
    user: CurrentUser,
) -> object:
    target = visible_record(repositories["targets"], target_id, user, "Target")
    if payload.method == "mock":
        if not settings.scanner_mock_mode:
            raise AppError(422, "verification_required", "Mock verification is disabled outside scanner mock mode")
    else:
        challenge = target.verification.challenge
        if (
            payload.method != target.verification.method
            or not challenge
            or not payload.proof
            or not secrets.compare_digest(payload.proof, challenge)
        ):
            raise AppError(
                422,
                "verification_failed",
                "The verification method or simulated proof does not match the target challenge",
            )
    updated = repositories["targets"].update(
        target.id,
        {
            "verification": {
                "status": "verified",
                "method": payload.method,
                "challenge": None,
                "verifiedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
            }
        },
    )
    audit(
        repositories,
        "target.verify",
        "target",
        actor=user,
        resource_id=target.id,
        workspace_id=target.workspace_id,
        details={"method": payload.method, "authorizationAcknowledged": True},
    )
    return updated


@router.get("/{target_id}/scope-check")
def check_scope(
    target_id: str,
    repositories: Repositories,
    settings: AppSettings,
    user: CurrentUser,
    url: str = Query(min_length=8, max_length=2048),
) -> dict[str, object]:
    target = visible_record(repositories["targets"], target_id, user, "Target")
    decision = evaluate_url_scope(target, url, cloud_mode=settings.cloud_mode)
    return {"allowed": decision.allowed, "reason": decision.reason, "url": url}
