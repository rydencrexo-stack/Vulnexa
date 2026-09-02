from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Query, Request

from app.api.common import contains_search, query_items, visible_items, visible_record
from app.api.deps import AnalystUser, CurrentUser, Repositories
from app.schemas.requests import FindingAction, FindingUpdate, RetestRequest
from app.services.audit import audit


router = APIRouter(prefix="/api/findings", tags=["findings"])


def _timeline(actor_id: str, action: str, note: str | None) -> dict[str, object]:
    return {"timestamp": datetime.now(timezone.utc), "actorId": actor_id, "action": action, "note": note}


@router.get("")
def list_findings(
    repositories: Repositories,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, alias="pageSize", ge=1, le=200),
    severity: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    verification_state: str | None = Query(default=None, alias="verificationState"),
    target_id: str | None = Query(default=None, alias="targetId"),
    source: str | None = None,
    vulnerability_type: str | None = Query(default=None, alias="type"),
    confidence_min: int | None = Query(default=None, alias="confidenceMin", ge=0, le=100),
    search: str | None = Query(default=None, max_length=120),
) -> dict[str, object]:
    items = visible_items(repositories["findings"], user)
    if severity:
        items = [item for item in items if item.severity == severity]
    if status_filter:
        items = [item for item in items if item.status == status_filter]
    if verification_state:
        items = [item for item in items if item.verification_state == verification_state]
    if target_id:
        items = [item for item in items if item.target_id == target_id]
    if source:
        items = [item for item in items if item.source == source]
    if vulnerability_type:
        items = [item for item in items if item.type == vulnerability_type]
    if confidence_min is not None:
        items = [item for item in items if item.confidence >= confidence_min]
    if search:
        items = [item for item in items if contains_search(item, search, ("title", "type", "cwe", "parameter"))]
    return query_items(
        repositories["findings"], items, page=page, page_size=page_size, sort_by="createdAt", sort_order="desc"
    )


@router.get("/{finding_id}")
def get_finding(finding_id: str, repositories: Repositories, user: CurrentUser) -> object:
    return visible_record(repositories["findings"], finding_id, user, "Finding")


@router.patch("/{finding_id}")
def update_finding(payload: FindingUpdate, finding_id: str, repositories: Repositories, user: AnalystUser) -> object:
    finding = visible_record(repositories["findings"], finding_id, user, "Finding")
    changes = payload.model_dump(mode="json", by_alias=True, exclude_unset=True, exclude={"note"})
    timeline = list(finding.timeline)
    timeline.append(_timeline(user.id, "finding_updated", payload.note))
    changes["timeline"] = [item.model_dump(mode="json", by_alias=True) if hasattr(item, "model_dump") else item for item in timeline]
    updated = repositories["findings"].update(finding.id, changes)
    audit(repositories, "finding.update", "finding", actor=user, resource_id=finding.id, workspace_id=finding.workspace_id)
    return updated


def _analyst_transition(
    finding_id: str,
    payload: FindingAction,
    state: str,
    status: str,
    action: str,
    repositories: object,
    user: object,
) -> object:
    finding = visible_record(repositories["findings"], finding_id, user, "Finding")
    timeline = [entry.model_dump(mode="json", by_alias=True) for entry in finding.timeline]
    timeline.append(_timeline(user.id, action, payload.note))
    updated = repositories["findings"].update(
        finding.id, {"verificationState": state, "status": status, "timeline": timeline}
    )
    audit(repositories, action, "finding", actor=user, resource_id=finding.id, workspace_id=finding.workspace_id)
    return updated


@router.post("/{finding_id}/confirm")
def confirm_finding(payload: FindingAction, finding_id: str, repositories: Repositories, user: AnalystUser) -> object:
    return _analyst_transition(finding_id, payload, "confirmed", "open", "finding.confirm", repositories, user)


@router.post("/{finding_id}/false-positive")
def false_positive(payload: FindingAction, finding_id: str, repositories: Repositories, user: AnalystUser) -> object:
    return _analyst_transition(
        finding_id, payload, "false_positive", "closed", "finding.false_positive", repositories, user
    )


@router.post("/{finding_id}/accept-risk")
def accept_risk(payload: FindingAction, finding_id: str, repositories: Repositories, user: AnalystUser) -> object:
    return _analyst_transition(
        finding_id, payload, "accepted_risk", "accepted_risk", "finding.accept_risk", repositories, user
    )


@router.post("/{finding_id}/mark-fixed")
def mark_fixed(payload: FindingAction, finding_id: str, repositories: Repositories, user: AnalystUser) -> object:
    return _analyst_transition(finding_id, payload, "fixed", "closed", "finding.fixed", repositories, user)


@router.post("/{finding_id}/reopen")
def reopen_finding(payload: FindingAction, finding_id: str, repositories: Repositories, user: AnalystUser) -> object:
    return _analyst_transition(finding_id, payload, "reopened", "open", "finding.reopen", repositories, user)


@router.post("/{finding_id}/retest", status_code=202)
def retest_finding(
    payload: RetestRequest,
    finding_id: str,
    request: Request,
    repositories: Repositories,
    user: AnalystUser,
) -> object:
    finding = visible_record(repositories["findings"], finding_id, user, "Finding")
    retest_id = f"retest_{uuid.uuid4()}"
    history = [entry.model_dump(mode="json", by_alias=True) for entry in finding.retest_history]
    history.append(
        {
            "id": retest_id,
            "requestedAt": datetime.now(timezone.utc),
            "requestedBy": user.id,
            "status": "queued",
            "outcome": None,
        }
    )
    timeline = [entry.model_dump(mode="json", by_alias=True) for entry in finding.timeline]
    timeline.append(_timeline(user.id, "retest_requested", payload.note))
    updated = repositories["findings"].update(finding.id, {"retestHistory": history, "timeline": timeline})
    audit(
        repositories,
        "finding.retest",
        "finding",
        actor=user,
        resource_id=finding.id,
        workspace_id=finding.workspace_id,
        details={"retestId": retest_id, "mode": "mock", "authorizationAcknowledged": True},
    )
    request.app.state.job_runner.start_retest(finding.id, retest_id)
    return updated
