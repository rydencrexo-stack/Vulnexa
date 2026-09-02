from __future__ import annotations

import time

from fastapi.testclient import TestClient

from app.seed_data import FINDING_CANDIDATE, FINDING_CONFIRMED, TARGET_ONE, WORKSPACE_ID
from app.security.auth import hash_password


def _target_payload(domain: str = "shop.example.net") -> dict[str, object]:
    return {
        "workspaceId": WORKSPACE_ID,
        "name": "Authorized test shop",
        "baseUrl": f"https://{domain}",
        "domain": domain,
        "environment": "staging",
        "verificationMethod": "mock",
        "scope": {
            "includedHosts": [domain],
            "excludedHosts": [],
            "includedPaths": ["/*"],
            "excludedPaths": ["/logout", "/delete-account", "/payments"],
            "allowedPorts": [443],
        },
        "authorizationAcknowledged": True,
    }


def test_target_verification_and_recon_guard(admin_client: tuple[object, TestClient]) -> None:
    _, client = admin_client
    created = client.post("/api/targets", json=_target_payload())
    assert created.status_code == 201, created.text
    target_id = created.json()["id"]
    blocked = client.post(
        "/api/recon/jobs",
        json={
            "workspaceId": WORKSPACE_ID,
            "targetId": target_id,
            "name": "Guard test",
            "modules": ["subdomains"],
            "authorizationAcknowledged": True,
        },
    )
    assert blocked.status_code == 422
    missing_ack = client.post(f"/api/targets/{target_id}/verify", json={"method": "mock"})
    assert missing_ack.status_code == 422
    verified = client.post(
        f"/api/targets/{target_id}/verify",
        json={"method": "mock", "authorizationAcknowledged": True},
    )
    assert verified.status_code == 200
    started = client.post(
        "/api/recon/jobs",
        json={
            "workspaceId": WORKSPACE_ID,
            "targetId": target_id,
            "name": "Safe recon",
            "modules": ["subdomains", "live_hosts"],
            "authorizationAcknowledged": True,
        },
    )
    assert started.status_code == 202, started.text
    assert started.json()["status"] in {"queued", "running"}


def test_scan_pause_resume_cancel(admin_client: tuple[object, TestClient]) -> None:
    _, client = admin_client
    response = client.post(
        "/api/scans",
        json={
            "workspaceId": WORKSPACE_ID,
            "targetId": TARGET_ONE,
            "name": "Control-state test",
            "modules": ["passive", "xss"],
            "speed": "safe",
            "requestLimit": 500,
            "concurrency": 1,
            "authorizationAcknowledged": True,
        },
    )
    assert response.status_code == 202, response.text
    scan_id = response.json()["id"]
    deadline = time.time() + 1
    state = response.json()["status"]
    while state != "running" and time.time() < deadline:
        time.sleep(0.02)
        state = client.get(f"/api/scans/{scan_id}").json()["status"]
    assert state == "running"
    assert client.post(f"/api/scans/{scan_id}/pause").status_code == 200
    assert client.post(f"/api/scans/{scan_id}/resume").status_code == 200
    cancelled = client.post(f"/api/scans/{scan_id}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"


def test_findings_role_lifecycle_retest_and_ai_does_not_confirm(
    analyst_client: tuple[object, TestClient]
) -> None:
    app, client = analyst_client
    analysis = client.post("/api/ai/analyze-finding", json={"findingId": FINDING_CANDIDATE})
    assert analysis.status_code == 200, analysis.text
    assert "evidence_request" in analysis.json()["evidenceUsed"][0] if analysis.json()["evidenceUsed"] else True
    finding = app.state.repositories["findings"].require(FINDING_CANDIDATE)
    assert finding.verification_state == "candidate"
    confirmed = client.post(f"/api/findings/{FINDING_CANDIDATE}/confirm", json={"note": "Fixture reviewed"})
    assert confirmed.status_code == 200
    assert confirmed.json()["verificationState"] == "confirmed"
    retest = client.post(
        f"/api/findings/{FINDING_CONFIRMED}/retest",
        json={"note": "Safe demo retest", "authorizationAcknowledged": True},
    )
    assert retest.status_code == 202
    assert retest.json()["retestHistory"][-1]["status"] == "queued"


def test_standard_user_cannot_confirm_finding(app_client: tuple[object, TestClient]) -> None:
    app, client = app_client
    user = app.state.repositories["users"].create(
        {
            "email": "standard@example.test",
            "fullName": "Standard User",
            "passwordHash": hash_password("StandardUser!42"),
            "role": "user",
            "status": "active",
            "organizationId": app.state.repositories["organizations"].get_all()[0].id,
            "workspaceIds": [WORKSPACE_ID],
        }
    )
    login = client.post("/api/auth/login", json={"email": "standard@example.test", "password": "StandardUser!42"})
    assert login.status_code == 200
    assert client.post(f"/api/findings/{FINDING_CANDIDATE}/confirm", json={}).status_code == 403


def test_reports_generate_all_formats_and_download(admin_client: tuple[object, TestClient]) -> None:
    app, client = admin_client
    response = client.post(
        "/api/reports",
        json={
            "workspaceId": WORKSPACE_ID,
            "targetId": TARGET_ONE,
            "name": "Critical API test report",
            "type": "technical",
            "formats": ["html", "json", "csv", "pdf"],
        },
    )
    assert response.status_code == 201, response.text
    report = response.json()
    assert report["status"] == "completed"
    assert set(report["files"]) == {"html", "json", "csv", "pdf"}
    for output_format in report["files"]:
        download = client.get(f"/api/reports/{report['id']}/download", params={"format": output_format})
        assert download.status_code == 200
        assert download.content


def test_active_scanner_mock_normalizes_without_auto_confirmation(admin_client: tuple[object, TestClient]) -> None:
    _, client = admin_client
    status = client.get("/api/active-scanner/status")
    assert status.status_code == 200 and status.json()["mode"] == "mock"
    started = client.post(
        "/api/active-scanner/scans",
        json={
            "workspaceId": WORKSPACE_ID,
            "targetId": TARGET_ONE,
            "name": "Mock Acunetix test",
            "profile": "full_scan",
            "authorizationAcknowledged": True,
        },
    )
    assert started.status_code == 202, started.text
    scan_id = started.json()["id"]
    synced = client.post(f"/api/active-scanner/scans/{scan_id}/sync-findings")
    assert synced.status_code == 200
    assert synced.json()["imported"] == 1
    assert synced.json()["findings"][0]["verificationState"] == "high_confidence"


def test_dashboard_and_cross_origin_cors(admin_client: tuple[object, TestClient]) -> None:
    _, client = admin_client
    summary = client.get("/api/dashboard/summary")
    assert summary.status_code == 200
    assert summary.json()["totals"]["targets"] == 2
    preflight = client.options(
        "/api/targets",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "http://localhost:3000"

