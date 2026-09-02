from __future__ import annotations

import logging
import threading
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import Settings
from app.models.domain import Finding, PanModel
from app.utils.errors import AppError


logger = logging.getLogger("pan.acunetix")


class AcunetixState(PanModel):
    configured: bool
    connected: bool
    mode: str
    base_url: str | None = None
    message: str


class AcunetixAdapter(ABC):
    @abstractmethod
    def status(self) -> AcunetixState: ...

    @abstractmethod
    def test_connection(self) -> AcunetixState: ...

    @abstractmethod
    def get_targets(self) -> list[dict[str, Any]]: ...

    @abstractmethod
    def synchronize_targets(self, targets: list[dict[str, Any]]) -> dict[str, Any]: ...

    @abstractmethod
    def start_scan(self, target: dict[str, Any], profile: str) -> dict[str, Any]: ...

    @abstractmethod
    def get_scan_status(self, scan_id: str) -> dict[str, Any]: ...

    @abstractmethod
    def stop_scan(self, scan_id: str) -> dict[str, Any]: ...

    @abstractmethod
    def get_vulnerabilities(self, scan_id: str) -> list[dict[str, Any]]: ...

    @abstractmethod
    def get_reports(self, scan_id: str) -> list[dict[str, Any]]: ...

    @abstractmethod
    def download_report(self, report_id: str) -> bytes: ...

    @abstractmethod
    def get_live_vulnerabilities(self, limit: int = 8) -> list[dict[str, Any]]: ...

    def normalize_vulnerability(self, vulnerability: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        severity_map = {0: "informational", 1: "low", 2: "medium", 3: "high", 4: "critical"}
        return {
            "workspaceId": context["workspaceId"],
            "targetId": context["targetId"],
            "scanId": context.get("scanId"),
            "title": vulnerability.get("name", "Acunetix observation"),
            "type": vulnerability.get("vtName", "acunetix"),
            "severity": severity_map.get(vulnerability.get("severity", 2), "medium"),
            "confidence": min(99, int(vulnerability.get("confidence", 80))),
            "verificationState": "high_confidence",
            "source": "acunetix",
            "method": vulnerability.get("method", "GET"),
            "parameter": vulnerability.get("parameter"),
            "cwe": vulnerability.get("cwe"),
            "owasp": vulnerability.get("owasp"),
            "description": vulnerability.get("description", "Imported and normalized Acunetix observation."),
            "impact": vulnerability.get("impact", "Review the evidence and business context."),
            "evidence": {"references": [str(vulnerability.get("vulnId", "mock"))]},
            "reproductionSteps": [],
            "remediation": vulnerability.get("recommendation", "Apply vendor guidance and retest."),
            "status": "open",
            "timeline": [],
            "retestHistory": [],
        }


class DisconnectedAcunetixAdapter(AcunetixAdapter):
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def status(self) -> AcunetixState:
        configured = bool(self.settings.acunetix_base_url and self.settings.acunetix_api_key)
        return AcunetixState(
            configured=configured,
            connected=False,
            mode="disconnected",
            baseUrl=self.settings.acunetix_base_url,
            message="Acunetix is disconnected. Configure environment credentials or enable mock mode.",
        )

    def test_connection(self) -> AcunetixState:
        return self.status()

    def _unavailable(self) -> None:
        raise AppError(503, "acunetix_disconnected", self.status().message)

    def get_targets(self) -> list[dict[str, Any]]:
        self._unavailable()

    def synchronize_targets(self, targets: list[dict[str, Any]]) -> dict[str, Any]:
        self._unavailable()

    def start_scan(self, target: dict[str, Any], profile: str) -> dict[str, Any]:
        self._unavailable()

    def get_scan_status(self, scan_id: str) -> dict[str, Any]:
        self._unavailable()

    def stop_scan(self, scan_id: str) -> dict[str, Any]:
        self._unavailable()

    def get_vulnerabilities(self, scan_id: str) -> list[dict[str, Any]]:
        self._unavailable()

    def get_reports(self, scan_id: str) -> list[dict[str, Any]]:
        self._unavailable()

    def download_report(self, report_id: str) -> bytes:
        self._unavailable()

    def get_live_vulnerabilities(self, limit: int = 8) -> list[dict[str, Any]]:
        self._unavailable()


class MockAcunetixAdapter(AcunetixAdapter):
    def __init__(self) -> None:
        self._scans: dict[str, dict[str, Any]] = {}

    def status(self) -> AcunetixState:
        return AcunetixState(
            configured=False,
            connected=True,
            mode="mock",
            message="Mock Acunetix adapter is connected; no external requests will be sent.",
        )

    def test_connection(self) -> AcunetixState:
        return self.status()

    def get_targets(self) -> list[dict[str, Any]]:
        return []

    def synchronize_targets(self, targets: list[dict[str, Any]]) -> dict[str, Any]:
        return {"mode": "mock", "synchronized": len(targets), "externalRequests": 0}

    def start_scan(self, target: dict[str, Any], profile: str) -> dict[str, Any]:
        scan_id = f"acx_{uuid.uuid4()}"
        scan = {"id": scan_id, "targetId": target["id"], "profile": profile, "status": "running", "progress": 25}
        self._scans[scan_id] = scan
        return scan

    def get_scan_status(self, scan_id: str) -> dict[str, Any]:
        return self._scans.get(scan_id, {"id": scan_id, "status": "not_found"})

    def stop_scan(self, scan_id: str) -> dict[str, Any]:
        scan = self._scans.get(scan_id, {"id": scan_id})
        scan.update({"status": "cancelled"})
        self._scans[scan_id] = scan
        return scan

    def get_vulnerabilities(self, scan_id: str) -> list[dict[str, Any]]:
        if scan_id not in self._scans:
            return []
        return [
            {
                "vulnId": f"{scan_id}:headers",
                "name": "Content Security Policy not configured",
                "vtName": "security_headers",
                "severity": 1,
                "confidence": 92,
                "description": "The mock response did not include a Content-Security-Policy header.",
                "impact": "Browser-side injection defenses may be weaker.",
                "recommendation": "Deploy and test a restrictive Content-Security-Policy.",
            }
        ]

    def get_reports(self, scan_id: str) -> list[dict[str, Any]]:
        return [{"scanId": scan_id, "status": "mock", "available": False}]

    def download_report(self, report_id: str) -> bytes:
        raise AppError(503, "acunetix_disconnected", "Report download is unavailable in mock mode.")

    def get_live_vulnerabilities(self, limit: int = 8) -> list[dict[str, Any]]:
        return []


class RealAcunetixAdapter(AcunetixAdapter):
    """Full REST API v1 client for a real Acunetix instance (external integration).

    Activated when SCANNER_MOCK_MODE=false and ALLOW_EXTERNAL_INTEGRATIONS=true.
    All calls go to the configured Acunetix host; never run against targets you
    do not own or have explicit permission to test.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._base_url = (settings.acunetix_base_url or "").rstrip("/")
        self._profile_cache: dict[str, str] = {}

    def _configured(self) -> bool:
        return bool(self._base_url and self.settings.acunetix_api_key)

    def _client(self) -> httpx.Client:
        # Acunetix ships a self-signed certificate; this integration targets
        # local/dev instances, so TLS verification is intentionally disabled.
        return httpx.Client(
            base_url=self._base_url,
            headers={"X-Auth": self.settings.acunetix_api_key or ""},
            verify=False,
            timeout=httpx.Timeout(15.0, connect=5.0),
        )

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        if not self._configured():
            raise AppError(503, "acunetix_not_configured", "Acunetix base URL and API key are required.")
        try:
            with self._client() as client:
                response = client.request(method, path, **kwargs)
        except httpx.HTTPError as exc:
            raise AppError(502, "acunetix_unreachable", f"Acunetix request failed: {type(exc).__name__}") from exc
        if response.status_code >= 400:
            detail = response.text[:200]
            raise AppError(response.status_code, "acunetix_api_error", f"Acunetix API error: {detail}")
        if response.status_code == 204:
            return {}
        return response.json()

    def status(self) -> AcunetixState:
        return AcunetixState(
            configured=self._configured(),
            connected=self._configured(),
            mode="connected" if self._configured() else "disconnected",
            baseUrl=self.settings.acunetix_base_url,
            message="Connected to Acunetix; active scans are executed on the remote instance."
            if self._configured()
            else "Acunetix is not configured. Set ACUNETIX_BASE_URL and ACUNETIX_API_KEY.",
        )

    def test_connection(self) -> AcunetixState:
        if not self._configured():
            return self.status()
        try:
            me = self._request("GET", "/api/v1/me")
        except AppError as exc:
            return AcunetixState(
                configured=True,
                connected=False,
                mode="configured_disconnected",
                baseUrl=self.settings.acunetix_base_url,
                message=f"Connection test failed: {exc.message}",
            )
        return AcunetixState(
            configured=True,
            connected=True,
            mode="connected",
            baseUrl=self.settings.acunetix_base_url,
            message=f"Connected to Acunetix as {me.get('email', 'API user')}.",
        )

    def get_targets(self) -> list[dict[str, Any]]:
        data = self._request("GET", "/api/v1/targets")
        return [
            {
                "id": target.get("target_id"),
                "address": target.get("address"),
                "description": target.get("description"),
                "criticality": target.get("criticality"),
                "state": target.get("state"),
            }
            for target in data.get("targets", [])
        ]

    def _find_or_create_target(self, target: dict[str, Any]) -> str:
        address = str(target.get("address", "")).strip()
        data = self._request("GET", "/api/v1/targets")
        for existing in data.get("targets", []):
            if str(existing.get("address", "")).strip() == address:
                return existing["target_id"]
        created = self._request(
            "POST",
            "/api/v1/targets",
            json={
                "address": address,
                "description": str(target.get("description", "PAN synchronized target"))[:255],
                "criticality": 10,
                "sensitive": False,
            },
        )
        return created["target_id"]

    def synchronize_targets(self, targets: list[dict[str, Any]]) -> dict[str, Any]:
        created = 0
        synchronized = 0
        for target in targets:
            target_id = self._find_or_create_target(target)
            if target_id:
                synchronized += 1
                created += 1  # best-effort count; Acunetix does not report create vs. existing here
        return {
            "mode": "connected",
            "synchronized": synchronized,
            "externalRequests": len(targets) * 2,
        }

    def _profile_id(self, profile_name: str) -> str:
        if not self._profile_cache:
            data = self._request("GET", "/api/v1/scanning_profiles")
            self._profile_cache = {p.get("name", ""): p["profile_id"] for p in data.get("scanning_profiles", [])}
        names = {
            "full_scan": "Full Scan",
            "safe": "Critical / High Risk",
            "balanced": "Full Scan",
            "api_focused": "Full Scan",
            "quick": "Quick Scan",
        }
        wanted = names.get(profile_name, "Full Scan")
        if wanted in self._profile_cache:
            return self._profile_cache[wanted]
        return next(iter(self._profile_cache.values()), "")

    def start_scan(self, target: dict[str, Any], profile: str) -> dict[str, Any]:
        target_id = self._find_or_create_target(target)
        profile_id = self._profile_id(profile)
        created = self._request(
            "POST",
            "/api/v1/scans",
            json={
                "target_id": target_id,
                "profile_id": profile_id,
                "schedule": {"disable": False, "start_date": None, "time_sensitive": False},
                "max_scan_time": 0,
            },
        )
        return {"id": created.get("scan_id", ""), "status": "running", "progress": 0}

    def get_scan_status(self, scan_id: str) -> dict[str, Any]:
        data = self._request("GET", f"/api/v1/scans/{scan_id}")
        session = data.get("current_session") or {}
        last_session = data.get("last_session") or {}
        acx_status = str(
            session.get("status")
            or last_session.get("status")
            or data.get("status")
            or ""
        ).lower()
        status_map = {
            "queued": "queued",
            "scheduled": "queued",
            "processing": "running",
            "crawling": "running",
            "running": "running",
            "paused": "paused",
            "stopping": "cancelling",
            "aborted": "cancelled",
            "failed": "failed",
            "completed": "completed",
        }
        progress = int(session.get("progress", 0) or 0)
        if status_map.get(acx_status) == "completed":
            progress = 100
        return {
            "id": scan_id,
            "status": status_map.get(acx_status, "queued"),
            "providerStatus": acx_status,
            "progress": progress,
            "severity": session.get("severity"),
            "eventLogId": session.get("event_log_id"),
        }

    def stop_scan(self, scan_id: str) -> dict[str, Any]:
        data = self._request("POST", f"/api/v1/scans/{scan_id}/abort")
        return {"id": scan_id, "status": str(data.get("status", "aborted")).lower()}

    def get_vulnerabilities(self, scan_id: str) -> list[dict[str, Any]]:
        data = self._request("GET", f"/api/v1/scans/{scan_id}/results")
        results = data.get("results", [])
        vulnerabilities: list[dict[str, Any]] = []
        for result in results:
            result_id = result.get("result_id")
            if not result_id:
                continue
            index = 0
            while True:
                page = self._request(
                    "GET",
                    f"/api/v1/results/{result_id}/vulnerabilities",
                    params={"l": 100, "start_index": index},
                )
                items = page.get("vulnerabilities", [])
                vulnerabilities.extend(items)
                index += len(items)
                if len(items) < 100:
                    break
        return [
            {
                "vulnId": v.get("vuln_id"),
                "name": v.get("vt_name") or v.get("name", "Acunetix observation"),
                "vtName": v.get("vt_id", "acunetix"),
                "severity": int(v.get("severity", 2) or 2),
                "confidence": int(v.get("confidence", 80) or 80),
                "cwe": v.get("cwe"),
                "owasp": v.get("owasp"),
                "description": v.get("detail"),
                "impact": v.get("impact"),
                "recommendation": v.get("recommendation"),
                "method": v.get("method", "GET"),
                "parameter": v.get("parameter"),
                "reproductionSteps": v.get("reproduction_steps", ""),
            }
            for v in vulnerabilities
        ]

    def get_reports(self, scan_id: str) -> list[dict[str, Any]]:
        templates = self._request("GET", "/api/v1/report_templates").get("templates", [])
        wanted = next((t for t in templates if "Affected Items" in t.get("name", "")), None)
        template = wanted or (templates[0] if templates else None)
        if not template:
            return [{"scanId": scan_id, "status": "unavailable", "available": False}]
        created = self._request(
            "POST",
            "/api/v1/reports",
            json={
                "template_id": template["template_id"],
                "source": {"list_type": "scans", "id_list": [scan_id]},
                "report_format": "html",
                "report_name": f"PAN-{scan_id[:12]}",
            },
        )
        report_id = created.get("report_id", "")
        status = "processing"
        available = False
        if report_id:
            try:
                state = self._request("GET", f"/api/v1/reports/{report_id}")
                status = str(state.get("status", "processing")).lower()
                available = status == "completed"
            except AppError:
                status = "processing"
        return [
            {
                "scanId": scan_id,
                "reportId": report_id,
                "status": status,
                "available": available,
                "downloadUrl": f"/api/v1/reports/download/{report_id}" if report_id else None,
            }
        ]

    def download_report(self, report_id: str) -> bytes:
        if not self._configured():
            raise AppError(503, "acunetix_not_configured", "Acunetix base URL and API key are required.")
        try:
            with self._client() as client:
                response = client.get(f"/api/v1/reports/download/{report_id}")
        except httpx.HTTPError as exc:
            raise AppError(502, "acunetix_unreachable", f"Acunetix request failed: {type(exc).__name__}") from exc
        if response.status_code >= 400:
            raise AppError(response.status_code, "acunetix_api_error", f"Acunetix report download failed ({response.status_code})")
        return response.content

    def get_live_vulnerabilities(self, limit: int = 8) -> list[dict[str, Any]]:
        """Recent vulnerabilities straight from the Acunetix instance (no PAN
        scan records required) - used by the bug-hunter live feed."""
        scans = self._request("GET", "/api/v1/scans", params={"l": 5}).get("scans", [])
        vulnerabilities: list[dict[str, Any]] = []
        for scan in scans[:3]:
            scan_id = scan.get("scan_id")
            target_address = ((scan.get("target") or {}).get("address") or "?").rstrip("/")
            if not scan_id:
                continue
            try:
                results = self._request("GET", f"/api/v1/scans/{scan_id}/results").get("results", [])
            except AppError:
                continue
            for result in results[:2]:
                result_id = result.get("result_id")
                if not result_id:
                    continue
                try:
                    page = self._request("GET", f"/api/v1/results/{result_id}/vulnerabilities", params={"l": limit, "start_index": 0})
                except AppError:
                    continue
                for vuln in page.get("vulnerabilities", []):
                    vulnerabilities.append({
                        "vulnId": vuln.get("vuln_id"),
                        "name": vuln.get("vt_name") or vuln.get("name", "Acunetix observation"),
                        "severity": int(vuln.get("severity", 2) or 2),
                        "confidence": int(vuln.get("confidence", 80) or 80),
                        "cwe": vuln.get("cwe"),
                        "owasp": vuln.get("owasp"),
                        "cvss": self._cvss_score(vuln),
                        "method": vuln.get("method", "GET"),
                        "parameter": vuln.get("parameter"),
                        "target": target_address,
                        "scanId": scan_id,
                        "resultId": result_id,
                    })
                if len(vulnerabilities) >= limit:
                    return vulnerabilities[:limit]
        return vulnerabilities[:limit]

    @staticmethod
    def _cvss_score(vuln: dict[str, Any]) -> str:
        for key in ("cvss3", "cvss2", "cvss"):
            value = vuln.get(key)
            if isinstance(value, dict):
                score = value.get("score")
                if score is not None:
                    return str(score)
            elif isinstance(value, (int, float)):
                return str(value)
        return "—"


class AcunetixSyncPoller:
    """Best-effort background sync of live Acunetix scan progress into the JSON
    repositories so the scans list shows the remote state. Only active when the
    real adapter is configured (never in mock/disconnected mode)."""

    def __init__(self, repositories: Any, adapter: AcunetixAdapter, interval: float = 15.0) -> None:
        self.repositories = repositories
        self.adapter = adapter
        self.interval = interval
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if not isinstance(self.adapter, RealAcunetixAdapter):
            return
        self._thread = threading.Thread(target=self._loop, name="pan-acunetix-sync", daemon=True)
        self._thread.start()
        logger.info("acunetix sync poller started (interval=%ss)", self.interval)

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        while not self._stop.wait(self.interval):
            try:
                self._sync_once()
            except Exception:  # noqa: BLE001 - a failed poll must never kill the app
                logger.exception("acunetix sync poll failed")

    def _sync_once(self) -> None:
        for scan in self.repositories["scans"].get_all():
            reference = getattr(scan, "external_reference", None) or {}
            if reference.get("provider") != "acunetix":
                continue
            if getattr(scan, "status", "") not in ("queued", "running", "paused", "cancelling"):
                continue
            try:
                status = self.adapter.get_scan_status(str(reference["id"]))
            except AppError as exc:
                logger.warning("acunetix poll scan=%s failed: %s", scan.id, exc.message)
                continue
            updates: dict[str, Any] = {
                "progress": status.get("progress", getattr(scan, "progress", 0)),
                "status": status.get("status", getattr(scan, "status", "queued")),
            }
            if status.get("status") in ("completed", "cancelled", "failed"):
                updates["completedAt"] = datetime.now(timezone.utc)
            self.repositories["scans"].update(scan.id, updates)


def build_acunetix_adapter(settings: Settings) -> AcunetixAdapter:
    if settings.scanner_mock_mode:
        return MockAcunetixAdapter()
    if settings.allow_external_integrations:
        return RealAcunetixAdapter(settings)
    return DisconnectedAcunetixAdapter(settings)

