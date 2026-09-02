from __future__ import annotations

from collections.abc import Callable
from typing import Annotated, Any

from fastapi import Depends, Request

from app.config import Settings
from app.models.domain import Role, User
from app.repositories.registry import RepositoryRegistry
from app.security.auth import decode_access_token
from app.utils.errors import AppError, forbidden


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_repositories(request: Request) -> RepositoryRegistry:
    return request.app.state.repositories


def get_current_user(
    request: Request,
    repositories: Annotated[RepositoryRegistry, Depends(get_repositories)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> User:
    token = request.cookies.get(settings.cookie_name)
    authorization = request.headers.get("Authorization", "")
    if not token and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        raise AppError(
            401,
            "authentication_required",
            "Authentication is required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(token, settings)
    user = repositories["users"].get_by_id(str(payload["sub"]))
    if user is None or user.status != "active":
        raise AppError(401, "invalid_session", "The account for this session is unavailable")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
Repositories = Annotated[RepositoryRegistry, Depends(get_repositories)]
AppSettings = Annotated[Settings, Depends(get_settings)]


def require_roles(*roles: Role | str) -> Callable[..., User]:
    allowed = {role.value if isinstance(role, Role) else role for role in roles}

    def dependency(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise forbidden(f"This operation requires one of these roles: {', '.join(sorted(allowed))}")
        return user

    return dependency


AnalystUser = Annotated[User, Depends(require_roles(Role.ANALYST, Role.ADMIN))]
AdminUser = Annotated[User, Depends(require_roles(Role.ADMIN))]


def ensure_workspace_access(user: User, workspace_id: str) -> None:
    if user.role != Role.ADMIN and workspace_id not in user.workspace_ids:
        raise forbidden("You do not have access to this workspace")


def ensure_record_access(user: User, record: Any) -> None:
    workspace_id = getattr(record, "workspace_id", None)
    if workspace_id:
        ensure_workspace_access(user, workspace_id)
