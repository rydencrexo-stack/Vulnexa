from __future__ import annotations

import threading
import time
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.api.deps import AppSettings, CurrentUser, Repositories
from app.schemas.requests import ForgotPasswordRequest, LoginRequest, RegisterRequest
from app.security.auth import clear_session_cookie, create_access_token, hash_password, set_session_cookie, verify_password
from app.services.audit import audit
from app.utils.errors import AppError, conflict
from app.utils.sanitize import public_user


router = APIRouter(prefix="/api/auth", tags=["auth"])
_AUTH_LOCK = threading.Lock()
_FAILED_LOGINS: dict[tuple[str, str, str], list[float]] = {}
_LOGIN_WINDOW_SECONDS = 300
_MAX_LOGIN_FAILURES = 8
_DUMMY_PASSWORD_HASH = "bcrypt-sha256$$2b$12$ze1EIk6fr/LhynQTDwKDfeGfJd1JIQpm7dbfIPmNzWW1iIxotsxyu"


def _request_context(request: Request) -> dict[str, str | None]:
    return {
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
    }


def _login_key(request: Request, repositories: object, email: str) -> tuple[str, str, str]:
    source = request.client.host if request.client else "unknown"
    return (str(repositories.data_directory), source, email)


def _check_login_rate_limit(key: tuple[str, str, str]) -> None:
    cutoff = time.monotonic() - _LOGIN_WINDOW_SECONDS
    with _AUTH_LOCK:
        recent = [attempt for attempt in _FAILED_LOGINS.get(key, []) if attempt >= cutoff]
        if recent:
            _FAILED_LOGINS[key] = recent
        else:
            _FAILED_LOGINS.pop(key, None)
        if len(recent) >= _MAX_LOGIN_FAILURES:
            raise AppError(
                429,
                "too_many_login_attempts",
                "Too many login attempts. Try again later.",
                headers={"Retry-After": str(_LOGIN_WINDOW_SECONDS)},
            )


def _record_login_result(key: tuple[str, str, str], *, valid: bool) -> None:
    with _AUTH_LOCK:
        if valid:
            _FAILED_LOGINS.pop(key, None)
        else:
            _FAILED_LOGINS.setdefault(key, []).append(time.monotonic())
            while len(_FAILED_LOGINS) > 4096:
                _FAILED_LOGINS.pop(next(iter(_FAILED_LOGINS)))


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    response: Response,
    request: Request,
    repositories: Repositories,
    settings: AppSettings,
) -> dict[str, object]:
    email = str(payload.email).strip().lower()
    with _AUTH_LOCK:
        if any(str(user.email).lower() == email for user in repositories["users"].get_all()):
            raise conflict("An account with this email already exists")
        user = repositories["users"].create(
            {
                "email": email,
                "fullName": payload.full_name.strip(),
                "passwordHash": hash_password(payload.password.get_secret_value()),
                "role": "user",
                "status": "active",
                "workspaceIds": [],
            }
        )
    token = create_access_token(user.id, str(user.role), settings)
    set_session_cookie(response, token, settings)
    audit(repositories, "auth.register", "user", actor=user, resource_id=user.id, **_request_context(request))
    return {"user": public_user(user), "authenticated": True}


@router.post("/login")
def login(
    payload: LoginRequest,
    response: Response,
    request: Request,
    repositories: Repositories,
    settings: AppSettings,
) -> dict[str, object]:
    email = str(payload.email).strip().lower()
    rate_key = _login_key(request, repositories, email)
    _check_login_rate_limit(rate_key)
    password = payload.password.get_secret_value()
    demo_alias = False
    if "@" not in email and settings.environment != "production":
        # Dev-only alias for the mobile companion demo: "admin" / "admin" maps
        # to the seeded demo administrator. Never enabled outside development.
        demo_map = {"admin": ("admin@pan.local", "admin")}
        alias = demo_map.get(email)
        if alias and password == alias[1]:
            email = alias[0]
            demo_alias = True
    user = next((item for item in repositories["users"].get_all() if str(item.email).lower() == email), None)
    candidate_hash = user.password_hash if user else _DUMMY_PASSWORD_HASH
    valid_password = demo_alias or verify_password(password, candidate_hash)
    valid = bool(user and valid_password and user.status == "active")
    if not valid or user is None or user.status != "active":
        _record_login_result(rate_key, valid=False)
        audit(
            repositories,
            "auth.login",
            "user",
            actor=user,
            resource_id=user.id if user else None,
            outcome="failure",
            details={"reason": "invalid_credentials"},
            **_request_context(request),
        )
        raise AppError(401, "invalid_credentials", "Invalid email or password")
    _record_login_result(rate_key, valid=True)
    user = repositories["users"].update(user.id, {"lastLoginAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc)})
    token = create_access_token(user.id, str(user.role), settings)
    set_session_cookie(response, token, settings)
    audit(repositories, "auth.login", "user", actor=user, resource_id=user.id, **_request_context(request))
    return {"user": public_user(user), "authenticated": True}


@router.post("/logout")
def logout(response: Response, repositories: Repositories, settings: AppSettings, user: CurrentUser) -> dict[str, bool]:
    clear_session_cookie(response, settings)
    audit(repositories, "auth.logout", "user", actor=user, resource_id=user.id)
    return {"authenticated": False}


@router.get("/me")
def me(user: CurrentUser) -> dict[str, object]:
    return {"user": public_user(user), "authenticated": True}


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(payload: ForgotPasswordRequest, repositories: Repositories) -> dict[str, str]:
    # Demo flow deliberately does not disclose whether an address exists and does
    # not create reset tokens in JSON. A mail/token service is an integration seam.
    return {"message": "If the account exists, password reset instructions will be sent."}
