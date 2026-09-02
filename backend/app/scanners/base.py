from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from pydantic import AnyHttpUrl, Field

from app.models.domain import PanModel, TargetScope


class ScannerTask(PanModel):
    task_id: str
    target_id: str
    workspace_id: str
    base_url: AnyHttpUrl
    scope: TargetScope
    timeout_seconds: int = Field(default=300, ge=1, le=3600)
    request_limit: int = Field(default=1000, ge=1, le=10000)
    concurrency: int = Field(default=2, ge=1, le=10)


class ScannerObservation(PanModel):
    kind: str
    source: str
    data: dict[str, Any]


class ScannerResult(PanModel):
    adapter: str
    task_id: str
    status: str
    progress: int = Field(default=100, ge=0, le=100)
    observations: list[ScannerObservation] = Field(default_factory=list)
    logs: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ScannerAdapter(ABC):
    slug: str
    description: str

    @abstractmethod
    def run(self, task: ScannerTask) -> ScannerResult:
        """Return structured observations for a validated, authorized task."""

    def cancel(self, task_id: str) -> bool:
        return True

