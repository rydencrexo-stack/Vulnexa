from __future__ import annotations

import re
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(word.capitalize() for word in rest)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PanModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        use_enum_values=True,
    )


class Record(PanModel):
    id: str
    created_at: datetime
    updated_at: datetime


class Role(str, Enum):
    USER = "user"
    ANALYST = "analyst"
    ADMIN = "admin"


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ReconStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFORMATIONAL = "informational"


class FindingState(str, Enum):
    CANDIDATE = "candidate"
    HIGH_CONFIDENCE = "high_confidence"
    CONFIRMED = "confirmed"
    FALSE_POSITIVE = "false_positive"
    ACCEPTED_RISK = "accepted_risk"
    FIXED = "fixed"
    REOPENED = "reopened"


class User(Record):
    email: str = Field(min_length=3, max_length=254)
    full_name: str = Field(min_length=2, max_length=120)
    password_hash: str
    role: Role = Role.USER
    status: str = "active"
    organization_id: str | None = None
    workspace_ids: list[str] = Field(default_factory=list)
    last_login_at: datetime | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        email = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            raise ValueError("invalid email address")
        return email


class Organization(Record):
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,62}$")
    plan_id: str | None = None
    owner_id: str
    status: str = "active"


class Workspace(Record):
    organization_id: str
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,62}$")
    created_by: str
    member_ids: list[str] = Field(default_factory=list)


class Verification(PanModel):
    status: str = "pending"
    method: str = "dns_txt"
    challenge: str | None = None
    verified_at: datetime | None = None


class TargetScope(PanModel):
    included_hosts: list[str] = Field(default_factory=list, max_length=100)
    excluded_hosts: list[str] = Field(default_factory=list, max_length=100)
    included_paths: list[str] = Field(default_factory=lambda: ["/*"], max_length=200)
    excluded_paths: list[str] = Field(
        default_factory=lambda: ["/logout", "/delete-account", "/payments"], max_length=200
    )
    allowed_ports: list[int] = Field(default_factory=lambda: [80, 443], max_length=50)

    @field_validator("included_hosts", "excluded_hosts")
    @classmethod
    def normalize_hosts(cls, values: list[str]) -> list[str]:
        result: list[str] = []
        for value in values:
            host = value.strip().lower().rstrip(".")
            if not re.fullmatch(r"(?:\*\.)?[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?", host):
                raise ValueError(f"invalid scope host: {value}")
            if host not in result:
                result.append(host)
        return result

    @field_validator("included_paths", "excluded_paths")
    @classmethod
    def normalize_paths(cls, values: list[str]) -> list[str]:
        result: list[str] = []
        for value in values:
            path = value.strip()
            if not path.startswith("/") or ".." in path or "\\" in path:
                raise ValueError(f"invalid scope path: {value}")
            if path not in result:
                result.append(path)
        return result

    @field_validator("allowed_ports")
    @classmethod
    def validate_ports(cls, values: list[int]) -> list[int]:
        if any(port < 1 or port > 65535 for port in values):
            raise ValueError("ports must be between 1 and 65535")
        return sorted(set(values))


class Target(Record):
    workspace_id: str
    name: str = Field(min_length=2, max_length=120)
    base_url: AnyHttpUrl
    domain: str = Field(min_length=1, max_length=253)
    environment: str = Field(default="staging", pattern=r"^(development|staging|production|other)$")
    verification: Verification = Field(default_factory=Verification)
    scope: TargetScope
    authentication_profile_id: str | None = None
    scan_profile: str = "balanced"
    created_by: str
    last_scan_at: datetime | None = None
    risk: str = "unknown"

    @field_validator("domain")
    @classmethod
    def normalize_domain(cls, value: str) -> str:
        host = value.strip().lower().rstrip(".")
        if not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?", host):
            raise ValueError("invalid domain")
        return host


