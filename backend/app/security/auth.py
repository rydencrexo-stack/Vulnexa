from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from jwt import InvalidTokenError

from app.config import Settings
from app.utils.errors import AppError


HASH_PREFIX = "bcrypt-sha256$"


def _password_digest(password: str) -> bytes:
    return hashlib.sha256(password.encode("utf-8")).digest()


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(_password_digest(password), bcrypt.gensalt(rounds=12)).decode("ascii")
    return HASH_PREFIX + hashed


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        if stored_hash.startswith(HASH_PREFIX):
            candidate = bcrypt.hashpw(
                _password_digest(password), stored_hash.removeprefix(HASH_PREFIX).encode("ascii")
            ).decode("ascii")
            return hmac.compare_digest(HASH_PREFIX + candidate, stored_hash)
        return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("ascii"))
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: str, role: str, settings: Settings) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": user_id,
        "role": role,
        "type": "access",
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
        "jti": str(uuid.uuid4()),
        "iss": "pan-api",
        "aud": "pan-web",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str, settings: Settings) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience="pan-web",
            issuer="pan-api",
            options={"require": ["sub", "exp", "iat", "type"]},
        )
    except InvalidTokenError as exc:
        raise AppError(
            401,
            "invalid_session",
            "Your session is invalid or has expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    if payload.get("type") != "access":
        raise AppError(401, "invalid_session", "Invalid token type")
    return payload


def set_session_cookie(response: Any, token: str, settings: Settings) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        max_age=settings.access_token_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Any, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.cookie_name,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )

