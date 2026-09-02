from __future__ import annotations

import json
import os
import shutil
import tempfile
import threading
import uuid
from collections.abc import Callable, Iterable, Mapping
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Generic, TypeVar

from filelock import FileLock, Timeout
from pydantic import BaseModel, ValidationError


ModelT = TypeVar("ModelT", bound=BaseModel)
_LOCKS: dict[str, threading.RLock] = {}
_LOCKS_GUARD = threading.Lock()


class RepositoryError(RuntimeError):
    """Base storage error safe to translate into an API error."""


class RepositoryCorruptError(RepositoryError):
    pass


class RepositoryConflictError(RepositoryError):
    pass


class RepositoryNotFoundError(RepositoryError):
    pass


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _model_json(model: BaseModel) -> dict[str, Any]:
    return model.model_dump(mode="json", by_alias=True)


def _field_value(item: BaseModel, field: str) -> Any:
    value: Any = item
    for part in field.replace("__", ".").split("."):
        if isinstance(value, BaseModel):
            value = getattr(value, part, getattr(value, _snake(part), None))
        elif isinstance(value, Mapping):
            value = value.get(part)
        else:
            return None
    return value


def _snake(value: str) -> str:
    result = []
    for char in value:
        if char.isupper():
            result.extend(("_", char.lower()))
        else:
            result.append(char)
    return "".join(result)


def _sort_key(value: Any) -> tuple[int, Any]:
    """Return a total-order key for user-selectable repository fields.

    API sort fields are strings, so a missing or complex field must not turn into
    an unhandled ``TypeError``.  Values keep natural ordering within their type;
    structured values use deterministic JSON as a final fallback.
    """
    if value is None:
        return (5, "")
    if isinstance(value, Enum):
        value = value.value
    if isinstance(value, bool):
        return (0, int(value))
    if isinstance(value, (int, float)):
        return (1, value)
    if isinstance(value, datetime):
        return (2, value.timestamp())
    if isinstance(value, str):
        return (3, value.casefold())
    if isinstance(value, BaseModel):
        value = _model_json(value)
    try:
        serialized = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
    except (TypeError, ValueError):
        serialized = str(value)
    return (4, serialized)


