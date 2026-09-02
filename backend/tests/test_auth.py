from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.security.auth import decode_access_token, hash_password, verify_password
from app.config import Settings
from app.utils.errors import AppError


def test_password_hashing_and_jwt_integrity() -> None:
    password_hash = hash_password("StrongPassword!42")
    assert "StrongPassword!42" not in password_hash
    assert verify_password("StrongPassword!42", password_hash)
    assert not verify_password("wrong", password_hash)
    settings = Settings(jwt_secret="a-test-secret-long-enough-for-unit-testing-only")
    from app.security.auth import create_access_token

    token = create_access_token("usr_test", "analyst", settings)
    assert decode_access_token(token, settings)["sub"] == "usr_test"
    with pytest.raises(AppError):
        decode_access_token(token + "tampered", settings)


def test_login_cookie_me_logout_and_no_password_hash(app_client: tuple[object, TestClient]) -> None:
    app, client = app_client
    response = client.post(
        "/api/auth/login", json={"email": "admin@pan.local", "password": "PanAdmin!2026"}
    )
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "passwordHash" not in response.text
    assert client.get("/api/auth/me").json()["user"]["role"] == "admin"
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_login_failure_is_generic_and_does_not_persist_password(app_client: tuple[object, TestClient]) -> None:
    app, client = app_client
    response = client.post("/api/auth/login", json={"email": "admin@pan.local", "password": "Wrong!12345"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"
    all_json = "\n".join(path.read_text(encoding="utf-8") for path in app.state.settings.data_directory.glob("*.json"))
    assert "Wrong!12345" not in all_json


def test_registration_forces_user_role_and_rejects_password_echo(app_client: tuple[object, TestClient]) -> None:
    app, client = app_client
    response = client.post(
        "/api/auth/register",
        json={"email": "new.user@example.test", "password": "GoodPassword!42", "fullName": "New User"},
    )
    assert response.status_code == 201
    assert response.json()["user"]["role"] == "user"
    assert "passwordHash" not in response.text
    malicious = client.post(
        "/api/auth/register",
        json={
            "email": "admin2@example.test",
            "password": "GoodPassword!42",
            "fullName": "Fake Admin",
            "role": "admin",
        },
    )
    assert malicious.status_code == 422
    assert "GoodPassword!42" not in malicious.text


def test_admin_endpoints_enforce_role(analyst_client: tuple[object, TestClient]) -> None:
    _, client = analyst_client
    assert client.get("/api/admin/overview").status_code == 403


def test_admin_user_list_never_exposes_hash(admin_client: tuple[object, TestClient]) -> None:
    _, client = admin_client
    response = client.get("/api/admin/users")
    assert response.status_code == 200
    assert "passwordHash" not in response.text

