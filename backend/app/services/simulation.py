from __future__ import annotations

import random
import threading
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import urlsplit

from app.config import Settings
from app.models.domain import JobStatus
from app.repositories.json_repository import RepositoryNotFoundError
from app.repositories.registry import RepositoryRegistry
from app.scanners.base import ScannerTask
from app.scanners.mock import ADAPTERS


SCAN_PHASES = [
    "scope_validation",
    "reconnaissance",
    "endpoint_discovery",
    "passive_analysis",
    "active_testing",
    "verification",
    "ai_analysis",
    "report_generation",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class _JobStopped(Exception):
    pass


class _JobPaused(Exception):
    pass


class MockJobRunner:
    """Small in-process simulator used only for hackathon/demo mode."""

    def __init__(self, repositories: RepositoryRegistry, settings: Settings) -> None:
        self.repositories = repositories
        self.settings = settings
        self._threads: dict[str, threading.Thread] = {}
        self._shutdown = threading.Event()
        self._guard = threading.Lock()
        self._scheduled_scans: dict[str, datetime] = {}
        self._schedule_changed = threading.Event()

    def _spawn(self, key: str, function: object, *args: object, force: bool = False) -> None:
        if not self.settings.scanner_mock_mode and not force:
            return
        with self._guard:
            current = self._threads.get(key)
            if current and current.is_alive():
                return
            thread = threading.Thread(target=function, args=args, daemon=True, name=f"pan-mock-{key}")
            self._threads[key] = thread
            thread.start()

    def start_scan(self, scan_id: str, *, resume: bool = False) -> None:
        force_surface = False
        try:
            scan = self.repositories["scans"].require(scan_id)
            force_surface = "surface" in (scan.modules or [])
        except Exception:  # noqa: BLE001
            pass
        self._spawn(f"scan-{scan_id}", self._run_scan, scan_id, resume, force=force_surface)

    def schedule_scan(self, scan_id: str, scheduled_at: datetime) -> None:
        if not self.settings.scanner_mock_mode:
            return
        with self._guard:
            self._scheduled_scans[scan_id] = scheduled_at
            scheduler = self._threads.get("scheduler")
            if not scheduler or not scheduler.is_alive():
                scheduler = threading.Thread(
                    target=self._run_scheduler,
                    daemon=True,
                    name="pan-mock-scheduler",
                )
                self._threads["scheduler"] = scheduler
                scheduler.start()
        self._schedule_changed.set()

    def recover_scheduled_scans(self) -> None:
        if not self.settings.scanner_mock_mode:
            return
        for scan in self.repositories["scans"].filter(status="queued"):
            if scan.scheduled_at:
                self.schedule_scan(scan.id, scan.scheduled_at)

    def recover_running_scans(self) -> None:
        """Resume scans left 'running' by a previous process (in-memory threads die on restart)."""
        if not self.settings.scanner_mock_mode:
            return
        for scan in self.repositories["scans"].filter(status="running"):
            self.start_scan(scan.id, resume=True)

    def start_demo_autopilot(self) -> None:
        """Keep demo life moving: if nothing is running, queue a fresh mock scan."""
        if not self.settings.scanner_mock_mode:
            return

        scan_names = [
            "Automated night sweep",
            "API security pulse",
            "Recon + passive review",
            "XSS & SQLi spot check",
            "Post-deploy quick scan",
            "Compliance baseline scan",
        ]
        profiles = ["balanced", "full", "api_focused"]
        modules_pool = [["recon", "passive"], ["xss", "sqli", "api"], ["recon", "passive", "xss", "api"], ["passive", "api", "secrets"]]

        def loop() -> None:
            while not self._shutdown.is_set():
                try:
                    running = self.repositories["scans"].filter(status="running")
                    queued = self.repositories["scans"].filter(status="queued")
                    if running:
                        self._shutdown.wait(6)
                        continue
                    if queued:
                        self.start_scan(queued[0].id)
                        self._shutdown.wait(30)
                        continue
                    # Cap growth: at most 40 auto-scans per hour.
                    now = datetime.now(timezone.utc)
                    recent = [s for s in self.repositories["scans"].get_all() if getattr(s, "created_at", now) is not None and (now - s.created_at).total_seconds() < 3600]
                    if len(recent) < 40:
                        targets = self.repositories["targets"].get_all()
                        users = self.repositories["users"].get_all()
                        if targets and users:
                            target = random.choice(targets)
                            user = next((u for u in users if getattr(u, "role", None) == "admin"), users[0])
                            self.repositories["scans"].create(
                                {
                                    "workspaceId": target.workspace_id,
                                    "targetId": target.id,
                                    "name": f"{random.choice(scan_names)} #{random.randint(100, 999)}",
                                    "profile": random.choice(profiles),
                                    "modules": random.choice(modules_pool),
                                    "speed": "balanced",
                                    "requestLimit": random.randint(600, 1200),
                                    "concurrency": 2,
                                    "status": "queued",
                                    "progress": 0,
                                    "currentPhase": "scope_validation",
                                    "createdBy": user.id,
                                }
                            )
                    self._shutdown.wait(10)
                except Exception:  # noqa: BLE001
                    self._shutdown.wait(10)

        thread = threading.Thread(target=loop, daemon=True, name="pan-demo-autopilot")
        self._threads["autopilot"] = thread
        thread.start()

    def cancel_scheduled_scan(self, scan_id: str) -> None:
        with self._guard:
            self._scheduled_scans.pop(scan_id, None)
        self._schedule_changed.set()

    def start_recon(self, recon_id: str) -> None:
        self._spawn(f"recon-{recon_id}", self._run_recon, recon_id)

    def start_retest(self, finding_id: str, retest_id: str) -> None:
        self._spawn(f"retest-{retest_id}", self._run_retest, finding_id, retest_id)

    def _sleep(self) -> None:
        self._shutdown.wait(max(0.01, self.settings.scanner_step_seconds))

    def _scan_event(self, scan: object, phase: str, message: str, progress: int, level: str = "info") -> None:
        self.repositories["scan_events"].create(
            {
                "workspaceId": getattr(scan, "workspace_id"),
                "scanId": getattr(scan, "id"),
                "level": level,
                "phase": phase,
                "message": message,
                "progress": progress,
            }
        )

    def _run_scheduler(self) -> None:
        while not self._shutdown.is_set():
            with self._guard:
                scheduled = list(self._scheduled_scans.items())
            if not scheduled:
                self._schedule_changed.wait(30)
                self._schedule_changed.clear()
                continue
            now = datetime.now(timezone.utc)
            due = [scan_id for scan_id, scheduled_at in scheduled if scheduled_at <= now]
            if due:
                with self._guard:
                    for scan_id in due:
                        self._scheduled_scans.pop(scan_id, None)
                for scan_id in due:
                    self.start_scan(scan_id)
                continue
            wait_seconds = min((scheduled_at - now).total_seconds() for _, scheduled_at in scheduled)
            self._schedule_changed.wait(max(0.01, min(wait_seconds, 30)))
            self._schedule_changed.clear()

    def _run_scan(self, scan_id: str, resume: bool = False) -> None:
        scans = self.repositories["scans"]
        started_monotonic = time.monotonic()
        try:
            def claim(current: dict[str, object]) -> dict[str, object]:
                state = current.get("status")
                if state == JobStatus.QUEUED:
                    return {"status": "running", "startedAt": current.get("startedAt") or _now()}
                if resume and state == JobStatus.RUNNING:
                    return {}
                raise _JobStopped

            scan = scans.transact(scan_id, claim)
            self._scan_event(scan, "scope_validation", "Authorized scope validated; mock scan started.", 1)
            if "surface" in (scan.modules or []) and not resume:
                self._run_surface_scan(scan, scan_id)
                return
            start_index = 0
            if resume:
                current_phase = getattr(scan, "current_phase", None)
                if current_phase in SCAN_PHASES:
                    start_index = min(SCAN_PHASES.index(current_phase) + 1, len(SCAN_PHASES))
            for index, phase in enumerate(SCAN_PHASES):
                if index < start_index:
                    continue
                if self._shutdown.is_set():
                    return
                if time.monotonic() - started_monotonic >= self.settings.scanner_timeout_seconds:
                    def timeout(current: dict[str, object]) -> dict[str, object]:
                        if current.get("status") in {"cancelled", "completed", "failed"}:
                            raise _JobStopped
                        return {
                            "status": "failed",
                            "completedAt": _now(),
                            "error": "Mock scan exceeded the configured scanner timeout.",
                        }

                    failed = scans.transact(scan_id, timeout)
                    self._scan_event(failed, phase, "Scan stopped at the configured timeout.", failed.progress, "error")
                    return
                while True:
                    progress = min(96, 5 + index * 12)

                    def advance(current: dict[str, object]) -> dict[str, object]:
                        state = current.get("status")
                        if state == JobStatus.PAUSED:
                            raise _JobPaused
                        if state != JobStatus.RUNNING:
                            raise _JobStopped
                        stats = dict(current.get("statistics", {}))
                        stats.update(
                            {
                                "assetsFound": max(int(stats.get("assetsFound", 0)), min(index + 1, 4)),
                                "endpointsFound": max(int(stats.get("endpointsFound", 0)), index * 7),
                                "parametersTested": max(int(stats.get("parametersTested", 0)), index * 5),
                                "requestsSent": min(
                                    int(current.get("requestLimit", 0)),
                                    max(int(stats.get("requestsSent", 0)), index * 53),
                                ),
                                "candidateFindings": max(
                                    int(stats.get("candidateFindings", 0)), 1 if index >= 4 else 0
                                ),
                            }
                        )
                        return {
                            "currentPhase": phase,
                            "progress": progress,
                            "statistics": stats,
                        }

                    try:
                        current = scans.transact(scan_id, advance)
                        break
                    except _JobPaused:
                        self._sleep()
                        if self._shutdown.is_set():
                            return
                self._scan_event(current, phase, f"Mock phase {phase.replace('_', ' ')} completed.", progress)
                self._sleep()

            def complete(current: dict[str, object]) -> dict[str, object]:
                if current.get("status") != JobStatus.RUNNING:
                    raise _JobStopped
                return {
                    "status": "completed",
                    "progress": 100,
                    "currentPhase": "report_generation",
                    "completedAt": _now(),
                }

            current = scans.transact(scan_id, complete)
            self._scan_event(current, "report_generation", "Mock scan completed safely without network traffic.", 100)
        except (RepositoryNotFoundError, _JobStopped):
            return
        except Exception as exc:  # defensive boundary for background execution
            try:
                def fail(current: dict[str, object]) -> dict[str, object]:
                    if current.get("status") in {"cancelled", "completed", "failed"}:
                        raise _JobStopped
                    return {
                        "status": "failed",
                        "completedAt": _now(),
                        "error": f"Mock worker error: {type(exc).__name__}",
                    }

                failed = scans.transact(scan_id, fail)
                self._scan_event(failed, failed.current_phase, "Mock scan failed.", failed.progress, "error")
            except Exception:
                pass

    def _run_surface_scan(self, scan: object, scan_id: str) -> None:
        """Run the real passive Surface Finder engine for a surface scan."""
        import json
        import math

        from app.scanners.surface_finder import find_surface

        scans = self.repositories["scans"]
        started_monotonic = time.monotonic()
        log_count = 0
        target = None
        try:
            target = self.repositories["targets"].require(getattr(scan, "target_id"))
        except Exception:  # noqa: BLE001
            target = None
        domain = getattr(target, "domain", None) if target is not None else None

        self._scan_event(scan, "surface_discovery", f"Surface discovery queued for {domain or 'target domain'}.", 2)

        def on_log(line: str) -> None:
            nonlocal log_count
            log_count += 1
            progress = min(94, round(100 * (1 - math.exp(-log_count / 14))))

            def advance(current: dict[str, object]) -> dict[str, object]:
                state = current.get("status")
                if state == JobStatus.PAUSED:
                    raise _JobPaused
                if state != JobStatus.RUNNING:
                    raise _JobStopped
                return {
                    "currentPhase": "surface_discovery",
                    "progress": progress,
                    "statistics": {
                        "assetsFound": progress // 6,
                        "endpointsFound": progress * 3,
                        "candidateFindings": 1 if progress >= 70 else 0,
                    },
                }

            try:
                current = scans.transact(scan_id, advance)
                self._scan_event(current, "surface_discovery", line, progress)
            except _JobPaused:
                # hold until resumed or cancelled
                while not self._shutdown.is_set():
                    self._sleep()
                    try:
                        latest = scans.require(scan_id)
                    except RepositoryNotFoundError:
                        return
                    if latest.status == JobStatus.RUNNING:
                        return
                    if latest.status not in {JobStatus.PAUSED, JobStatus.RUNNING}:
                        raise _JobStopped
            except _JobStopped:
                raise

        result: dict[str, object] | None = None
        try:
            result = find_surface(
                domain,
                github_token=self.settings.github_api_key,
                timeout=6.0,
                probe_subdomains=True,
                on_log=on_log,
            )
        except _JobStopped:
            return
        except Exception as exc:  # noqa: BLE001 - defensive boundary for background execution
            def fail(current: dict[str, object]) -> dict[str, object]:
                if current.get("status") in {"cancelled", "completed", "failed"}:
                    raise _JobStopped
                return {"status": "failed", "completedAt": _now(), "error": f"Surface scan error: {type(exc).__name__}"}

            try:
                failed = scans.transact(scan_id, fail)
                self._scan_event(failed, "surface_discovery", f"Surface discovery failed: {type(exc).__name__}", failed.progress, "error")
            except (RepositoryNotFoundError, _JobStopped):
                pass
            return

        if result is None or result.get("errors"):
            warnings = result.get("errors", []) if result else ["Surface discovery returned no usable result."]

        # persist full result next to evidence (keeps the scans collection light)
        evidence_path = self.settings.evidence_directory / "scans"
        evidence_path.mkdir(parents=True, exist_ok=True)
        try:
            (evidence_path / f"{scan_id}.json").write_text(json.dumps(result), encoding="utf-8")
        except Exception:  # noqa: BLE001
            pass

        summary = (result or {}).get("summary", {})
        assets = (result or {}).get("assets", [])

        def complete(current: dict[str, object]) -> dict[str, object]:
            if current.get("status") != JobStatus.RUNNING:
                raise _JobStopped
            return {
                "status": "completed",
                "progress": 100,
                "currentPhase": "report_generation",
                "completedAt": _now(),
                "externalReference": {
                    "kind": "surface",
                    "domain": domain,
                    "assetTotal": summary.get("assetTotal", len(assets)),
                    "relationshipCount": summary.get("relationshipCount", 0),
                    "riskScore": summary.get("riskScore"),
                    "findingCount": sum((summary.get("findingCounts") or {}).values()) if isinstance(summary.get("findingCounts"), dict) else 0,
                },
                "statistics": {
                    "assetsFound": summary.get("assetTotal", len(assets)),
                    "endpointsFound": sum(1 for asset in assets if asset.get("type") == "url"),
                    "parametersTested": 0,
                    "requestsSent": min(int(getattr(scan, "request_limit", 0) or 0), len(result.get("log", [])) * 12),
                    "candidateFindings": sum((summary.get("findingCounts") or {}).values()) if isinstance(summary.get("findingCounts"), dict) else 0,
                    "confirmedFindings": 0,
                },
            }

        try:
            current = scans.transact(scan_id, complete)
            self._scan_event(
                current,
                "report_generation",
                f"Surface discovery completed — {summary.get('assetTotal', len(assets))} assets, {summary.get('relationshipCount', 0)} relationships.",
                100,
            )
        except (RepositoryNotFoundError, _JobStopped):
            return

    def _run_recon(self, recon_id: str) -> None:
        recon_jobs = self.repositories["recon_jobs"]
        try:
            def claim(current: dict[str, object]) -> dict[str, object]:
                if current.get("status") != "queued":
                    raise _JobStopped
                return {"status": "running", "startedAt": current.get("startedAt") or _now()}

            job = recon_jobs.transact(recon_id, claim)
            target = self.repositories["targets"].require(job.target_id)
            all_logs = list(job.logs)
            for index, module in enumerate(job.modules):
                if self._shutdown.is_set():
                    return
                current = recon_jobs.require(recon_id)
                if current.status != "running":
                    raise _JobStopped
                adapter = ADAPTERS.get(module)
                if adapter is None:
                    all_logs.append(f"[{module}] skipped: adapter is not enabled")
                else:
                    result = adapter.run(
                        ScannerTask(
                            taskId=recon_id,
                            targetId=target.id,
                            workspaceId=target.workspace_id,
                            baseUrl=target.base_url,
                            scope=target.scope,
                            timeoutSeconds=min(self.settings.scanner_timeout_seconds, 3600),
                        )
                    )
                    all_logs.extend(result.logs)
                progress = min(95, int(((index + 1) / len(job.modules)) * 90))
                def advance(latest: dict[str, object]) -> dict[str, object]:
                    if latest.get("status") != "running":
                        raise _JobStopped
                    return {
                        "progress": progress,
                        "currentModule": module,
                        "logs": all_logs[-100:],
                        "statistics": {
                            "assetsFound": min(index + 1, 3),
                            "endpointsFound": (index + 1) * 4,
                        },
                    }

                job = recon_jobs.transact(recon_id, advance)
                self._sleep()
            if recon_jobs.require(recon_id).status != "running":
                raise _JobStopped
            self._materialize_recon_inventory(job, target)

            def complete(current: dict[str, object]) -> dict[str, object]:
                if current.get("status") != "running":
                    raise _JobStopped
                return {
                    "status": "completed",
                    "progress": 100,
                    "completedAt": _now(),
                    "logs": (all_logs + ["Recon simulation completed; no network traffic was sent."])[-100:],
                }

            recon_jobs.transact(recon_id, complete)
        except (RepositoryNotFoundError, _JobStopped):
            return
        except Exception as exc:
            try:
                def fail(current: dict[str, object]) -> dict[str, object]:
                    if current.get("status") in {"cancelled", "completed", "failed"}:
                        raise _JobStopped
                    return {
                        "status": "failed",
                        "completedAt": _now(),
                        "error": f"Mock worker error: {type(exc).__name__}",
                    }

                recon_jobs.transact(recon_id, fail)
            except Exception:
                pass

    def _materialize_recon_inventory(self, job: object, target: object) -> None:
        start_url = str(getattr(job, "start_url", None) or getattr(target, "base_url"))
        parsed = urlsplit(start_url)
        hostname = parsed.hostname or getattr(target, "domain")
        protocol = parsed.scheme
        port = parsed.port or (443 if protocol == "https" else 80)
        normalized_path = parsed.path or "/"
        existing_assets = self.repositories["assets"].filter(target_id=getattr(target, "id"))
        asset = next(
            (
                item
                for item in existing_assets
                if item.hostname == hostname and item.port == port and item.protocol == protocol
            ),
            None,
        )
        if asset is None:
            asset = self.repositories["assets"].create(
                {
                    "workspaceId": getattr(target, "workspace_id"),
                    "targetId": getattr(target, "id"),
                    "hostname": hostname,
                    "domain": getattr(target, "domain"),
                    "ip": None,
                    "port": port,
                    "protocol": protocol,
                    "httpStatus": 200,
                    "pageTitle": "Authorized application (mock)",
                    "technologies": ["nginx", "React"],
                    "tls": {"valid": True, "source": "mock"},
                    "screenshot": None,
                    "discoverySource": "mock_recon",
                    "riskState": "review",
                }
            )
        existing_endpoints = self.repositories["endpoints"].filter(target_id=getattr(target, "id"))
        if not any(str(item.url) == start_url and item.method == "GET" for item in existing_endpoints):
            self.repositories["endpoints"].create(
                {
                    "workspaceId": getattr(target, "workspace_id"),
                    "targetId": getattr(target, "id"),
                    "assetId": asset.id,
                    "url": start_url,
                    "normalizedPath": normalized_path,
                    "method": "GET",
                    "contentType": "application/json",
                    "parameters": [],
                    "authenticationRequired": False,
                    "discoverySource": "mock_recon",
                    "statusCode": 200,
                    "responseFingerprint": "mock:authorized-start-url:v1",
                    "testsCompleted": ["passive_headers"],
                    "kind": "api",
                }
            )

    def _run_retest(self, finding_id: str, retest_id: str) -> None:
        self._sleep()

        def finish(current: dict[str, object]) -> dict[str, object]:
            history = list(current.get("retestHistory", []))
            for entry in history:
                if entry.get("id") == retest_id:
                    entry.update(
                        {
                            "status": "completed",
                            "completedAt": _now(),
                            "outcome": "mock_completed_no_network",
                        }
                    )
            timeline = list(current.get("timeline", []))
            timeline.append(
                {
                    "timestamp": _now(),
                    "actorId": "system",
                    "action": "retest_completed",
                    "note": "Safe mock retest completed; verification state was not changed.",
                }
            )
            return {"retestHistory": history, "timeline": timeline}

        try:
            self.repositories["findings"].transact(finding_id, finish)
        except RepositoryNotFoundError:
            pass

    def stop_all(self) -> None:
        self._shutdown.set()
        self._schedule_changed.set()
        with self._guard:
            threads = list(self._threads.values())
        for thread in threads:
            thread.join(timeout=0.25)
