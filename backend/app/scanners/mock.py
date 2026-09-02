from __future__ import annotations

from urllib.parse import urlsplit

from app.scanners.base import ScannerAdapter, ScannerObservation, ScannerResult, ScannerTask
from app.utils.scope import host_matches, path_matches


def _host_allowed(task: ScannerTask, hostname: str) -> bool:
    scope = task.scope
    return (
        any(host_matches(hostname, included) for included in scope.included_hosts)
        and not any(host_matches(hostname, excluded) for excluded in scope.excluded_hosts)
    )


def _path_allowed(task: ScannerTask, path: str) -> bool:
    scope = task.scope
    return (
        any(path_matches(path, included) for included in scope.included_paths)
        and not any(path_matches(path, excluded) for excluded in scope.excluded_paths)
    )


class MockScannerAdapter(ScannerAdapter):
    def __init__(self, slug: str, description: str, observation_kind: str) -> None:
        self.slug = slug
        self.description = description
        self.observation_kind = observation_kind

    def run(self, task: ScannerTask) -> ScannerResult:
        parsed = urlsplit(str(task.base_url))
        hostname = parsed.hostname or "authorized.invalid"
        netloc = parsed.netloc
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        api_hostname = f"api.{hostname}"
        base_allowed = _host_allowed(task, hostname) and port in task.scope.allowed_ports
        endpoint_candidates = [
            (parsed.path or "/", f"{parsed.scheme}://{netloc}{parsed.path or '/'}"),
            ("/api/health", f"{parsed.scheme}://{netloc}/api/health"),
        ]
        endpoint_samples = [
            {"url": url, "method": "GET", "statusCode": 200}
            for path, url in endpoint_candidates
            if base_allowed and _path_allowed(task, path)
        ]
        samples = {
            "subdomain": [
                {"hostname": candidate, "source": self.slug}
                for candidate in (hostname, api_hostname)
                if _host_allowed(task, candidate)
            ],
            "live_host": [
                {"hostname": hostname, "protocol": parsed.scheme, "statusCode": 200},
            ] if base_allowed else [],
            "port": (
                [{"hostname": hostname, "port": port, "state": "open"}]
                if base_allowed
                else []
            ),
            "endpoint": endpoint_samples,
            "javascript_endpoint": (
                [{"url": f"{parsed.scheme}://{netloc}/api/v1/profile", "sourceFile": "/assets/app.js"}]
                if base_allowed and _path_allowed(task, "/api/v1/profile")
                else []
            ),
            "technology": (
                [{"hostname": hostname, "technologies": ["nginx", "React"]}] if base_allowed else []
            ),
            "screenshot": (
                [{"hostname": hostname, "status": "mocked", "file": None}] if base_allowed else []
            ),
        }
        observations = [
            ScannerObservation(kind=self.observation_kind, source=self.slug, data=value)
            for value in samples.get(self.observation_kind, [])
        ]
        return ScannerResult(
            adapter=self.slug,
            task_id=task.task_id,
            status="completed",
            observations=observations,
            logs=[
                f"[{self.slug}] accepted validated authorized task {task.task_id}",
                f"[{self.slug}] mock mode produced {len(observations)} structured observations",
            ],
            warnings=["Mock mode: no network requests or external scanner commands were executed."],
        )


ADAPTERS: dict[str, ScannerAdapter] = {
    "subdomains": MockScannerAdapter("subfinder", "Passive subdomain discovery", "subdomain"),
    "live_hosts": MockScannerAdapter("httpx", "Authorized HTTP service probing", "live_host"),
    "ports": MockScannerAdapter("naabu", "Authorized port discovery", "port"),
    "url_discovery": MockScannerAdapter("katana", "In-scope URL crawling", "endpoint"),
    "web_archive": MockScannerAdapter("wayback", "Historical URL collection", "endpoint"),
    "javascript": MockScannerAdapter("javascript", "JavaScript route extraction", "javascript_endpoint"),
    "technologies": MockScannerAdapter("technology", "Technology fingerprinting", "technology"),
    "screenshots": MockScannerAdapter("screenshot", "Visual asset inventory", "screenshot"),
}
