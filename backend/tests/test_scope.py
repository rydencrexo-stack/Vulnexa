from __future__ import annotations

import pytest

from app.models.domain import Target, TargetScope
from app.utils.errors import AppError
from app.utils.scope import (
    ensure_scope_consistent,
    evaluate_url_scope,
    host_matches,
    is_public_address,
    require_scannable_target,
    validate_redirect,
    validate_target_url,
)


def _target(verified: bool = True) -> Target:
    return Target.model_validate(
        {
            "id": "tgt_test",
            "createdAt": "2026-08-27T00:00:00Z",
            "updatedAt": "2026-08-27T00:00:00Z",
            "workspaceId": "wsp_test",
            "name": "Scope target",
            "baseUrl": "https://app.example.com",
            "domain": "example.com",
            "environment": "staging",
            "verification": {
                "status": "verified" if verified else "pending",
                "method": "mock",
                "verifiedAt": "2026-08-27T00:00:00Z" if verified else None,
            },
            "scope": {
                "includedHosts": ["app.example.com", "*.api.example.com"],
                "excludedHosts": ["admin.api.example.com"],
                "includedPaths": ["/public/*", "/api/*"],
                "excludedPaths": ["/api/logout", "/api/payments/*"],
                "allowedPorts": [443],
            },
            "createdBy": "usr_test",
        }
    )


def test_scope_includes_excludes_ports_and_redirects() -> None:
    target = _target()
    assert evaluate_url_scope(target, "https://app.example.com/public/index").allowed
    assert evaluate_url_scope(target, "https://v1.api.example.com/api/users").allowed
    assert not evaluate_url_scope(target, "https://admin.api.example.com/api/users").allowed
    assert not evaluate_url_scope(target, "https://app.example.com/api/logout").allowed
    assert not evaluate_url_scope(target, "https://app.example.com:8443/api/users").allowed
    assert not validate_redirect(target, "https://evil.example.net/api/users").allowed
    assert host_matches("v1.api.example.com", "*.api.example.com")
    assert not host_matches("api.example.com", "*.api.example.com")


def test_unverified_target_cannot_scan() -> None:
    with pytest.raises(AppError) as error:
        require_scannable_target(_target(verified=False), start_url="https://app.example.com/api/users")
    assert error.value.code == "scope_safety_violation"


def test_cloud_mode_blocks_private_and_special_addresses() -> None:
    assert not is_public_address("127.0.0.1")
    assert not is_public_address("10.0.0.8")
    assert not is_public_address("169.254.1.2")
    with pytest.raises(AppError):
        validate_target_url("http://127.0.0.1:8080", cloud_mode=True)


def test_scope_consistency_rejects_outside_domain() -> None:
    scope = TargetScope(includedHosts=["outside.example.net"], includedPaths=["/*"], allowedPorts=[443])
    with pytest.raises(AppError):
        ensure_scope_consistent("example.com", scope)

