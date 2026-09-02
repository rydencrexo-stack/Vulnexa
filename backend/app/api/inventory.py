from __future__ import annotations

from fastapi import APIRouter, Query

from app.api.common import contains_search, query_items, visible_items, visible_record
from app.api.deps import CurrentUser, Repositories


assets_router = APIRouter(prefix="/api/assets", tags=["assets"])
endpoints_router = APIRouter(prefix="/api/endpoints", tags=["endpoints"])


@assets_router.get("")
def list_assets(
    repositories: Repositories,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, alias="pageSize", ge=1, le=200),
    target_id: str | None = Query(default=None, alias="targetId"),
    risk: str | None = None,
    technology: str | None = None,
    search: str | None = Query(default=None, max_length=120),
    sort_by: str = Query("lastSeen", alias="sortBy"),
    sort_order: str = Query("desc", alias="sortOrder", pattern=r"^(asc|desc)$"),
) -> dict[str, object]:
    items = visible_items(repositories["assets"], user)
    if target_id:
        items = [item for item in items if item.target_id == target_id]
    if risk:
        items = [item for item in items if item.risk_state == risk]
    if technology:
        items = [item for item in items if technology.casefold() in {value.casefold() for value in item.technologies}]
    if search:
        items = [item for item in items if contains_search(item, search, ("hostname", "domain", "ip", "page_title"))]
    return query_items(
        repositories["assets"], items, page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )


@assets_router.get("/{asset_id}")
def get_asset(asset_id: str, repositories: Repositories, user: CurrentUser) -> dict[str, object]:
    asset = visible_record(repositories["assets"], asset_id, user, "Asset")
    return {
        **asset.model_dump(mode="json", by_alias=True),
        "endpoints": repositories["endpoints"].filter(asset_id=asset.id),
        "findings": repositories["findings"].filter(asset_id=asset.id),
    }


@endpoints_router.get("")
def list_endpoints(
    repositories: Repositories,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, alias="pageSize", ge=1, le=200),
    target_id: str | None = Query(default=None, alias="targetId"),
    asset_id: str | None = Query(default=None, alias="assetId"),
    kind: str | None = None,
    method: str | None = None,
    search: str | None = Query(default=None, max_length=120),
    sort_by: str = Query("lastSeen", alias="sortBy"),
    sort_order: str = Query("desc", alias="sortOrder", pattern=r"^(asc|desc)$"),
) -> dict[str, object]:
    items = visible_items(repositories["endpoints"], user)
    if target_id:
        items = [item for item in items if item.target_id == target_id]
    if asset_id:
        items = [item for item in items if item.asset_id == asset_id]
    if kind:
        items = [item for item in items if item.kind == kind]
    if method:
        items = [item for item in items if item.method == method.upper()]
    if search:
        items = [item for item in items if contains_search(item, search, ("url", "normalized_path"))]
    return query_items(
        repositories["endpoints"], items, page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )


@endpoints_router.get("/{endpoint_id}")
def get_endpoint(endpoint_id: str, repositories: Repositories, user: CurrentUser) -> dict[str, object]:
    endpoint = visible_record(repositories["endpoints"], endpoint_id, user, "Endpoint")
    return {
        **endpoint.model_dump(mode="json", by_alias=True),
        "findings": repositories["findings"].filter(endpoint_id=endpoint.id),
    }

