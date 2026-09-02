from __future__ import annotations

from app.scanners.base import ScannerAdapter, ScannerResult, ScannerTask


class DisabledExternalAdapter(ScannerAdapter):
    """Interface placeholder for a locally installed scanner.

    PAN's hackathon backend intentionally never invokes scanner binaries. A future
    worker may implement this boundary using an allowlisted executable and an
    argument array with `shell=False`; route handlers must never pass raw user input
    to a subprocess.
    """

    def __init__(self, slug: str, description: str) -> None:
        self.slug = slug
        self.description = description

    def run(self, task: ScannerTask) -> ScannerResult:
        return ScannerResult(
            adapter=self.slug,
            task_id=task.task_id,
            status="disabled",
            progress=0,
            warnings=["External scanner execution is disabled in this safe MVP."],
        )


SPECIALIST_INTERFACES: dict[str, ScannerAdapter] = {
    "xss": DisabledExternalAdapter("dalfox", "XSS detection with optional browser verification"),
    "sqli": DisabledExternalAdapter("sqlmap", "Non-destructive SQL injection detection"),
    "api": DisabledExternalAdapter("schemathesis", "Schema-driven API checks"),
    "secrets": DisabledExternalAdapter("gitleaks", "Response and repository secret pattern checks"),
    "misconfigurations": DisabledExternalAdapter("nuclei", "Configuration templates"),
    "cves": DisabledExternalAdapter("nuclei-cves", "Curated non-destructive CVE templates"),
}

