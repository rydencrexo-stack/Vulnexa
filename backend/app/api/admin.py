from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Query, Request

from app.api.common import contains_search, query_items
from app.api.deps import AdminUser, Repositories
from app.schemas.requests import AdminUserUpdate, ScannerToolUpdate
from app.services.audit import audit
from app.utils.errors import conflict, not_found
from app.utils.sanitize import public_user


router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/overview")
def admin_overview(request: Request, repositories: Repositories, user: AdminUser) -> dict[str, object]:
    users = repositories["users"].get_all()
    scans = repositories["scans"].get_all()
    workers = repositories["scan_workers"].get_all()
    audit_logs = sorted(repositories["audit_logs"].get_all(), key=lambda item: item.created_at, reverse=True)
    reports_bytes = sum(
        path.stat().st_size for path in request.app.state.settings.report_directory.glob("*") if path.is_file()
    )
    data_bytes = sum(path.stat().st_size for path in request.app.state.settings.data_directory.glob("*.json") if path.is_file())
    failed_auth = sum(
        1
        for entry in audit_logs
        if entry.action == "auth.login" and entry.outcome == "failure" and (datetime.now(timezone.utc) - entry.created_at).days < 1
    )
    return {
        "totalUsers": len(users),
        "organizations": len(repositories["organizations"].get_all()),
        "runningScans": sum(1 for scan in scans if scan.status == "running"),
        "queueSize": sum(1 for scan in scans if scan.status == "queued"),
        "healthyWorkers": sum(1 for worker in workers if worker.status == "healthy"),
        "failedWorkers": sum(1 for worker in workers if worker.status == "failed"),
        "storageUsageBytes": reports_bytes + data_bytes,
        "aiUsage": {"conversations": len(repositories["ai_conversations"].get_all()), "tokens": None},
        "acunetixConnection": request.app.state.acunetix.status(),
        "abuseAlerts": failed_auth,
        "recentAuditEvents": audit_logs[:10],
    }


@router.get("/users")
def list_users(
    repositories: Repositories,
    user: AdminUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, alias="pageSize", ge=1, le=200),
    search: str | None = Query(default=None, max_length=120),
    role: str | None = None,
) -> dict[str, object]:
    items = repositories["users"].get_all()
    if search:
        items = [item for item in items if contains_search(item, search, ("email", "full_name"))]
    if role:
        items = [item for item in items if item.role == role]
    result = query_items(repositories["users"], items, page=page, page_size=page_size, sort_by="createdAt", sort_order="desc")
    result["items"] = [public_user(item) for item in result["items"]]
    return result


@router.get("/users/{user_id}")
def get_user(user_id: str, repositories: Repositories, user: AdminUser) -> dict[str, object]:
    found = repositories["users"].get_by_id(user_id)
    if found is None:
        raise not_found("User")
    return public_user(found)


@router.patch("/users/{user_id}")
def update_user(payload: AdminUserUpdate, user_id: str, repositories: Repositories, user: AdminUser) -> dict[str, object]:
    found = repositories["users"].get_by_id(user_id)
    if found is None:
        raise not_found("User")
    changes = payload.model_dump(mode="json", by_alias=True, exclude_unset=True)
    if found.id == user.id and changes.get("status") == "disabled":
        raise conflict("Administrators cannot disable their current account")
    updated = repositories["users"].update(found.id, changes)
    audit(repositories, "admin.user_update", "user", actor=user, resource_id=found.id, details=changes)
    return public_user(updated)


