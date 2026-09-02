from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Request, status
from fastapi.responses import Response

from app.api.common import visible_record
from app.api.deps import AppSettings, CurrentUser, Repositories, ensure_workspace_access
from app.schemas.requests import ActiveScanCreate
from app.services.audit import audit
from app.utils.errors import conflict
from app.utils.scope import require_scannable_target


router = APIRouter(prefix="/api/active-scanner", tags=["active-scanner"])


@router.get("/status")
def adapter_status(request: Request, user: CurrentUser) -> object:
    return request.app.state.acunetix.status()


@router.post("/test-connection")
def test_connection(request: Request, user: CurrentUser) -> object:
    return request.app.state.acunetix.test_connection()


@router.get("/targets")
def active_targets(request: Request, user: CurrentUser) -> list[dict[str, object]]:
    return request.app.state.acunetix.get_targets()


@router.post("/sync-targets")
def sync_targets(request: Request, repositories: Repositories, user: CurrentUser) -> dict[str, object]:
    targets = [
        target
        for target in repositories["targets"].get_all()
        if (user.role == "admin" or target.workspace_id in user.workspace_ids) and target.verification.status == "verified"
    ]
    result = request.app.state.acunetix.synchronize_targets(
        [{"id": target.id, "address": str(target.base_url), "description": target.name} for target in targets]
    )
    audit(repositories, "acunetix.sync_targets", "integration", actor=user, details={"count": len(targets), "mode": result.get("mode")})
    return result


@router.post("/scans", status_code=status.HTTP_202_ACCEPTED)
def start_active_scan(
    payload: ActiveScanCreate,
    request: Request,
    repositories: Repositories,
    settings: AppSettings,
    user: CurrentUser,
) -> object:
    ensure_workspace_access(user, payload.workspace_id)
    target = visible_record(repositories["targets"], payload.target_id, user, "Target")
    if target.workspace_id != payload.workspace_id:
        raise conflict("Target does not belong to the requested workspace")
    require_scannable_target(target, cloud_mode=settings.cloud_mode)
    adapter_state = request.app.state.acunetix.status()
    external = request.app.state.acunetix.start_scan(
        {"id": target.id, "address": str(target.base_url), "name": target.name}, payload.profile
    )
    scan = repositories["scans"].create(
        {
            "workspaceId": target.workspace_id,
            "targetId": target.id,
            "name": payload.name,
            "profile": payload.profile,
            "modules": ["acunetix"],
            "speed": "balanced",
            "requestLimit": 1000,
            "concurrency": 2,
            "status": external.get("status", "queued"),
            "progress": external.get("progress", 0),
            "currentPhase": "active_testing",
            "statistics": {},
            "warnings": [
                "Acunetix mock mode is active; no external target requests were sent."
                if adapter_state.mode == "mock"
                else "Acunetix execution is controlled by the configured integration adapter."
            ],
            "createdBy": user.id,
            "startedAt": datetime.now(timezone.utc),
            "externalReference": {"provider": "acunetix", "id": external["id"], "mode": adapter_state.mode},
        }
    )
    audit(
        repositories,
        "acunetix.scan_start",
        "scan",
        actor=user,
        resource_id=scan.id,
        workspace_id=scan.workspace_id,
        details={"mode": adapter_state.mode, "authorizationAcknowledged": True},
    )
    return scan


@router.get("/vulnerabilities")
def live_vulnerabilities(request: Request, user: CurrentUser) -> list[dict[str, object]]:
    """Live vulnerability feed pulled directly from the Acunetix instance."""
    return request.app.state.acunetix.get_live_vulnerabilities(limit=12)


@router.get("/scans")
def list_active_scans(request: Request, repositories: Repositories, user: CurrentUser) -> list[dict[str, object]]:
    """All scans with an Acunetix external reference, enriched with live provider status."""
    from app.utils.errors import AppError

    items = []
    for scan in repositories["scans"].get_all():
        reference = scan.external_reference or {}
        if reference.get("provider") != "acunetix":
            continue
        if user.role != "admin" and scan.workspace_id not in user.workspace_ids:
            continue
        item = scan.model_dump(mode="json", by_alias=True)
        try:
            item["providerStatus"] = request.app.state.acunetix.get_scan_status(str(reference["id"]))
        except AppError:
            item["providerStatus"] = None
        items.append(item)
    return items


