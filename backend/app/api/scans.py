from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Query, Request, status

from app.api.common import query_items, visible_items, visible_record
from app.api.deps import AppSettings, CurrentUser, Repositories, ensure_workspace_access
from app.schemas.requests import ScanCreate
from app.services.audit import audit
from app.services.simulation import SCAN_PHASES
from app.utils.errors import conflict
from app.utils.scope import require_scannable_target


router = APIRouter(prefix="/api/scans", tags=["scans"])
ALLOWED_MODULES = {
    "subdomains",
    "live_hosts",
    "ports",
    "url_discovery",
    "web_archive",
    "javascript",
    "technologies",
    "screenshots",
    "passive",
    "surface",
    "xss",
    "sqli",
    "api",
    "secrets",
    "misconfigurations",
    "cves",
    "ai_analysis",
}


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def create_scan(
    payload: ScanCreate,
    request: Request,
    repositories: Repositories,
    settings: AppSettings,
    user: CurrentUser,
) -> object:
    ensure_workspace_access(user, payload.workspace_id)
    target = visible_record(repositories["targets"], payload.target_id, user, "Target")
    if target.workspace_id != payload.workspace_id:
        raise conflict("Target does not belong to the requested workspace")
    invalid = set(payload.modules) - ALLOWED_MODULES
    if invalid:
        raise conflict(f"Unsupported scan module(s): {', '.join(sorted(invalid))}")
    require_scannable_target(target, cloud_mode=settings.cloud_mode)
    if payload.request_limit > settings.max_request_limit or payload.concurrency > settings.max_concurrency:
        raise conflict("Scan request or concurrency limit exceeds the platform safety maximum")
    if "sqli" in payload.modules and payload.speed == "fast" and not payload.disruptive_checks_acknowledged:
        raise conflict("Fast SQLi checks require explicit disruptive-check acknowledgement")
    scheduled = bool(payload.scheduled_at and payload.scheduled_at > datetime.now(timezone.utc))
    scan = repositories["scans"].create(
        {
            "workspaceId": payload.workspace_id,
            "targetId": target.id,
            "name": payload.name,
            "profile": payload.profile,
            "modules": payload.modules,
            "authenticationProfileId": payload.authentication_profile_id,
            "speed": payload.speed,
            "requestLimit": payload.request_limit,
            "concurrency": payload.concurrency,
            "status": "queued",
            "progress": 0,
            "currentPhase": "scope_validation",
            "statistics": {},
            "warnings": ["Mock mode: no external scanner commands or live exploitation will run."],
            "createdBy": user.id,
            "scheduledAt": payload.scheduled_at,
        }
    )
    audit(
        repositories,
        "scan.create",
        "scan",
        actor=user,
        resource_id=scan.id,
        workspace_id=scan.workspace_id,
        details={
            "modules": payload.modules,
            "requestLimit": payload.request_limit,
            "concurrency": payload.concurrency,
            "authorizationAcknowledged": True,
            "mode": "mock",
        },
    )
    if scheduled:
        request.app.state.job_runner.schedule_scan(scan.id, payload.scheduled_at)
    else:
        request.app.state.job_runner.start_scan(scan.id)
    return scan


@router.get("")
def list_scans(
    repositories: Repositories,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, alias="pageSize", ge=1, le=200),
    status_filter: str | None = Query(default=None, alias="status"),
    target_id: str | None = Query(default=None, alias="targetId"),
) -> dict[str, object]:
    items = visible_items(repositories["scans"], user)
    if status_filter:
        items = [item for item in items if item.status == status_filter]
    if target_id:
        items = [item for item in items if item.target_id == target_id]
    return query_items(repositories["scans"], items, page=page, page_size=page_size, sort_by="createdAt", sort_order="desc")


@router.get("/phases")
def scan_phases(user: CurrentUser) -> dict[str, object]:
    return {"phases": SCAN_PHASES}


