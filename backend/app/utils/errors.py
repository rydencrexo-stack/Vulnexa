from __future__ import annotations

from typing import Any


class AppError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        *,
        details: Any | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        self.headers = headers or {}


def not_found(resource: str) -> AppError:
    return AppError(404, "not_found", f"{resource} was not found")


def forbidden(message: str = "You do not have permission to perform this action") -> AppError:
    return AppError(403, "forbidden", message)


def conflict(message: str) -> AppError:
    return AppError(409, "conflict", message)


def unsafe(message: str) -> AppError:
    return AppError(422, "scope_safety_violation", message)