class JsonRepository(Generic[ModelT]):
    """Validated JSON collection storage with locked atomic writes.

    Thread and process locks protect the read-modify-write cycle. A write is first
    fsynced to a temporary file in the collection directory and then atomically
    replaces the collection. The optional `.bak` file is the immediately previous
    valid collection.
    """

    def __init__(
        self,
        path: Path,
        model: type[ModelT],
        *,
        id_prefix: str | None = None,
        backup_before_write: bool = True,
        lock_timeout: float = 10.0,
    ) -> None:
        self.path = path.resolve()
        self.model = model
        self.id_prefix = id_prefix or self.path.stem.rstrip("s")
        self.backup_before_write = backup_before_write
        self.lock_timeout = lock_timeout
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with _LOCKS_GUARD:
            self._thread_lock = _LOCKS.setdefault(str(self.path), threading.RLock())
        self._file_lock = FileLock(str(self.path) + ".lock", timeout=lock_timeout)
        self._ensure_initialized()

    @property
    def backup_path(self) -> Path:
        return self.path.with_suffix(self.path.suffix + ".bak")

    def _empty_collection(self) -> dict[str, Any]:
        return {"version": 1, "updatedAt": iso_now(), "items": []}

    def _ensure_initialized(self) -> None:
        if self.path.exists():
            return
        with self._thread_lock:
            try:
                with self._file_lock:
                    if not self.path.exists():
                        self._atomic_write_unlocked(self._empty_collection(), backup=False)
            except Timeout as exc:
                raise RepositoryConflictError(f"timed out initializing {self.path.name}") from exc

    def _read_unlocked(self) -> tuple[dict[str, Any], list[ModelT]]:
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise RepositoryCorruptError(f"could not read {self.path.name}: {exc}") from exc
        if not isinstance(raw, dict) or raw.get("version") != 1 or not isinstance(raw.get("items"), list):
            raise RepositoryCorruptError(f"{self.path.name} has an invalid collection envelope")
        try:
            items = [self.model.model_validate(item) for item in raw["items"]]
        except ValidationError as exc:
            raise RepositoryCorruptError(f"invalid record in {self.path.name}: {exc}") from exc
        return raw, items

    def _atomic_write_unlocked(self, document: dict[str, Any], *, backup: bool | None = None) -> None:
        should_backup = self.backup_before_write if backup is None else backup
        document = {"version": 1, "updatedAt": iso_now(), "items": document["items"]}
        descriptor, temporary_name = tempfile.mkstemp(
            dir=str(self.path.parent), prefix=f".{self.path.stem}.", suffix=".tmp"
        )
        temporary = Path(temporary_name)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
                json.dump(document, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            if should_backup and self.path.exists():
                shutil.copy2(self.path, self.backup_path)
            os.replace(temporary, self.path)
        except OSError as exc:
            raise RepositoryError(f"atomic write failed for {self.path.name}: {exc}") from exc
        finally:
            if temporary.exists():
                temporary.unlink(missing_ok=True)

    def get_all(self) -> list[ModelT]:
        with self._thread_lock:
            _, items = self._read_unlocked()
        return items

    def get_by_id(self, record_id: str) -> ModelT | None:
        return next((item for item in self.get_all() if getattr(item, "id") == record_id), None)

    def require(self, record_id: str) -> ModelT:
        item = self.get_by_id(record_id)
        if item is None:
            raise RepositoryNotFoundError(f"{self.path.stem} record {record_id!r} was not found")
        return item

    def create(self, values: Mapping[str, Any] | ModelT) -> ModelT:
        data = _model_json(values) if isinstance(values, BaseModel) else dict(values)
        now = iso_now()
        # ``create`` owns identity and timestamps.  ``replace_all`` is the
        # explicit import/seed operation for records with pre-existing IDs.
        data.pop("id", None)
        data.pop("created_at", None)
        data.pop("createdAt", None)
        data.pop("updated_at", None)
        data.pop("updatedAt", None)
        data["id"] = f"{self.id_prefix}_{uuid.uuid4()}"
        data["createdAt"] = now
        data["updatedAt"] = now
        try:
            item = self.model.model_validate(data)
        except ValidationError as exc:
            raise RepositoryError(f"invalid {self.path.stem} record: {exc}") from exc
        with self._thread_lock:
            try:
                with self._file_lock:
                    raw, items = self._read_unlocked()
                    if any(getattr(existing, "id") == getattr(item, "id") for existing in items):
                        raise RepositoryConflictError(f"duplicate id {getattr(item, 'id')}")
                    raw["items"].append(_model_json(item))
                    self._atomic_write_unlocked(raw)
            except Timeout as exc:
                raise RepositoryConflictError(f"timed out writing {self.path.name}") from exc
        return item

    def update(self, record_id: str, changes: Mapping[str, Any]) -> ModelT:
        safe_changes = dict(changes)
        for immutable in ("id", "createdAt", "created_at"):
            safe_changes.pop(immutable, None)
        safe_changes["updatedAt"] = iso_now()
        with self._thread_lock:
            try:
                with self._file_lock:
                    raw, items = self._read_unlocked()
                    index = next((i for i, item in enumerate(items) if getattr(item, "id") == record_id), None)
                    if index is None:
                        raise RepositoryNotFoundError(f"{self.path.stem} record {record_id!r} was not found")
                    merged = _model_json(items[index])
                    merged.update(safe_changes)
                    try:
                        updated = self.model.model_validate(merged)
                    except ValidationError as exc:
                        raise RepositoryError(f"invalid update for {self.path.stem}: {exc}") from exc
                    raw["items"][index] = _model_json(updated)
                    self._atomic_write_unlocked(raw)
                    return updated
            except Timeout as exc:
                raise RepositoryConflictError(f"timed out writing {self.path.name}") from exc

    def transact(self, record_id: str, transform: Callable[[dict[str, Any]], Mapping[str, Any]]) -> ModelT:
        """Atomically derive an update from the latest version of one record."""
        with self._thread_lock:
            try:
                with self._file_lock:
                    raw, items = self._read_unlocked()
                    index = next((i for i, item in enumerate(items) if getattr(item, "id") == record_id), None)
                    if index is None:
                        raise RepositoryNotFoundError(f"{self.path.stem} record {record_id!r} was not found")
                    current = _model_json(items[index])
                    changes = dict(transform(dict(current)))
                    changes.pop("id", None)
                    changes.pop("createdAt", None)
                    current.update(changes)
                    current["updatedAt"] = iso_now()
                    try:
                        updated = self.model.model_validate(current)
                    except ValidationError as exc:
                        raise RepositoryError(f"invalid transaction for {self.path.stem}: {exc}") from exc
                    raw["items"][index] = _model_json(updated)
                    self._atomic_write_unlocked(raw)
                    return updated
            except Timeout as exc:
                raise RepositoryConflictError(f"timed out writing {self.path.name}") from exc

    def delete(self, record_id: str) -> ModelT:
        with self._thread_lock:
            try:
                with self._file_lock:
                    raw, items = self._read_unlocked()
                    index = next((i for i, item in enumerate(items) if getattr(item, "id") == record_id), None)
                    if index is None:
                        raise RepositoryNotFoundError(f"{self.path.stem} record {record_id!r} was not found")
                    deleted = items[index]
                    del raw["items"][index]
                    self._atomic_write_unlocked(raw)
                    return deleted
            except Timeout as exc:
                raise RepositoryConflictError(f"timed out writing {self.path.name}") from exc

    def filter(self, **criteria: Any) -> list[ModelT]:
        result = self.get_all()
        for field, expected in criteria.items():
            if expected is None:
                continue
            if isinstance(expected, (set, list, tuple)):
                accepted = set(expected)
                result = [item for item in result if _field_value(item, field) in accepted]
            else:
                result = [item for item in result if _field_value(item, field) == expected]
        return result

    def sort(
        self, field: str, *, descending: bool = False, items: Iterable[ModelT] | None = None
    ) -> list[ModelT]:
        source = list(items) if items is not None else self.get_all()
        present = [item for item in source if _field_value(item, field) is not None]
        missing = [item for item in source if _field_value(item, field) is None]
        return sorted(present, key=lambda item: _sort_key(_field_value(item, field)), reverse=descending) + missing

    def paginate(
        self,
        *,
        page: int = 1,
        page_size: int = 25,
        items: Iterable[ModelT] | None = None,
    ) -> dict[str, Any]:
        if page < 1 or page_size < 1 or page_size > 200:
            raise ValueError("page must be >= 1 and page_size must be between 1 and 200")
        source = list(items) if items is not None else self.get_all()
        total = len(source)
        start = (page - 1) * page_size
        return {
            "items": source[start : start + page_size],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "pages": (total + page_size - 1) // page_size,
        }

    def replace_all(self, records: Iterable[Mapping[str, Any] | ModelT]) -> list[ModelT]:
        validated: list[ModelT] = []
        try:
            for values in records:
                data = _model_json(values) if isinstance(values, BaseModel) else dict(values)
                now = iso_now()
                data.setdefault("id", f"{self.id_prefix}_{uuid.uuid4()}")
                data.setdefault("createdAt", now)
                data.setdefault("updatedAt", now)
                validated.append(self.model.model_validate(data))
        except (TypeError, ValueError, ValidationError) as exc:
            raise RepositoryError(f"invalid replacement for {self.path.stem}: {exc}") from exc
        ids = [getattr(item, "id") for item in validated]
        if len(ids) != len(set(ids)):
            raise RepositoryConflictError(f"duplicate ids supplied for {self.path.stem}")
        with self._thread_lock:
            try:
                with self._file_lock:
                    self._atomic_write_unlocked({"items": [_model_json(item) for item in validated]})
            except Timeout as exc:
                raise RepositoryConflictError(f"timed out writing {self.path.name}") from exc
        return validated
