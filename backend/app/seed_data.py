from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import Settings
from app.repositories.registry import RepositoryRegistry
from app.security.auth import hash_password


ADMIN_EMAIL = "admin@pan.local"
ADMIN_PASSWORD = "PanAdmin!2026"
ANALYST_EMAIL = "analyst@pan.local"
ANALYST_PASSWORD = "PanAnalyst!2026"

ADMIN_ID = "usr_11111111-1111-4111-8111-111111111111"
ANALYST_ID = "usr_22222222-2222-4222-8222-222222222222"
ORG_ID = "org_11111111-1111-4111-8111-111111111111"
WORKSPACE_ID = "wsp_11111111-1111-4111-8111-111111111111"
TARGET_ONE = "tgt_11111111-1111-4111-8111-111111111111"
TARGET_TWO = "tgt_22222222-2222-4222-8222-222222222222"
ASSET_ONE = "ast_11111111-1111-4111-8111-111111111111"
ASSET_TWO = "ast_22222222-2222-4222-8222-222222222222"
ASSET_THREE = "ast_33333333-3333-4333-8333-333333333333"
ENDPOINT_ONE = "ep_11111111-1111-4111-8111-111111111111"
ENDPOINT_TWO = "ep_22222222-2222-4222-8222-222222222222"
ENDPOINT_THREE = "ep_33333333-3333-4333-8333-333333333333"
SCAN_RUNNING = "scn_11111111-1111-4111-8111-111111111111"
SCAN_COMPLETE = "scn_22222222-2222-4222-8222-222222222222"
FINDING_CONFIRMED = "fnd_11111111-1111-4111-8111-111111111111"
FINDING_CANDIDATE = "fnd_22222222-2222-4222-8222-222222222222"


def _iso(offset_minutes: int = 0) -> str:
    value = datetime.now(timezone.utc) + timedelta(minutes=offset_minutes)
    return value.isoformat().replace("+00:00", "Z")


def _record(record_id: str, **values: Any) -> dict[str, Any]:
    return {"id": record_id, "createdAt": _iso(-120), "updatedAt": _iso(-5), **values}


def seed(repositories: RepositoryRegistry, *, force: bool = False) -> None:
    if repositories["users"].get_all() and not force:
        raise RuntimeError("Seed data already exists. Pass --force to replace all PAN collections.")

    collections: dict[str, list[dict[str, Any]]] = {name: [] for name in repositories.collections}
    collections["users"] = [
        _record(
            ADMIN_ID,
            email=ADMIN_EMAIL,
            fullName="PAN Demo Administrator",
            passwordHash=hash_password(ADMIN_PASSWORD),
            role="admin",
            status="active",
            organizationId=ORG_ID,
            workspaceIds=[WORKSPACE_ID],
            lastLoginAt=_iso(-10),
        ),
        _record(
            ANALYST_ID,
            email=ANALYST_EMAIL,
            fullName="PAN Demo Analyst",
            passwordHash=hash_password(ANALYST_PASSWORD),
            role="analyst",
            status="active",
            organizationId=ORG_ID,
            workspaceIds=[WORKSPACE_ID],
            lastLoginAt=_iso(-20),
        ),
    ]
    collections["organizations"] = [
        _record(
            ORG_ID,
            name="Vulnexa Labs",
            slug="vulnexa-labs",
            planId="pln_11111111-1111-4111-8111-111111111111",
            ownerId=ADMIN_ID,
            status="active",
        )
    ]
    collections["workspaces"] = [
        _record(
            WORKSPACE_ID,
            organizationId=ORG_ID,
            name="Authorized Demo Lab",
            slug="authorized-demo-lab",
            createdBy=ADMIN_ID,
            memberIds=[ADMIN_ID, ANALYST_ID],
        )
    ]
    collections["targets"] = [
        _record(
            TARGET_ONE,
            workspaceId=WORKSPACE_ID,
            name="Demo Commerce Application",
            baseUrl="https://demo.example.com",
            domain="demo.example.com",
            environment="staging",
            verification={"status": "verified", "method": "mock", "challenge": None, "verifiedAt": _iso(-110)},
            scope={
                "includedHosts": ["demo.example.com", "api.demo.example.com"],
                "excludedHosts": [],
                "includedPaths": ["/*"],
                "excludedPaths": ["/logout", "/delete-account", "/payments"],
                "allowedPorts": [80, 443],
            },
            authenticationProfileId=None,
            scanProfile="balanced",
            createdBy=ADMIN_ID,
            lastScanAt=_iso(-15),
            risk="high",
        ),
        _record(
            TARGET_TWO,
            workspaceId=WORKSPACE_ID,
            name="Partner Sandbox API",
            baseUrl="https://api.sandbox.example.org",
            domain="api.sandbox.example.org",
            environment="staging",
            verification={
                "status": "pending",
                "method": "dns_txt",
                "challenge": "pan-verification=demo-pending-challenge",
                "verifiedAt": None,
            },
            scope={
                "includedHosts": ["api.sandbox.example.org"],
                "excludedHosts": [],
                "includedPaths": ["/v1/*", "/health"],
                "excludedPaths": ["/v1/payments/*", "/v1/admin/*"],
                "allowedPorts": [443],
            },
            authenticationProfileId=None,
            scanProfile="safe",
            createdBy=ANALYST_ID,
            lastScanAt=None,
            risk="unknown",
        ),
    ]
    collections["assets"] = [
        _record(
            ASSET_ONE,
            workspaceId=WORKSPACE_ID,
            targetId=TARGET_ONE,
            hostname="demo.example.com",
            domain="demo.example.com",
            ip="203.0.113.10",
            port=443,
            protocol="https",
            httpStatus=200,
            pageTitle="Demo Commerce",
            technologies=["nginx", "Next.js", "Node.js"],
            tls={"valid": True, "issuer": "Demo CA", "expiresInDays": 74},
            screenshot=None,
            firstSeen=_iso(-100),
            lastSeen=_iso(-4),
            discoverySource="mock_httpx",
            riskState="high",
            verified=True,
        ),
        _record(
            ASSET_TWO,
            workspaceId=WORKSPACE_ID,
            targetId=TARGET_ONE,
            hostname="api.demo.example.com",
            domain="demo.example.com",
            ip="203.0.113.11",
            port=443,
            protocol="https",
            httpStatus=200,
            pageTitle="Commerce API",
            technologies=["FastAPI", "nginx"],
            tls={"valid": True, "issuer": "Demo CA", "expiresInDays": 74},
            screenshot=None,
            firstSeen=_iso(-95),
            lastSeen=_iso(-3),
            discoverySource="mock_subfinder",
            riskState="medium",
            verified=True,
        ),
        _record(
            ASSET_THREE,
            workspaceId=WORKSPACE_ID,
            targetId=TARGET_ONE,
            hostname="static.demo.example.com",
            domain="demo.example.com",
            ip="203.0.113.12",
            port=443,
            protocol="https",
            httpStatus=200,
            pageTitle="Static assets",
            technologies=["CDN"],
            tls={"valid": True},
            screenshot=None,
            firstSeen=_iso(-90),
            lastSeen=_iso(-2),
            discoverySource="mock_recon",
            riskState="low",
            verified=True,
        ),
    ]
    collections["endpoints"] = [
        _record(
            ENDPOINT_ONE,
            workspaceId=WORKSPACE_ID,
            targetId=TARGET_ONE,
            assetId=ASSET_ONE,
            url="https://demo.example.com/search?q=demo",
            normalizedPath="/search",
            method="GET",
            contentType="text/html",
            parameters=[{"name": "q", "location": "query", "dataType": "string", "required": False}],
            authenticationRequired=False,
            observedRole=None,
            discoverySource="mock_katana",
            statusCode=200,
            responseFingerprint="sha256:mock-search",
            testsCompleted=["passive", "xss"],
            firstSeen=_iso(-85),
            lastSeen=_iso(-2),
            kind="web",
        ),
        _record(
            ENDPOINT_TWO,
            workspaceId=WORKSPACE_ID,
            targetId=TARGET_ONE,
            assetId=ASSET_TWO,
            url="https://api.demo.example.com/v1/orders/1001",
            normalizedPath="/v1/orders/{id}",
            method="GET",
            contentType="application/json",
            parameters=[{"name": "id", "location": "path", "dataType": "integer", "required": True}],
            authenticationRequired=True,
            observedRole="user",
            discoverySource="mock_javascript",
            statusCode=200,
            responseFingerprint="sha256:mock-order",
            testsCompleted=["passive", "api"],
            firstSeen=_iso(-80),
            lastSeen=_iso(-1),
            kind="api",
        ),
        _record(
            ENDPOINT_THREE,
            workspaceId=WORKSPACE_ID,
            targetId=TARGET_ONE,
            assetId=ASSET_TWO,
            url="https://api.demo.example.com/v1/profile",
            normalizedPath="/v1/profile",
            method="PATCH",
            contentType="application/json",
            parameters=[{"name": "displayName", "location": "body", "dataType": "string", "required": False}],
            authenticationRequired=True,
            observedRole="user",
            discoverySource="mock_openapi",
            statusCode=200,
            responseFingerprint="sha256:mock-profile",
            testsCompleted=["passive", "api", "misconfigurations"],
            firstSeen=_iso(-70),
            lastSeen=_iso(-1),
            kind="api",
        ),
    ]
    collections["recon_jobs"] = [
        _record(
            "rec_11111111-1111-4111-8111-111111111111",
            workspaceId=WORKSPACE_ID,
            targetId=TARGET_ONE,
            name="Baseline attack-surface inventory",
            modules=["subdomains", "live_hosts", "url_discovery", "javascript", "technologies"],
            status="completed",
            progress=100,
            currentModule="technologies",
            startUrl="https://demo.example.com",
            statistics={"assetsFound": 3, "endpointsFound": 42},
            logs=["Mock recon completed safely; 0 external requests."],
            createdBy=ANALYST_ID,
            startedAt=_iso(-100),
            completedAt=_iso(-92),
            error=None,
        )
    ]
    collections["scans"] = [
        _record(
            SCAN_RUNNING,
            workspaceId=WORKSPACE_ID,
            targetId=TARGET_ONE,
            name="Balanced nightly assessment",
            profile="balanced",
            modules=["passive", "xss", "api", "misconfigurations", "ai_analysis"],
            authenticationProfileId=None,
            speed="balanced",
            requestLimit=2500,
            concurrency=3,
            status="running",
            progress=48,
            currentPhase="active_testing",
            statistics={
                "assetsFound": 3,
                "endpointsFound": 42,
                "parametersTested": 18,
                "requestsSent": 184,
                "candidateFindings": 2,
                "confirmedFindings": 1,
            },
            warnings=["Seeded mock scan; no network traffic is occurring."],
            createdBy=ANALYST_ID,
            startedAt=_iso(-30),
            completedAt=None,
            scheduledAt=None,
            externalReference=None,
            error=None,
        ),
        _record(
            SCAN_COMPLETE,
            workspaceId=WORKSPACE_ID,
            targetId=TARGET_ONE,
            name="Safe baseline scan",
            profile="safe",
            modules=["subdomains", "live_hosts", "url_discovery", "passive"],
            authenticationProfileId=None,
            speed="safe",
            requestLimit=1000,
            concurrency=1,
            status="completed",
            progress=100,
            currentPhase="report_generation",
            statistics={
                "assetsFound": 3,
                "endpointsFound": 42,
                "parametersTested": 0,
                "requestsSent": 0,
                "candidateFindings": 1,
                "confirmedFindings": 0,
            },
            warnings=["Completed in safe mock mode."],
            createdBy=ADMIN_ID,
            startedAt=_iso(-80),
            completedAt=_iso(-70),
            scheduledAt=None,
            externalReference=None,
            error=None,
        ),
    ]
    collections["scan_events"] = [
        _record(
            "evt_11111111-1111-4111-8111-111111111111",
            workspaceId=WORKSPACE_ID,
            scanId=SCAN_RUNNING,
            level="info",
            phase="scope_validation",
            message="Verified target and scope accepted.",
            progress=5,
        ),
        _record(
            "evt_22222222-2222-4222-8222-222222222222",
            workspaceId=WORKSPACE_ID,
            scanId=SCAN_RUNNING,
            level="info",
            phase="active_testing",
            message="Safe mock active checks in progress; no external requests.",
            progress=48,
        ),
    ]
    collections["findings"] = [
        _record(
            FINDING_CONFIRMED,
            workspaceId=WORKSPACE_ID,
            targetId=TARGET_ONE,
            scanId=SCAN_RUNNING,
            assetId=ASSET_ONE,
            endpointId=ENDPOINT_ONE,
            title="Reflected Cross-Site Scripting",
            type="xss",
            severity="high",
            confidence=96,
            verificationState="confirmed",
            source="mock_xss_scanner",
            method="GET",
            parameter="q",
            cwe="CWE-79",
            owasp="A03:2021 Injection",
            cvss={"version": "3.1", "score": 8.2, "vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:H/A:N"},
            description="A deterministic demo fixture shows context-unsafe reflection in the stored sanitized response.",
            impact="An attacker could execute script in a victim's browser in a real vulnerable deployment.",
            evidence={
                "requestId": "evidence_request_demo_01",
                "responseId": "evidence_response_demo_01",
                "references": ["evidence_request_demo_01", "evidence_response_demo_01"],
                "screenshot": None,
                "browserVerified": True,
                "summary": "Development-only mock evidence.",
            },
            sanitizedRequest="GET /search?q=%3Cdemo-marker%3E HTTP/1.1\nHost: demo.example.com",
            sanitizedResponse="HTTP/1.1 200 OK\nContent-Type: text/html\n\n<div>demo-marker</div>",
            reproductionSteps=["Use only the approved demo fixture.", "Review the linked sanitized evidence."],
            aiAnalysis=None,
            remediation="Apply context-aware output encoding and a restrictive Content Security Policy.",
            status="open",
            assignedTo=ANALYST_ID,
            timeline=[{"timestamp": _iso(-25), "actorId": ANALYST_ID, "action": "finding.confirm", "note": "Confirmed from deterministic fixture evidence."}],
            retestHistory=[],
        ),
        _record(
            FINDING_CANDIDATE,
            workspaceId=WORKSPACE_ID,
            targetId=TARGET_ONE,
            scanId=SCAN_COMPLETE,
            assetId=ASSET_TWO,
            endpointId=ENDPOINT_TWO,
            title="Potential object-level authorization gap",
            type="idor",
            severity="medium",
            confidence=68,
            verificationState="candidate",
            source="mock_api_analyzer",
            method="GET",
            parameter="id",
            cwe="CWE-639",
            owasp="API1:2023 Broken Object Level Authorization",
            cvss={"version": "3.1", "score": 6.5, "vector": "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N"},
            description="Response-shape differences suggest a candidate authorization issue; no cross-user request was executed.",
            impact="A confirmed issue could expose another user's order data.",
            evidence={
                "requestId": "evidence_request_demo_02",
                "responseId": "evidence_response_demo_02",
                "references": ["evidence_request_demo_02"],
                "screenshot": None,
                "browserVerified": False,
                "summary": "Insufficient evidence for confirmation.",
            },
            sanitizedRequest="GET /v1/orders/1001 HTTP/1.1\nHost: api.demo.example.com\nAuthorization: [REDACTED]",
            sanitizedResponse="HTTP/1.1 200 OK\nContent-Type: application/json\n\n{\"id\":1001,\"owner\":\"[REDACTED]\"}",
            reproductionSteps=[],
            aiAnalysis=None,
            remediation="Enforce object ownership checks server-side for every object lookup.",
            status="open",
            assignedTo=None,
            timeline=[],
            retestHistory=[],
        ),
    ]
    collections["notifications"] = [
        _record(
            "ntf_11111111-1111-4111-8111-111111111111",
            workspaceId=WORKSPACE_ID,
            userId=ANALYST_ID,
            type="new_finding",
            title="High-severity finding confirmed",
            message="Reflected Cross-Site Scripting is ready for remediation.",
            severity="high",
            read=False,
            link=f"/findings/{FINDING_CONFIRMED}/overview",
        ),
        _record(
            "ntf_22222222-2222-4222-8222-222222222222",
            workspaceId=WORKSPACE_ID,
            userId=None,
            type="scan_alert",
            title="Mock scan running",
            message="The seeded scan is demonstration telemetry and sends no traffic.",
            severity="info",
            read=False,
            link=f"/scans/{SCAN_RUNNING}/live",
        ),
    ]
    collections["learning_progress"] = [
        _record(
            "lrn_11111111-1111-4111-8111-111111111111",
            workspaceId=WORKSPACE_ID,
            userId=ANALYST_ID,
            lessonId="understanding-findings",
            completed=True,
            percent=100,
        )
    ]
    tool_specs = [
        ("Subfinder", "subfinder", "recon", "Passive subdomain discovery"),
        ("HTTPx", "httpx", "recon", "HTTP service probing"),
        ("Naabu", "naabu", "recon", "Port discovery"),
        ("Katana", "katana", "recon", "URL discovery"),
        ("Dalfox", "dalfox", "specialist", "XSS adapter interface"),
        ("SQLmap", "sqlmap", "specialist", "SQLi adapter interface"),
        ("Nuclei", "nuclei", "specialist", "Configuration and CVE templates"),
        ("Acunetix", "acunetix", "active", "Dedicated active scanner adapter"),
    ]
    collections["scanner_tools"] = [
        _record(
            f"tool_00000000-0000-4000-8000-{index:012d}",
            name=name,
            slug=slug,
            category=category,
            enabled=True,
            mode="mock",
            status="available" if slug != "acunetix" else "disconnected",
            version=None,
            description=description,
        )
        for index, (name, slug, category, description) in enumerate(tool_specs, 1)
    ]
    collections["scan_workers"] = [
        _record(
            "wrk_11111111-1111-4111-8111-111111111111",
            name="mock-worker-01",
            status="healthy",
            capabilities=["recon", "passive", "specialist_mock"],
            currentScanId=SCAN_RUNNING,
            lastHeartbeatAt=_iso(-1),
            jobsCompleted=14,
        ),
        _record(
            "wrk_22222222-2222-4222-8222-222222222222",
            name="mock-worker-02",
            status="healthy",
            capabilities=["reports", "ai_mock"],
            currentScanId=None,
            lastHeartbeatAt=_iso(-1),
            jobsCompleted=22,
        ),
    ]
    collections["templates"] = [
        _record(
            "tpl_11111111-1111-4111-8111-111111111111",
            workspaceId=None,
            name="Balanced web assessment",
            type="scan_profile",
            description="Safe recon, passive checks, and selected non-destructive specialist modules.",
            enabled=True,
            config={"modules": ["subdomains", "live_hosts", "url_discovery", "passive", "xss", "misconfigurations"]},
            createdBy=ADMIN_ID,
        )
    ]
    collections["plans"] = [
        _record(
            "pln_11111111-1111-4111-8111-111111111111",
            name="Hackathon Demo",
            description="Development-only plan with safe platform limits.",
            limits={"targets": 10, "monthlyScans": 100, "concurrency": 3},
            enabled=True,
        )
    ]
    collections["settings"] = [
        _record(
            "set_11111111-1111-4111-8111-111111111111",
            workspaceId=WORKSPACE_ID,
            category="scan-settings",
            values={"defaultProfile": "balanced", "requestLimit": 2500, "concurrency": 3},
            updatedBy=ADMIN_ID,
        ),
        _record(
            "set_22222222-2222-4222-8222-222222222222",
            workspaceId=WORKSPACE_ID,
            category="notifications",
            values={"scanCompleted": True, "highSeverityFinding": True},
            updatedBy=ANALYST_ID,
        ),
    ]
    collections["audit_logs"] = [
        _record(
            "aud_11111111-1111-4111-8111-111111111111",
            workspaceId=WORKSPACE_ID,
            organizationId=ORG_ID,
            actorId=ADMIN_ID,
            action="target.create",
            resourceType="target",
            resourceId=TARGET_ONE,
            outcome="success",
            ipAddress="127.0.0.1",
            userAgent="PAN seed script",
            details={"mode": "development_seed", "authorizationAcknowledged": True},
        ),
        _record(
            "aud_22222222-2222-4222-8222-222222222222",
            workspaceId=WORKSPACE_ID,
            organizationId=ORG_ID,
            actorId=ANALYST_ID,
            action="scan.create",
            resourceType="scan",
            resourceId=SCAN_RUNNING,
            outcome="success",
            ipAddress="127.0.0.1",
            userAgent="PAN seed script",
            details={"mode": "mock", "authorizationAcknowledged": True},
        ),
    ]

    # Replace every collection so stale demo relationships cannot survive a reseed.
    for name in repositories.collections:
        repositories[name].replace_all(collections[name])


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed PAN development data")
    parser.add_argument("--force", action="store_true", help="Replace every existing collection")
    arguments = parser.parse_args()
    settings = Settings.from_env()
    settings.prepare_directories()
    repositories = RepositoryRegistry(settings.data_directory, backups=settings.repository_backups)
    seed(repositories, force=arguments.force)
    print("PAN development data seeded.")
    print(f"Admin:   {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    print(f"Analyst: {ANALYST_EMAIL} / {ANALYST_PASSWORD}")
    print("These credentials are development-only. Never deploy them.")


if __name__ == "__main__":
    main()

