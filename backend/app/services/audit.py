from __future__ import annotations

from typing import Any

from app.models.domain import User
from app.repositories.registry import RepositoryRegistry


def audit(
    repositories: RepositoryRegistry,
    action: str,
    resource_type: str,
    *,
    actor: User | None = None,
    resource_id: str | None = None,
    workspace_id: str | None = None,
    outcome: str = "success",
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    repositories["audit_logs"].create(
        {
            "workspaceId": workspace_id,
            "organizationId": actor.organization_id if actor else None,
            "actorId": actor.id if actor else None,
            "action": action,
            "resourceType": resource_type,
            "resourceId": resource_id,
            "outcome": outcome,
            "ipAddress": ip_address,
            "userAgent": user_agent,
            "details": details or {},
        }
    )