@router.get("/scans/{scan_id}")
def get_active_scan(
    scan_id: str, request: Request, repositories: Repositories, user: CurrentUser
) -> dict[str, object]:
    scan = visible_record(repositories["scans"], scan_id, user, "Active scan")
    if not scan.external_reference or scan.external_reference.get("provider") != "acunetix":
        raise conflict("This scan was not created by the Acunetix module")
    external = request.app.state.acunetix.get_scan_status(scan.external_reference["id"])
    return {**scan.model_dump(mode="json", by_alias=True), "providerStatus": external}


@router.post("/scans/{scan_id}/stop")
def stop_active_scan(
    scan_id: str, request: Request, repositories: Repositories, user: CurrentUser
) -> object:
    scan = visible_record(repositories["scans"], scan_id, user, "Active scan")
    if not scan.external_reference or scan.external_reference.get("provider") != "acunetix":
        raise conflict("This scan was not created by the Acunetix module")
    request.app.state.acunetix.stop_scan(scan.external_reference["id"])
    updated = repositories["scans"].update(
        scan.id, {"status": "cancelled", "completedAt": datetime.now(timezone.utc)}
    )
    audit(repositories, "acunetix.scan_stop", "scan", actor=user, resource_id=scan.id, workspace_id=scan.workspace_id)
    return updated


@router.post("/scans/{scan_id}/sync-findings")
def sync_active_findings(
    scan_id: str, request: Request, repositories: Repositories, user: CurrentUser
) -> dict[str, object]:
    scan = visible_record(repositories["scans"], scan_id, user, "Active scan")
    if not scan.external_reference or scan.external_reference.get("provider") != "acunetix":
        raise conflict("This scan was not created by the Acunetix module")
    vulnerabilities = request.app.state.acunetix.get_vulnerabilities(scan.external_reference["id"])
    existing_refs = {
        reference
        for finding in repositories["findings"].filter(scan_id=scan.id)
        for reference in finding.evidence.references
    }
    imported = []
    for vulnerability in vulnerabilities:
        reference = str(vulnerability.get("vulnId", ""))
        if reference and reference in existing_refs:
            continue
        normalized = request.app.state.acunetix.normalize_vulnerability(
            vulnerability, {"workspaceId": scan.workspace_id, "targetId": scan.target_id, "scanId": scan.id}
        )
        imported.append(repositories["findings"].create(normalized))
    audit(
        repositories,
        "acunetix.sync_findings",
        "scan",
        actor=user,
        resource_id=scan.id,
        workspace_id=scan.workspace_id,
        details={"imported": len(imported), "confirmationPolicy": "never_auto_confirm"},
    )
    return {"imported": len(imported), "findings": imported}


@router.get("/scans/{scan_id}/reports")
def active_reports(
    scan_id: str, request: Request, repositories: Repositories, user: CurrentUser
) -> list[dict[str, object]]:
    scan = visible_record(repositories["scans"], scan_id, user, "Active scan")
    if not scan.external_reference or scan.external_reference.get("provider") != "acunetix":
        raise conflict("This scan has no Acunetix reference")
    return request.app.state.acunetix.get_reports(scan.external_reference["id"])


@router.get("/scans/{scan_id}/reports/download/{report_id}")
def download_active_report(
    scan_id: str, report_id: str, request: Request, repositories: Repositories, user: CurrentUser
) -> Response:
    """Proxy the Acunetix report artifact to the browser (credentials stay server-side)."""
    scan = visible_record(repositories["scans"], scan_id, user, "Active scan")
    if not scan.external_reference or scan.external_reference.get("provider") != "acunetix":
        raise conflict("This scan has no Acunetix reference")
    content = request.app.state.acunetix.download_report(report_id)
    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="acunetix-{report_id}.html"'},
    )
