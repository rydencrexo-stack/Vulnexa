from __future__ import annotations

import re

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, Repositories, ensure_workspace_access
from app.models.domain import Role
from app.schemas.requests import WorkspaceCreate
from app.services.audit import audit
from app.utils.errors import conflict, not_found


router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:50]
    return slug or "workspace"


def _unique_slug(base: str, existing: set[str]) -> str:
    if base not in existing:
        return base
    for number in range(2, 1000):
        candidate = f"{base}-{number}"
        if candidate not in existing:
            return candidate
    raise conflict("Could not allocate a unique workspace slug")


@router.get("")
def list_workspaces(repositories: Repositories, user: CurrentUser) -> list[object]:
    workspaces = repositories["workspaces"].get_all()
    if user.role == Role.ADMIN:
        return workspaces
    return [workspace for workspace in workspaces if workspace.id in user.workspace_ids]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_workspace(payload: WorkspaceCreate, repositories: Repositories, user: CurrentUser) -> object:
    organization_id = user.organization_id
    if organization_id is None:
        org_name = payload.organization_name or f"{user.full_name}'s organization"
        existing = {organization.slug for organization in repositories["organizations"].get_all()}
        organization = repositories["organizations"].create(
            {
                "name": org_name,
                "slug": _unique_slug(_slug(org_name), existing),
                "ownerId": user.id,
                "status": "active",
            }
        )
        organization_id = organization.id
        user = repositories["users"].update(user.id, {"organizationId": organization_id})
    existing_slugs = {workspace.slug for workspace in repositories["workspaces"].get_all()}
    workspace = repositories["workspaces"].create(
        {
            "organizationId": organization_id,
            "name": payload.name.strip(),
            "slug": _unique_slug(_slug(payload.name), existing_slugs),
            "createdBy": user.id,
            "memberIds": [user.id],
        }
    )
    repositories["users"].update(user.id, {"workspaceIds": list(dict.fromkeys([*user.workspace_ids, workspace.id]))})
    audit(repositories, "workspace.create", "workspace", actor=user, resource_id=workspace.id, workspace_id=workspace.id)
    return workspace


@router.get("/{workspace_id}")
def get_workspace(workspace_id: str, repositories: Repositories, user: CurrentUser) -> object:
    workspace = repositories["workspaces"].get_by_id(workspace_id)
    if workspace is None:
        raise not_found("Workspace")
    ensure_workspace_access(user, workspace.id)
    return workspace

