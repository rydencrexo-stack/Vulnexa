from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter

from app.api.common import visible_items
from app.api.deps import CurrentUser, Repositories


router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(repositories: Repositories, user: CurrentUser) -> dict[str, object]:
    targets = visible_items(repositories["targets"], user)
    assets = visible_items(repositories["assets"], user)
    endpoints = visible_items(repositories["endpoints"], user)
    scans = visible_items(repositories["scans"], user)
    findings = visible_items(repositories["findings"], user)
    severities = Counter(str(finding.severity) for finding in findings)
    statuses = Counter(str(finding.verification_state) for finding in findings)
    today = datetime.now(timezone.utc).date()
    trend = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        trend.append(
            {
                "date": day.isoformat(),
                "count": sum(1 for finding in findings if finding.created_at.date() == day),
            }
        )
    return {
        "totals": {
            "targets": len(targets),
            "verifiedTargets": sum(1 for target in targets if target.verification.status == "verified"),
            "verifiedAssets": sum(1 for asset in assets if asset.verified),
            "endpoints": len(endpoints),
            "runningScans": sum(1 for scan in scans if scan.status in {"queued", "running", "paused"}),
            "confirmedFindings": statuses.get("confirmed", 0),
            "candidateFindings": statuses.get("candidate", 0) + statuses.get("high_confidence", 0),
        },
        "findingsBySeverity": {
            severity: severities.get(severity, 0)
            for severity in ("critical", "high", "medium", "low", "informational")
        },
        "findingsTrend": trend,
        "recentAssets": sorted(assets, key=lambda item: item.last_seen, reverse=True)[:5],
        "recentScans": sorted(scans, key=lambda item: item.created_at, reverse=True)[:5],
        "recentFindings": sorted(findings, key=lambda item: item.created_at, reverse=True)[:5],
        "safety": "Scanning is permitted only for verified targets within the configured authorized scope.",
    }


@router.get("/activity")
def activity(repositories: Repositories, user: CurrentUser) -> dict[str, object]:
    logs = repositories["audit_logs"].get_all()
    if user.role != "admin":
        logs = [log for log in logs if log.workspace_id in user.workspace_ids or log.actor_id == user.id]
    logs = sorted(logs, key=lambda item: item.created_at, reverse=True)[:25]
    notifications = visible_items(repositories["notifications"], user)
    notifications = [item for item in notifications if item.user_id in {None, user.id}]
    return {"auditEvents": logs, "notifications": sorted(notifications, key=lambda item: item.created_at, reverse=True)[:10]}

