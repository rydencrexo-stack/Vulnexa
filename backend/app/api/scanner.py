from __future__ import annotations

from fastapi import APIRouter, Request, status

from app.api.deps import AppSettings, CurrentUser, Repositories
from app.api.scans import create_scan
from app.schemas.requests import (
    NucleiScanRequest,
    OpenRedirectScanRequest,
    PassiveScanRequest,
    ScanCreate,
    SecretsScanRequest,
    SqliScanRequest,
    SsrfScanRequest,
    SstiScanRequest,
    XssScanRequest,
)
from app.scanners.adapters import SPECIALIST_INTERFACES
from app.utils.scope import is_public_address


router = APIRouter(prefix="/api/scanner", tags=["scanner"])

MODULES = {
    "passive": {
        "name": "Passive analysis",
        "description": "PAN response-header, cookie, TLS, and configuration rules.",
        "checks": ["headers", "cookies", "cors", "tls", "information_disclosure"],
        "engine": "PAN",
    },
    "active": {
        "name": "Active scanner",
        "description": "Active scanning is isolated in the Acunetix section.",
        "checks": ["acunetix_profiles"],
        "engine": "Acunetix",
        "redirect": "/active-scanner",
    },
    "xss": {"name": "XSS", "description": "Adapter-ready XSS checks.", "checks": ["reflected", "stored", "dom"], "engine": "Dalfox"},
    "sqli": {"name": "SQLi", "description": "Non-destructive SQL injection detection.", "checks": ["error", "boolean", "time_safe"], "engine": "SQLmap adapter"},
    "api": {"name": "API", "description": "Schema-driven API validation.", "checks": ["openapi", "postman", "schema"], "engine": "Schemathesis adapter"},
    "secrets": {"name": "Secrets", "description": "Sanitized response-pattern analysis.", "checks": ["tokens", "keys", "credentials"], "engine": "PAN/Gitleaks adapter"},
    "misconfigurations": {"name": "Misconfigurations", "description": "Curated configuration checks.", "checks": ["headers", "exposure", "defaults"], "engine": "PAN/Nuclei adapter"},
    "cves": {"name": "CVEs", "description": "Curated non-destructive CVE templates.", "checks": ["known_cves"], "engine": "Nuclei adapter"},
    "custom": {"name": "Custom", "description": "Admin-approved declarative checks only.", "checks": ["approved_templates"], "engine": "PAN"},
}


@router.get("/modules")
@router.get("/overview")
def list_modules(user: CurrentUser) -> dict[str, object]:
    return {
        "modules": [{"slug": slug, **definition} for slug, definition in MODULES.items()],
        "safetyWarning": "Only verified, authorized, in-scope targets may be scanned. Destructive exploitation is disabled.",
    }


@router.get("/{module}")
def module_detail(module: str, user: CurrentUser) -> dict[str, object]:
    from app.utils.errors import not_found

    definition = MODULES.get(module)
    if definition is None:
        raise not_found("Scanner module")
    adapter = SPECIALIST_INTERFACES.get(module)
    return {
        "slug": module,
        **definition,
        "adapterStatus": "mock" if module == "passive" else ("disabled_safe_mvp" if adapter else "mock"),
        "safetyWarning": "Authorized targets only; no destructive exploitation.",
    }


@router.post("/{module}/jobs", status_code=status.HTTP_202_ACCEPTED)
def start_module_job(
    module: str,
    payload: ScanCreate,
    request: Request,
    repositories: Repositories,
    settings: AppSettings,
    user: CurrentUser,
) -> object:
    from app.utils.errors import not_found

    if module not in MODULES or module == "active":
        raise not_found("Scanner module")
    specialized = payload.model_copy(update={"modules": [module]})
    return create_scan(specialized, request, repositories, settings, user)


@router.post("/passive/analyze")
def run_passive_analysis(
    payload: PassiveScanRequest,
    settings: AppSettings,
    user: CurrentUser,
) -> dict[str, object]:
    """Run the real passive web-analysis engine for a single domain.

    Sends no attack payloads: DNS resolution, HTTP header/cookie/TLS posture,
    CORS policy, info-disclosure patterns, and a small read-only set of
    well-known exposure probes. In cloud mode private/reserved destinations
    are rejected.
    """
    from app.scanners.passive_engine import scan_domain
    from app.utils.errors import unsafe

    if settings.cloud_mode and not is_public_address(payload.domain, resolve_dns=True):
        raise unsafe("Private, loopback, link-local, reserved, and special-use destinations are blocked in cloud mode")

    return scan_domain(
        payload.domain,
        timeout=8.0,
        probe_subdomains=payload.probe_subdomains,
    )


