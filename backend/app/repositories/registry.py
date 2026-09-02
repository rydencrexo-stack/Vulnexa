from __future__ import annotations

from pathlib import Path
from typing import Any

from app.models.domain import COLLECTION_MODELS, Record
from app.repositories.json_repository import JsonRepository


ID_PREFIXES = {
    "users": "usr",
    "organizations": "org",
    "workspaces": "wsp",
    "targets": "tgt",
    "assets": "ast",
    "endpoints": "ep",
    "recon_jobs": "rec",
    "scans": "scn",
    "scan_events": "evt",
    "findings": "fnd",
    "reports": "rpt",
    "notifications": "ntf",
    "ai_conversations": "aic",
    "learning_progress": "lrn",
    "scanner_tools": "tool",
    "scan_workers": "wrk",
    "templates": "tpl",
    "plans": "pln",
    "settings": "set",
    "audit_logs": "aud",
}


class RepositoryRegistry:
    def __init__(self, data_directory: Path, *, backups: bool = True) -> None:
        self.data_directory = data_directory.resolve()
        self.data_directory.mkdir(parents=True, exist_ok=True)
        self._repositories: dict[str, JsonRepository[Any]] = {
            name: JsonRepository(
                self.data_directory / f"{name}.json",
                model,
                id_prefix=ID_PREFIXES[name],
                backup_before_write=backups,
            )
            for name, model in COLLECTION_MODELS.items()
        }

    def __getitem__(self, name: str) -> JsonRepository[Any]:
        return self._repositories[name]

    def get(self, name: str) -> JsonRepository[Any]:
        return self._repositories[name]

    @property
    def collections(self) -> tuple[str, ...]:
        return tuple(self._repositories)

    def initialize_all(self) -> None:
        # Construction performs initialization and validation. Reading here makes
        # startup fail fast if an existing collection is malformed.
        for repository in self._repositories.values():
            repository.get_all()