class Asset(Record):
    workspace_id: str
    target_id: str
    hostname: str
    domain: str
    ip: str | None = None
    port: int = Field(ge=1, le=65535)
    protocol: str = "https"
    http_status: int | None = Field(default=None, ge=100, le=599)
    page_title: str | None = None
    technologies: list[str] = Field(default_factory=list)
    tls: dict[str, Any] = Field(default_factory=dict)
    screenshot: str | None = None
    first_seen: datetime = Field(default_factory=utc_now)
    last_seen: datetime = Field(default_factory=utc_now)
    discovery_source: str
    risk_state: str = "unknown"
    verified: bool = True


class EndpointParameter(PanModel):
    name: str
    location: str = Field(pattern=r"^(query|path|header|cookie|body)$")
    data_type: str = "string"
    required: bool = False


class Endpoint(Record):
    workspace_id: str
    target_id: str
    asset_id: str
    url: AnyHttpUrl
    normalized_path: str
    method: str = Field(default="GET", pattern=r"^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$")
    content_type: str | None = None
    parameters: list[EndpointParameter] = Field(default_factory=list)
    authentication_required: bool = False
    observed_role: str | None = None
    discovery_source: str
    status_code: int | None = Field(default=None, ge=100, le=599)
    response_fingerprint: str | None = None
    tests_completed: list[str] = Field(default_factory=list)
    first_seen: datetime = Field(default_factory=utc_now)
    last_seen: datetime = Field(default_factory=utc_now)
    kind: str = "web"


class ReconJob(Record):
    workspace_id: str
    target_id: str
    name: str
    modules: list[str]
    status: ReconStatus = ReconStatus.QUEUED
    progress: int = Field(default=0, ge=0, le=100)
    current_module: str | None = None
    start_url: AnyHttpUrl | None = None
    statistics: dict[str, int] = Field(default_factory=dict)
    logs: list[str] = Field(default_factory=list)
    created_by: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error: str | None = None


class ScanStatistics(PanModel):
    assets_found: int = 0
    endpoints_found: int = 0
    parameters_tested: int = 0
    requests_sent: int = 0
    candidate_findings: int = 0
    confirmed_findings: int = 0


class Scan(Record):
    workspace_id: str
    target_id: str
    name: str
    profile: str = "balanced"
    modules: list[str]
    authentication_profile_id: str | None = None
    speed: str = Field(default="balanced", pattern=r"^(safe|balanced|fast)$")
    request_limit: int = Field(default=1000, ge=1, le=10000)
    concurrency: int = Field(default=2, ge=1, le=10)
    status: JobStatus = JobStatus.QUEUED
    progress: int = Field(default=0, ge=0, le=100)
    current_phase: str = "scope_validation"
    statistics: ScanStatistics = Field(default_factory=ScanStatistics)
    warnings: list[str] = Field(default_factory=list)
    created_by: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    scheduled_at: datetime | None = None
    external_reference: dict[str, Any] | None = None
    error: str | None = None


class ScanEvent(Record):
    workspace_id: str
    scan_id: str
    level: str = "info"
    phase: str
    message: str
    progress: int = Field(ge=0, le=100)


class Cvss(PanModel):
    version: str = "3.1"
    score: float = Field(default=0, ge=0, le=10)
    vector: str = ""


class Evidence(PanModel):
    request_id: str | None = None
    response_id: str | None = None
    references: list[str] = Field(default_factory=list)
    screenshot: str | None = None
    browser_verified: bool = False
    summary: str | None = None


class TimelineEntry(PanModel):
    timestamp: datetime = Field(default_factory=utc_now)
    actor_id: str
    action: str
    note: str | None = None


class RetestEntry(PanModel):
    id: str
    requested_at: datetime
    requested_by: str
    status: str
    completed_at: datetime | None = None
    outcome: str | None = None


class Finding(Record):
    workspace_id: str
    target_id: str
    scan_id: str | None = None
    asset_id: str | None = None
    endpoint_id: str | None = None
    title: str
    type: str
    severity: Severity
    confidence: int = Field(ge=0, le=100)
    verification_state: FindingState = FindingState.CANDIDATE
    source: str
    method: str = "GET"
    parameter: str | None = None
    cwe: str | None = None
    owasp: str | None = None
    cvss: Cvss = Field(default_factory=Cvss)
    description: str
    impact: str
    evidence: Evidence = Field(default_factory=Evidence)
    sanitized_request: str | None = None
    sanitized_response: str | None = None
    reproduction_steps: list[str] = Field(default_factory=list)
    ai_analysis: dict[str, Any] | None = None
    remediation: str
    status: str = "open"
    assigned_to: str | None = None
    timeline: list[TimelineEntry] = Field(default_factory=list)
    retest_history: list[RetestEntry] = Field(default_factory=list)


class Report(Record):
    workspace_id: str
    target_id: str | None = None
    scan_id: str | None = None
    name: str
    type: str
    status: str = "generating"
    formats: list[str] = Field(default_factory=lambda: ["html", "json", "csv", "pdf"])
    files: dict[str, str] = Field(default_factory=dict)
    summary: dict[str, Any] = Field(default_factory=dict)
    generated_by: str
    generated_at: datetime | None = None
    error: str | None = None


class Notification(Record):
    workspace_id: str
    user_id: str | None = None
    type: str
    title: str
    message: str
    severity: str = "info"
    read: bool = False
    read_by_ids: list[str] = Field(default_factory=list)
    link: str | None = None


class ConversationMessage(PanModel):
    role: str = Field(pattern=r"^(user|assistant)$")
    content: str = Field(max_length=8000)
    created_at: datetime = Field(default_factory=utc_now)


class AIConversation(Record):
    workspace_id: str
    user_id: str
    title: str
    finding_id: str | None = None
    scan_id: str | None = None
    provider: str
    model: str
    messages: list[ConversationMessage]


class LearningProgress(Record):
    workspace_id: str
    user_id: str
    lesson_id: str
    completed: bool = False
    percent: int = Field(default=0, ge=0, le=100)


class ScannerTool(Record):
    name: str
    slug: str
    category: str
    enabled: bool = True
    mode: str = "mock"
    status: str = "available"
    version: str | None = None
    description: str


class ScanWorker(Record):
    name: str
    status: str = "healthy"
    capabilities: list[str] = Field(default_factory=list)
    current_scan_id: str | None = None
    last_heartbeat_at: datetime
    jobs_completed: int = 0


class Template(Record):
    workspace_id: str | None = None
    name: str
    type: str
    description: str
    enabled: bool = True
    config: dict[str, Any] = Field(default_factory=dict)
    created_by: str


class Plan(Record):
    name: str
    description: str
    limits: dict[str, int]
    enabled: bool = True


class Setting(Record):
    workspace_id: str
    category: str
    values: dict[str, Any] = Field(default_factory=dict)
    updated_by: str


class AuditLog(Record):
    workspace_id: str | None = None
    organization_id: str | None = None
    actor_id: str | None = None
    action: str
    resource_type: str
    resource_id: str | None = None
    outcome: str = "success"
    ip_address: str | None = None
    user_agent: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


COLLECTION_MODELS: dict[str, type[Record]] = {
    "users": User,
    "organizations": Organization,
    "workspaces": Workspace,
    "targets": Target,
    "assets": Asset,
    "endpoints": Endpoint,
    "recon_jobs": ReconJob,
    "scans": Scan,
    "scan_events": ScanEvent,
    "findings": Finding,
    "reports": Report,
    "notifications": Notification,
    "ai_conversations": AIConversation,
    "learning_progress": LearningProgress,
    "scanner_tools": ScannerTool,
    "scan_workers": ScanWorker,
    "templates": Template,
    "plans": Plan,
    "settings": Setting,
    "audit_logs": AuditLog,
}
