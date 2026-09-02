from __future__ import annotations

from pathlib import Path
from typing import Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.seed_data import seed


@pytest.fixture()
def app_client(tmp_path: Path) -> Iterator[tuple[object, TestClient]]:
    settings = Settings(
        data_directory=tmp_path / "data",
        evidence_directory=tmp_path / "evidence",
        report_directory=tmp_path / "reports",
        jwt_secret="test-secret-that-is-long-random-and-never-used-outside-tests",
        scanner_mock_mode=True,
        scanner_step_seconds=0.15,
        repository_backups=False,
    )
    app = create_app(settings)
    seed(app.state.repositories, force=True)
    with TestClient(app) as client:
        yield app, client


def login(client: TestClient, email: str, password: str) -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


@pytest.fixture()
def admin_client(app_client: tuple[object, TestClient]) -> tuple[object, TestClient]:
    app, client = app_client
    login(client, "admin@pan.local", "PanAdmin!2026")
    return app, client


@pytest.fixture()
def analyst_client(app_client: tuple[object, TestClient]) -> tuple[object, TestClient]:
    app, client = app_client
    login(client, "analyst@pan.local", "PanAnalyst!2026")
    return app, client