def _admin_collection(
    name: str,
    repositories: object,
    *,
    page: int,
    page_size: int,
    sort_by: str = "createdAt",
    sort_order: str = "desc",
) -> dict[str, object]:
    return query_items(
        repositories[name],
        repositories[name].get_all(),
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/organizations")
def organizations(
    repositories: Repositories,
    user: AdminUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    return _admin_collection("organizations", repositories, page=page, page_size=page_size)


@router.get("/organizations/{organization_id}")
def organization_detail(organization_id: str, repositories: Repositories, user: AdminUser) -> dict[str, object]:
    organization = repositories["organizations"].get_by_id(organization_id)
    if organization is None:
        raise not_found("Organization")
    return {
        **organization.model_dump(mode="json", by_alias=True),
        "workspaces": repositories["workspaces"].filter(organization_id=organization.id),
        "users": [public_user(item) for item in repositories["users"].filter(organization_id=organization.id)],
    }


@router.get("/plans")
def plans(
    repositories: Repositories,
    user: AdminUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    return _admin_collection("plans", repositories, page=page, page_size=page_size)


@router.get("/scan-workers")
def scan_workers(
    repositories: Repositories,
    user: AdminUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    return _admin_collection("scan_workers", repositories, page=page, page_size=page_size, sort_by="lastHeartbeatAt")


@router.get("/scanner-tools")
def scanner_tools(
    repositories: Repositories,
    user: AdminUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    return _admin_collection("scanner_tools", repositories, page=page, page_size=page_size, sort_by="name", sort_order="asc")


@router.patch("/scanner-tools/{tool_id}")
def update_scanner_tool(
    payload: ScannerToolUpdate, tool_id: str, repositories: Repositories, user: AdminUser
) -> object:
    tool = repositories["scanner_tools"].get_by_id(tool_id)
    if tool is None:
        raise not_found("Scanner tool")
    changes = payload.model_dump(mode="json", by_alias=True, exclude_unset=True)
    updated = repositories["scanner_tools"].update(tool.id, changes)
    audit(repositories, "admin.scanner_tool_update", "scanner_tool", actor=user, resource_id=tool.id, details=changes)
    return updated


@router.get("/templates")
def templates(
    repositories: Repositories,
    user: AdminUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    return _admin_collection("templates", repositories, page=page, page_size=page_size)


@router.get("/system-health")
def system_health(request: Request, repositories: Repositories, user: AdminUser) -> dict[str, object]:
    collection_health = {}
    for name in repositories.collections:
        repository = repositories[name]
        try:
            count = len(repository.get_all())
            collection_health[name] = {"status": "healthy", "records": count, "bytes": repository.path.stat().st_size}
        except Exception as exc:
            collection_health[name] = {"status": "failed", "error": type(exc).__name__}
    return {
        "status": "healthy" if all(item["status"] == "healthy" for item in collection_health.values()) else "degraded",
        "services": {
            "api": "healthy",
            "jsonRepository": "healthy",
            "mockWorker": "healthy",
            "ai": "mock" if request.app.state.settings.ai_provider == "mock" else "configured",
            "acunetix": request.app.state.acunetix.status().mode,
        },
        "database": collection_health,
        "queues": {
            "queued": len(repositories["scans"].filter(status="queued")),
            "running": len(repositories["scans"].filter(status="running")),
        },
    }


@router.get("/abuse-monitoring")
def abuse_monitoring(repositories: Repositories, user: AdminUser) -> dict[str, object]:
    failed_logins = [
        entry for entry in repositories["audit_logs"].get_all() if entry.action == "auth.login" and entry.outcome == "failure"
    ]
    counts = Counter(entry.ip_address or "unknown" for entry in failed_logins)
    alerts = [
        {"type": "repeated_failed_login", "source": source, "count": count, "status": "review"}
        for source, count in counts.items()
        if count >= 3
    ]
    return {"alerts": alerts, "blockedTargets": [], "suspiciousUsers": [], "automaticBlocking": False}


@router.get("/audit-logs")
def audit_logs(
    repositories: Repositories,
    user: AdminUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, alias="pageSize", ge=1, le=200),
    action: str | None = None,
    outcome: str | None = None,
) -> dict[str, object]:
    items = repositories["audit_logs"].get_all()
    if action:
        items = [item for item in items if item.action == action]
    if outcome:
        items = [item for item in items if item.outcome == outcome]
    return query_items(
        repositories["audit_logs"], items, page=page, page_size=page_size, sort_by="createdAt", sort_order="desc"
    )
