from __future__ import annotations

import os
import secrets
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


def _bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    return default if value is None else value.strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


@dataclass(slots=True)
class Settings:
    app_name: str = "PAN - Proactive Attack Navigator"
    environment: str = "development"
    data_directory: Path = field(default_factory=lambda: BASE_DIR / "data")
    evidence_directory: Path = field(default_factory=lambda: BASE_DIR / "evidence")
    report_directory: Path = field(default_factory=lambda: BASE_DIR / "reports")
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    jwt_secret: str = field(default_factory=lambda: secrets.token_urlsafe(48))
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 480
    cookie_name: str = "pan_session"
    cookie_secure: bool = False
    scanner_mock_mode: bool = True
    cloud_mode: bool = False
    repository_backups: bool = True
    scanner_step_seconds: float = 0.35
    scanner_timeout_seconds: int = 1800
    agent_min_scan_seconds: float = 32.0
    max_request_limit: int = 10_000
    max_concurrency: int = 10
    acunetix_base_url: str | None = None
    acunetix_api_key: str | None = None
    ai_provider: str = "mock"
    ai_base_url: str | None = None
    ai_api_key: str | None = None
    ai_model: str = "pan-safe-analyst"
    opencode_base_url: str = "https://opencode.ai/zen/go/v1"
    opencode_api_key: str | None = None
    opencode_model: str = "deepseek-v4-flash"
    mobile_token: str | None = None
    allow_external_integrations: bool = False
    virustotal_api_key: str | None = None
    github_api_key: str | None = None

    @classmethod
    def from_env(cls) -> "Settings":
        generated_secret = secrets.token_urlsafe(48)
        return cls(
            environment=os.getenv("PAN_ENV", "development"),
            data_directory=Path(os.getenv("DATA_DIRECTORY", str(BASE_DIR / "data"))).resolve(),
            evidence_directory=Path(os.getenv("EVIDENCE_DIRECTORY", str(BASE_DIR / "evidence"))).resolve(),
            report_directory=Path(os.getenv("REPORT_DIRECTORY", str(BASE_DIR / "reports"))).resolve(),
            frontend_url=os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/"),
            backend_url=os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/"),
            jwt_secret=os.getenv("JWT_SECRET") or generated_secret,
            access_token_minutes=_int("ACCESS_TOKEN_MINUTES", 480),
            cookie_secure=_bool("COOKIE_SECURE", os.getenv("PAN_ENV") == "production"),
            scanner_mock_mode=_bool("SCANNER_MOCK_MODE", True),
            cloud_mode=_bool("CLOUD_MODE", False),
            repository_backups=_bool("JSON_BACKUPS", True),
            scanner_step_seconds=float(os.getenv("SCANNER_STEP_SECONDS", "0.35")),
            scanner_timeout_seconds=_int("SCANNER_TIMEOUT_SECONDS", 1800),
            agent_min_scan_seconds=float(os.getenv("AGENT_MIN_SCAN_SECONDS", "32.0")),
            max_request_limit=_int("MAX_SCAN_REQUEST_LIMIT", 10_000),
            max_concurrency=_int("MAX_SCAN_CONCURRENCY", 10),
            acunetix_base_url=os.getenv("ACUNETIX_BASE_URL") or None,
            acunetix_api_key=os.getenv("ACUNETIX_API_KEY") or None,
            ai_provider=os.getenv("AI_PROVIDER", "mock"),
            ai_base_url=os.getenv("AI_BASE_URL") or None,
            ai_api_key=os.getenv("AI_API_KEY") or None,
            ai_model=os.getenv("AI_MODEL", "pan-safe-analyst"),
            opencode_base_url=os.getenv("OPENCODE_BASE_URL", "https://opencode.ai/zen/go/v1"),
            opencode_api_key=os.getenv("OPENCODE_API_KEY") or None,
            opencode_model=os.getenv("OPENCODE_MODEL", "deepseek-v4-flash"),
            mobile_token=os.getenv("MOBILE_TOKEN") or None,
            allow_external_integrations=_bool("ALLOW_EXTERNAL_INTEGRATIONS", False),
            virustotal_api_key=os.getenv("VIRUSTOTAL_API_KEY") or None,
            github_api_key=os.getenv("GITHUB_API_KEY") or None,
        )

    def prepare_directories(self) -> None:
        for directory in (self.data_directory, self.evidence_directory, self.report_directory):
            directory.mkdir(parents=True, exist_ok=True)