@router.post("/xss/analyze")
def run_xss_scan(
    payload: XssScanRequest,
    settings: AppSettings,
    user: CurrentUser,
) -> dict[str, object]:
    """Run the real Dalfox XSS scanner against a single authorized target.

    Returns normalized findings plus the exact CLI command and raw terminal
    output. The binary is discovered from DALFOX_PATH, the bundled
    ``backend/bin`` directory, or PATH; when missing the CLI preview is still
    returned so it can be run manually.
    """
    from app.scanners.xss_engine import normalize_target, run_dalfox
    from app.utils.errors import unsafe

    target = normalize_target(payload.target)
    host = target.split("://", 1)[1].split("/", 1)[0].split(":", 1)[0]
    if settings.cloud_mode and not is_public_address(host, resolve_dns=True):
        raise unsafe("Private, loopback, link-local, reserved, and special-use destinations are blocked in cloud mode")

    return run_dalfox(target, timeout=float(payload.timeout_seconds))


def _guard_host(settings: AppSettings, target: str) -> None:
    from app.scanners.xss_engine import normalize_target
    from app.utils.errors import unsafe

    normalized = normalize_target(target)
    host = normalized.split("://", 1)[1].split("/", 1)[0].split(":", 1)[0]
    if settings.cloud_mode and not is_public_address(host, resolve_dns=True):
        raise unsafe("Private, loopback, link-local, reserved, and special-use destinations are blocked in cloud mode")
    return normalized


@router.post("/open-redirect/analyze")
def run_open_redirect_scan(payload: OpenRedirectScanRequest, settings: AppSettings, user: CurrentUser) -> dict[str, object]:
    from app.scanners.open_redirect import scan_open_redirect

    url = _guard_host(settings, payload.target)
    return scan_open_redirect(url, parameter=payload.parameter, timeout=6.0)


@router.post("/secrets/analyze")
def run_secrets_scan(payload: SecretsScanRequest, settings: AppSettings, user: CurrentUser) -> dict[str, object]:
    from app.scanners.secrets_engine import scan_secrets

    url = _guard_host(settings, payload.target)
    return scan_secrets(url, timeout=8.0)


@router.post("/cves/analyze")
def run_nuclei_scan(payload: NucleiScanRequest, settings: AppSettings, user: CurrentUser) -> dict[str, object]:
    from app.scanners.tool_engines import scan_nuclei

    url = _guard_host(settings, payload.target)
    return scan_nuclei(url, severity=payload.severity, tags=payload.tags, templates=payload.templates, timeout=float(payload.timeout_seconds))


@router.post("/ssti/analyze")
def run_ssti_scan(payload: SstiScanRequest, settings: AppSettings, user: CurrentUser) -> dict[str, object]:
    from app.scanners.tool_engines import scan_ssti

    url = _guard_host(settings, payload.target)
    return scan_ssti(url, timeout=float(payload.timeout_seconds))


@router.post("/sqli/analyze")
def run_sqli_scan(payload: SqliScanRequest, settings: AppSettings, user: CurrentUser) -> dict[str, object]:
    from app.scanners.tool_engines import scan_sqli

    url = _guard_host(settings, payload.target)
    return scan_sqli(url, timeout=float(payload.timeout_seconds), level=payload.level, risk=payload.risk)


@router.post("/ssrf/analyze")
def run_ssrf_scan(payload: SsrfScanRequest, settings: AppSettings, user: CurrentUser) -> dict[str, object]:
    from app.scanners.tool_engines import scan_ssrf

    url = _guard_host(settings, payload.target)
    return scan_ssrf(url, parameter=payload.parameter, timeout=float(payload.timeout_seconds))


@router.post("/surface")
def run_surface_discovery(
    payload: PassiveScanRequest,
    settings: AppSettings,
    user: CurrentUser,
) -> dict[str, object]:
    """Graph-based, recursive, passive attack-surface discovery.

    Runs the Surface Finder: CT (CertSpotter + crt.sh), AlienVault OTX passive
    DNS, Wayback/CDX + Common Crawl URL intelligence, live DNS (A/AAAA/CNAME/
    MX/NS/TXT/CAA), IP/ASN/geo metadata, cloud-provider inference, GitHub code
    references (when a token is configured) and HTTP fingerprinting. Produces a
    graph of assets + evidence-backed relationships with confidence, scope and
    prioritization — no attack payloads are sent.
    """
    from app.scanners.surface_finder import find_surface
    from app.utils.errors import unsafe

    if settings.cloud_mode and not is_public_address(payload.domain, resolve_dns=True):
        raise unsafe("Private, loopback, link-local, reserved, and special-use destinations are blocked in cloud mode")

    return find_surface(
        payload.domain,
        github_token=settings.github_api_key,
        timeout=8.0,
        probe_subdomains=payload.probe_subdomains,
    )

