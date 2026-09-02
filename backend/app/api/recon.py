from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Query, Request, status

from app.api.common import query_items, visible_items, visible_record
from app.api.deps import AppSettings, CurrentUser, Repositories, ensure_workspace_access
from app.scanners.mock import ADAPTERS
from app.schemas.requests import ReconJobCreate
from app.services.audit import audit
from app.utils.errors import conflict
from app.utils.scope import require_scannable_target


router = APIRouter(prefix="/api/recon", tags=["recon"])


@router.get("/overview")
def overview(repositories: Repositories, user: CurrentUser) -> dict[str, object]:
    jobs = visible_items(repositories["recon_jobs"], user)
    return {
        "adapters": [
            {"module": module, "adapter": adapter.slug, "description": adapter.description, "mode": "mock"}
            for module, adapter in ADAPTERS.items()
        ],
        "counts": {
            "total": len(jobs),
            "running": sum(1 for job in jobs if job.status == "running"),
            "completed": sum(1 for job in jobs if job.status == "completed"),
        },
        "authorizationNotice": "Recon is restricted to verified, explicitly in-scope targets.",
    }


@router.post("/jobs", status_code=status.HTTP_202_ACCEPTED)
def create_recon_job(
    payload: ReconJobCreate,
    request: Request,
    repositories: Repositories,
    settings: AppSettings,
    user: CurrentUser,
) -> object:
    ensure_workspace_access(user, payload.workspace_id)
    target = visible_record(repositories["targets"], payload.target_id, user, "Target")
    if target.workspace_id != payload.workspace_id:
        raise conflict("Target does not belong to the requested workspace")
    invalid = set(payload.modules) - set(ADAPTERS)
    if invalid:
        raise conflict(f"Unsupported recon module(s): {', '.join(sorted(invalid))}")
    require_scannable_target(
        target, start_url=str(payload.start_url) if payload.start_url else None, cloud_mode=settings.cloud_mode
    )
    job = repositories["recon_jobs"].create(
        {
            "workspaceId": payload.workspace_id,
            "targetId": target.id,
            "name": payload.name,
            "modules": payload.modules,
            "status": "queued",
            "progress": 0,
            "startUrl": str(payload.start_url) if payload.start_url else str(target.base_url),
            "statistics": {},
            "logs": ["Authorized scope accepted; waiting for safe mock worker."],
            "createdBy": user.id,
        }
    )
    audit(
        repositories,
        "recon.start",
        "recon_job",
        actor=user,
        resource_id=job.id,
        workspace_id=job.workspace_id,
        details={"modules": payload.modules, "mode": "mock", "authorizationAcknowledged": True},
    )
    request.app.state.job_runner.start_recon(job.id)
    return job


@router.get("/jobs")
def list_recon_jobs(
    repositories: Repositories,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, alias="pageSize", ge=1, le=200),
    status_filter: str | None = Query(default=None, alias="status"),
    target_id: str | None = Query(default=None, alias="targetId"),
) -> dict[str, object]:
    items = visible_items(repositories["recon_jobs"], user)
    if status_filter:
        items = [item for item in items if item.status == status_filter]
    if target_id:
        items = [item for item in items if item.target_id == target_id]
    return query_items(
        repositories["recon_jobs"], items, page=page, page_size=page_size, sort_by="createdAt", sort_order="desc"
    )


@router.get("/jobs/{job_id}")
def get_recon_job(job_id: str, repositories: Repositories, user: CurrentUser) -> object:
    return visible_record(repositories["recon_jobs"], job_id, user, "Recon job")


@router.post("/jobs/{job_id}/cancel")
def cancel_recon_job(job_id: str, repositories: Repositories, user: CurrentUser) -> object:
    job = visible_record(repositories["recon_jobs"], job_id, user, "Recon job")
    if job.status not in {"queued", "running"}:
        raise conflict(f"Cannot cancel a recon job in {job.status} state")
    updated = repositories["recon_jobs"].update(
        job.id, {"status": "cancelled", "completedAt": datetime.now(timezone.utc)}
    )
    audit(repositories, "recon.cancel", "recon_job", actor=user, resource_id=job.id, workspace_id=job.workspace_id)
    return updated
