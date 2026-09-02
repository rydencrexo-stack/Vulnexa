from __future__ import annotations

import re
from typing import Any


SECRET_PATTERNS = (
    re.compile(r"(?i)(authorization\s*:\s*(?:bearer|basic)\s+)[^\s]+"),
    re.compile(r"(?i)((?:api[-_]?key|token|password|secret)\s*[=:]\s*)[^\s,;&]+"),
    re.compile(r"(?i)(cookie\s*:\s*)[^\r\n]+"),
)


def sanitize_text(value: str | None, *, limit: int = 8000) -> str:
    text = (value or "").replace("\x00", "")[:limit]
    for pattern in SECRET_PATTERNS:
        text = pattern.sub(r"\1[REDACTED]", text)
    return text


def public_user(user: Any) -> dict[str, Any]:
    dumped = user.model_dump(mode="json", by_alias=True)
    dumped.pop("passwordHash", None)
    return dumped

