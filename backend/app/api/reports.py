from __future__ import annotations

from fastapi import APIRouter, Query, Request, status
from fastapi.responses import FileResponse

from app.api.common import query_items, visible_items, visible_record
from app.api.deps import CurrentUser, Repositories, ensure_workspace_access
from app.schemas.requests import ReportCreate
from app.services.audit import audit
from app.utils.errors import AppError, conflict, not_found


router = APIRouter(prefix="/api/reports", tags=["reports"])
MEDIA_TYPES = {
    "html": "text/html; charset=utf-8",
    "json": "application/json",
    "csv": "text/csv; charset=utf-8",
    "pdf": "application/pdf",
}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_report(
    payload: ReportCreate,
    request: Request,
    repositories: Repositories,
    user: CurrentUser,
) -> object:
    ensure_workspace_access(user, payload.workspace_id)
    target = None
    scan = None
    if payload.target_id:
        target = visible_record(repositories["targets"], payload.target_id, user, "Target")
        if target.workspace_id != payload.workspace_id:
            raise conflict("Target does not belong to the requested workspace")
    if payload.scan_id:
        scan = visible_record(repositories["scans"], payload.scan_id, user, "Scan")
        if scan.workspace_id != payload.workspace_id:
            raise conflict("Scan does not belong to the requested workspace")
        if target is not None and scan.target_id != target.id:
            raise conflict("Scan does not belong to the requested target")
        if target is None:
            target = visible_record(repositories["targets"], scan.target_id, user, "Target")
    report = repositories["reports"].create(
        {
            "workspaceId": payload.workspace_id,
            "targetId": target.id if target else None,
            "scanId": payload.scan_id,
            "name": payload.name,
            "type": payload.type,
            "status": "generating",
            "formats": payload.formats,
            "files": {},
            "summary": {},
            "generatedBy": user.id,
        }
    )
    try:
        report = request.app.state.report_service.generate(report)
    except Exception as exc:
        repositories["reports"].update(report.id, {"status": "failed", "error": f"Report generation failed: {type(exc).__name__}"})
        raise AppError(500, "report_generation_failed", "Report generation failed") from exc
    audit(repositories, "report.generate", "report", actor=user, resource_id=report.id, workspace_id=report.workspace_id)
    return report


@router.get("")
def list_reports(
    repositories: Repositories,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, alias="pageSize", ge=1, le=200),
    report_type: str | None = Query(default=None, alias="type"),
) -> dict[str, object]:
    items = visible_items(repositories["reports"], user)
    if report_type:
        items = [item for item in items if item.type == report_type]
    return query_items(repositories["reports"], items, page=page, page_size=page_size, sort_by="createdAt", sort_order="desc")


@router.get("/{report_id}")
def get_report(report_id: str, repositories: Repositories, user: CurrentUser) -> object:
    return visible_record(repositories["reports"], report_id, user, "Report")


@router.get("/{report_id}/download")
def download_report(
    report_id: str,
    request: Request,
    repositories: Repositories,
    user: CurrentUser,
    output_format: str = Query("pdf", alias="format", pattern=r"^(html|json|csv|pdf)$"),
) -> FileResponse:
    report = visible_record(repositories["reports"], report_id, user, "Report")
    path = request.app.state.report_service.resolve_download(report, output_format)
    if path is None:
        raise not_found("Report export")
    return FileResponse(
        path,
        media_type=MEDIA_TYPES[output_format],
        filename=f"{report.name}.{output_format}",
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )
