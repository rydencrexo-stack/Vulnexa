from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator, model_validator

from app.models.domain import PanModel, Role, TargetScope


class RegisterRequest(PanModel):
    email: str = Field(min_length=3, max_length=254)
    password: SecretStr
    full_name: str = Field(min_length=2, max_length=120)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        email = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            raise ValueError("invalid email address")
        return email

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: SecretStr) -> SecretStr:
        password = value.get_secret_value()
        if len(password) < 10 or len(password) > 128:
            raise ValueError("password must be between 10 and 128 characters")
        checks = (r"[a-z]", r"[A-Z]", r"\d", r"[^A-Za-z0-9]")
        if not all(re.search(pattern, password) for pattern in checks):
            raise ValueError("password must include lowercase, uppercase, number, and symbol")
        return value


class LoginRequest(PanModel):
    email: str = Field(min_length=3, max_length=254)
    password: SecretStr

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        email = value.strip().lower()
        if re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            return email
        # The mobile companion demo signs in with a bare username (e.g. "admin").
        if re.fullmatch(r"[a-z0-9._-]{2,64}", email):
            return email
        raise ValueError("invalid email address")


class ForgotPasswordRequest(PanModel):
    email: str = Field(min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        email = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            raise ValueError("invalid email address")
        return email


class WorkspaceCreate(PanModel):
    name: str = Field(min_length=2, max_length=120)
    organization_name: str | None = Field(default=None, min_length=2, max_length=120)


class TargetCreate(PanModel):
    workspace_id: str
    name: str = Field(min_length=2, max_length=120)
    base_url: AnyHttpUrl
    domain: str | None = None
    environment: str = Field(default="staging", pattern=r"^(development|staging|production|other)$")
    verification_method: str = Field(default="dns_txt", pattern=r"^(dns_txt|file|meta_tag|mock)$")
    scope: TargetScope | None = None
    scan_profile: str = "balanced"
    authorization_acknowledged: Literal[True]


class TargetUpdate(PanModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    environment: str | None = Field(default=None, pattern=r"^(development|staging|production|other)$")
    scope: TargetScope | None = None
    scan_profile: str | None = None
    authentication_profile_id: str | None = None


class TargetVerify(PanModel):
    method: str = Field(default="mock", pattern=r"^(dns_txt|file|meta_tag|mock)$")
    proof: str | None = Field(default=None, max_length=500)
    authorization_acknowledged: Literal[True]


class ReconJobCreate(PanModel):
    workspace_id: str
    target_id: str
    name: str = Field(default="Authorized reconnaissance", min_length=2, max_length=120)
    modules: list[str] = Field(default_factory=lambda: ["subdomains", "live_hosts", "url_discovery"])
    start_url: AnyHttpUrl | None = None
    authorization_acknowledged: Literal[True]

    @field_validator("modules")
    @classmethod
    def unique_modules(cls, values: list[str]) -> list[str]:
        if not values or len(values) > 12:
            raise ValueError("select between 1 and 12 recon modules")
        return list(dict.fromkeys(values))


class ScanCreate(PanModel):
    workspace_id: str
    target_id: str
    name: str = Field(default="PAN authorized scan", min_length=2, max_length=120)
    profile: str = "balanced"
    modules: list[str] = Field(default_factory=lambda: ["passive"])
    authentication_profile_id: str | None = None
    speed: str = Field(default="balanced", pattern=r"^(safe|balanced|fast)$")
    request_limit: int = Field(default=1000, ge=1, le=10000)
    concurrency: int = Field(default=2, ge=1, le=10)
    scheduled_at: datetime | None = None
    authorization_acknowledged: Literal[True]
    disruptive_checks_acknowledged: bool = False

    @field_validator("modules")
    @classmethod
    def validate_modules(cls, values: list[str]) -> list[str]:
        if not values or len(values) > 16:
            raise ValueError("select between 1 and 16 scan modules")
        return list(dict.fromkeys(values))

    @field_validator("scheduled_at")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("scheduledAt must include a timezone offset")
        return value.astimezone(timezone.utc)


class ActiveScanCreate(PanModel):
    workspace_id: str
    target_id: str
    name: str = Field(default="Acunetix authorized scan", min_length=2, max_length=120)
    profile: str = Field(default="full_scan", max_length=80)
    authorization_acknowledged: Literal[True]


class FindingUpdate(PanModel):
    severity: str | None = Field(default=None, pattern=r"^(critical|high|medium|low|informational)$")
    assigned_to: str | None = None
    remediation: str | None = Field(default=None, max_length=8000)
    note: str | None = Field(default=None, max_length=1000)


class FindingAction(PanModel):
    note: str | None = Field(default=None, max_length=1000)


class RetestRequest(PanModel):
    note: str | None = Field(default=None, max_length=1000)
    authorization_acknowledged: Literal[True]


class AIChatRequest(PanModel):
    question: str = Field(min_length=2, max_length=4000)
    workspace_id: str
    conversation_id: str | None = None
    finding_id: str | None = None
    scan_id: str | None = None

    @model_validator(mode="after")
    def require_evidence_context(self) -> "AIChatRequest":
        if bool(self.finding_id) == bool(self.scan_id):
            raise ValueError("exactly one of findingId or scanId is required so conclusions have one evidence context")
        return self


class FindingAnalysisRequest(PanModel):
    finding_id: str


class AIAnalysis(PanModel):
    summary: str
    vulnerability_type: str
    confidence: int = Field(ge=0, le=100)
    verification_recommendation: str
    evidence_used: list[str]
    impact: str
    remediation: list[str]
    safe_next_steps: list[str]
    limitations: list[str]


class ReportCreate(PanModel):
    workspace_id: str
    name: str = Field(min_length=2, max_length=160)
    type: str = Field(
        default="technical",
        pattern=r"^(executive|technical|full_scan|recon|findings_only|comparison)$",
    )
    target_id: str | None = None
    scan_id: str | None = None
    formats: list[str] = Field(default_factory=lambda: ["html", "json", "csv", "pdf"])

    @field_validator("formats")
    @classmethod
    def validate_formats(cls, values: list[str]) -> list[str]:
        allowed = {"html", "json", "csv", "pdf"}
        result = list(dict.fromkeys(value.lower() for value in values))
        if not result or not set(result).issubset(allowed):
            raise ValueError("formats must contain html, json, csv, or pdf")
        return result


class SettingsUpdate(PanModel):
    values: dict[str, Any]

    @field_validator("values")
    @classmethod
    def reject_secrets(cls, values: dict[str, Any]) -> dict[str, Any]:
        blocked = (
            "password",
            "secret",
            "token",
            "apikey",
            "cookie",
            "credential",
            "authorization",
            "privatekey",
        )

        def inspect(value: Any) -> None:
            if isinstance(value, dict):
                for key, nested in value.items():
                    normalized = re.sub(r"[^a-z0-9]", "", str(key).lower())
                    if any(word in normalized for word in blocked):
                        raise ValueError("secret values are environment-only and cannot be stored in settings")
                    inspect(nested)
            elif isinstance(value, list):
                for nested in value:
                    inspect(nested)

        inspect(values)
        return values


class NotificationRead(PanModel):
    read: bool = True


class AdminUserUpdate(PanModel):
    role: Role | None = None
    status: str | None = Field(default=None, pattern=r"^(active|disabled|invited)$")


class ScannerToolUpdate(PanModel):
    enabled: bool | None = None
    status: str | None = Field(default=None, pattern=r"^(available|disabled|disconnected)$")


class AgentRunRequest(PanModel):
    workspace_id: str = Field(min_length=1)
    target_id: str | None = None
    domain: str | None = None
    host: str | None = None
    phases: list[str] = []
    skills: list[str] = []
    auth: str = "None — non-authenticated"



class AgentScanRequest(PanModel):
    domain: str = Field(min_length=1, max_length=253)
    host: str | None = None
    phases: list[str] = []
    skills: list[str] = []
    auth: str = 'None - non-authenticated'


class PassiveScanRequest(PanModel):
    domain: str = Field(min_length=2, max_length=253)
    probe_subdomains: bool = True

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, value: str) -> str:
        domain = value.strip().lower().rstrip(".")
        if not re.fullmatch(
            r"(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}",
            domain,
        ):
            raise ValueError("domain must be a valid hostname without a scheme")
        return domain


class XssScanRequest(PanModel):
    target: str = Field(min_length=2, max_length=2048)
    timeout_seconds: int = Field(default=150, ge=30, le=600)

    @field_validator("target")
    @classmethod
    def validate_target(cls, value: str) -> str:
        target = value.strip()
        if "://" in target and not re.match(r"^https?://", target, re.IGNORECASE):
            raise ValueError("only http and https targets are supported")
        if "\x00" in target or "\n" in target or "\r" in target:
            raise ValueError("target contains unsafe characters")
        return target


class OpenRedirectScanRequest(PanModel):
    target: str = Field(min_length=2, max_length=2048)
    parameter: str | None = Field(default=None, max_length=64)
    timeout_seconds: int = Field(default=90, ge=20, le=300)

    @field_validator("target")
    @classmethod
    def validate_target(cls, value: str) -> str:
        return XssScanRequest.validate_target(value)


class SecretsScanRequest(PanModel):
    target: str = Field(min_length=2, max_length=2048)
    timeout_seconds: int = Field(default=120, ge=20, le=300)

    @field_validator("target")
    @classmethod
    def validate_target(cls, value: str) -> str:
        return XssScanRequest.validate_target(value)


class NucleiScanRequest(PanModel):
    target: str = Field(min_length=2, max_length=2048)
    severity: str = Field(default="high,critical", max_length=80)
    tags: str = Field(default="", max_length=200)
    templates: str = Field(default="", max_length=400)
    timeout_seconds: int = Field(default=180, ge=30, le=900)

    @field_validator("target")
    @classmethod
    def validate_target(cls, value: str) -> str:
        return XssScanRequest.validate_target(value)


class SstiScanRequest(PanModel):
    target: str = Field(min_length=2, max_length=2048)
    timeout_seconds: int = Field(default=180, ge=30, le=600)

    @field_validator("target")
    @classmethod
    def validate_target(cls, value: str) -> str:
        return XssScanRequest.validate_target(value)


class SqliScanRequest(PanModel):
    target: str = Field(min_length=2, max_length=2048)
    level: int = Field(default=1, ge=1, le=3)
    risk: int = Field(default=1, ge=0, le=2)
    timeout_seconds: int = Field(default=180, ge=30, le=900)

    @field_validator("target")
    @classmethod
    def validate_target(cls, value: str) -> str:
        return XssScanRequest.validate_target(value)


class SsrfScanRequest(PanModel):
    target: str = Field(min_length=2, max_length=2048)
    parameter: str | None = Field(default=None, max_length=64)
    timeout_seconds: int = Field(default=120, ge=30, le=600)

    @field_validator("target")
    @classmethod
    def validate_target(cls, value: str) -> str:
        return XssScanRequest.validate_target(value)
