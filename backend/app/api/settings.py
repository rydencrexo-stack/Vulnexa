from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import AppSettings, CurrentUser, Repositories, ensure_workspace_access
from app.schemas.requests import SettingsUpdate
from app.services.audit import audit


router = APIRouter(prefix="/api/settings", tags=["settings"])
ALLOWED_CATEGORIES = {
    "general",
    "workspace",
    "scan-settings",
    "ai-provider",
    "notifications",
    "data-retention",
}


@router.get("/capabilities")
def capabilities(settings: AppSettings, user: CurrentUser) -> dict[str, object]:
    return {
        "scannerMockMode": settings.scanner_mock_mode,
        "cloudMode": settings.cloud_mode,
        "maxRequestLimit": settings.max_request_limit,
        "maxConcurrency": settings.max_concurrency,
        "ai": {"provider": settings.ai_provider, "model": settings.ai_model, "configured": bool(settings.ai_api_key)},
        "acunetix": {"configured": bool(settings.acunetix_base_url and settings.acunetix_api_key)},
        "secretsPolicy": "Provider keys and credentials are environment-only and never returned by the API.",
    }


@router.get("/{workspace_id}/{category}")
def get_settings(workspace_id: str, category: str, repositories: Repositories, user: CurrentUser) -> dict[str, object]:
    ensure_workspace_access(user, workspace_id)
    if category not in ALLOWED_CATEGORIES:
        from app.utils.errors import not_found

        raise not_found("Settings category")
    record = next(
        (item for item in repositories["settings"].filter(workspace_id=workspace_id) if item.category == category), None
    )
    return {"workspaceId": workspace_id, "category": category, "values": record.values if record else {}}


@router.put("/{workspace_id}/{category}")
def update_settings(
    payload: SettingsUpdate, workspace_id: str, category: str, repositories: Repositories, user: CurrentUser
) -> object:
    ensure_workspace_access(user, workspace_id)
    if category not in ALLOWED_CATEGORIES:
        from app.utils.errors import not_found

        raise not_found("Settings category")
    record = next(
        (item for item in repositories["settings"].filter(workspace_id=workspace_id) if item.category == category), None
    )
    if record:
        record = repositories["settings"].update(record.id, {"values": payload.values, "updatedBy": user.id})
    else:
        record = repositories["settings"].create(
            {"workspaceId": workspace_id, "category": category, "values": payload.values, "updatedBy": user.id}
        )
    audit(repositories, "settings.update", "settings", actor=user, resource_id=record.id, workspace_id=workspace_id, details={"category": category})
    return record