@router.get("/{scan_id}")
def get_scan(scan_id: str, repositories: Repositories, user: CurrentUser) -> dict[str, object]:
    scan = visible_record(repositories["scans"], scan_id, user, "Scan")
    events = repositories["scan_events"].filter(scan_id=scan.id)
    events = sorted(events, key=lambda item: item.created_at)
    return {
        **scan.model_dump(mode="json", by_alias=True),
        "events": events[-100:],
        "findings": repositories["findings"].filter(scan_id=scan.id),
    }


@router.get("/{scan_id}/events")
def get_scan_events(scan_id: str, repositories: Repositories, user: CurrentUser) -> list[object]:
    scan = visible_record(repositories["scans"], scan_id, user, "Scan")
    return sorted(repositories["scan_events"].filter(scan_id=scan.id), key=lambda item: item.created_at)


@router.get("/{scan_id}/surface")
def get_scan_surface(scan_id: str, repositories: Repositories, settings: AppSettings, user: CurrentUser) -> dict[str, object]:
    """Fetch the stored graph result of a surface scan (persisted beside evidence)."""
    import json

    scan = visible_record(repositories["scans"], scan_id, user, "Scan")
    if "surface" not in (scan.modules or []):
        from app.utils.errors import not_found

        raise not_found("This scan is not a surface scan")
    evidence_path = settings.evidence_directory / "scans" / f"{scan.id}.json"
    surface = None
    if evidence_path.exists():
        try:
            surface = json.loads(evidence_path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            surface = None
    return {"scanId": scan.id, "status": scan.status, "surface": surface, "stored": evidence_path.exists()}


@router.post("/{scan_id}/pause")
def pause_scan(scan_id: str, repositories: Repositories, user: CurrentUser) -> object:
    scan = visible_record(repositories["scans"], scan_id, user, "Scan")
    if scan.status != "running":
        raise conflict("Only a running scan can be paused")
    updated = repositories["scans"].update(scan.id, {"status": "paused"})
    audit(repositories, "scan.pause", "scan", actor=user, resource_id=scan.id, workspace_id=scan.workspace_id)
    return updated


@router.post("/{scan_id}/resume")
def resume_scan(scan_id: str, request: Request, repositories: Repositories, user: CurrentUser) -> object:
    scan = visible_record(repositories["scans"], scan_id, user, "Scan")
    if scan.status != "paused":
        raise conflict("Only a paused scan can be resumed")
    updated = repositories["scans"].update(scan.id, {"status": "running"})
    request.app.state.job_runner.start_scan(scan.id)
    audit(repositories, "scan.resume", "scan", actor=user, resource_id=scan.id, workspace_id=scan.workspace_id)
    return updated


@router.post("/{scan_id}/cancel")
def cancel_scan(scan_id: str, repositories: Repositories, user: CurrentUser) -> object:
    scan = visible_record(repositories["scans"], scan_id, user, "Scan")
    if scan.status not in {"queued", "running", "paused"}:
        raise conflict(f"Cannot cancel a scan in {scan.status} state")
    updated = repositories["scans"].update(
        scan.id, {"status": "cancelled", "completedAt": datetime.now(timezone.utc)}
    )
    audit(repositories, "scan.cancel", "scan", actor=user, resource_id=scan.id, workspace_id=scan.workspace_id)
    return updated


@router.delete("/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scan(scan_id: str, repositories: Repositories, user: CurrentUser) -> None:
    scan = visible_record(repositories["scans"], scan_id, user, "Scan")
    if scan.status in {"queued", "running", "paused"}:
        raise conflict("Cancel the scan before deleting it")
    try:
        for event in repositories["scan_events"].filter(scan_id=scan.id):
            repositories["scan_events"].delete(event.id)
    except Exception:  # noqa: BLE001 - events are best-effort cleanup
        pass
    repositories["scans"].delete(scan.id)
    audit(repositories, "scan.delete", "scan", actor=user, resource_id=scan.id, workspace_id=scan.workspace_id)
    return None
