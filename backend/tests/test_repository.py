from __future__ import annotations

import json
import threading
import uuid
from pathlib import Path

import pytest
from pydantic import Field

from app.models.domain import Record
from app.repositories.json_repository import JsonRepository, RepositoryCorruptError, RepositoryError


class ExampleRecord(Record):
    name: str = Field(min_length=2)
    score: int = Field(ge=0)
    group: str = "default"


def test_repository_initializes_crud_filters_sort_and_pagination(tmp_path: Path) -> None:
    path = tmp_path / "examples.json"
    repository = JsonRepository(path, ExampleRecord, id_prefix="ex", backup_before_write=True)
    envelope = json.loads(path.read_text(encoding="utf-8"))
    assert envelope["version"] == 1
    assert envelope["items"] == []

    alpha = repository.create({"name": "Alpha", "score": 2, "group": "a"})
    beta = repository.create({"name": "Beta", "score": 9, "group": "b"})
    assert uuid.UUID(alpha.id.removeprefix("ex_"))
    assert repository.backup_path.exists()
    assert repository.get_by_id(beta.id).name == "Beta"
    assert [item.name for item in repository.filter(group="a")] == ["Alpha"]
    assert [item.score for item in repository.sort("score", descending=True)] == [9, 2]
    page = repository.paginate(page=2, page_size=1, items=repository.sort("score"))
    assert page["total"] == 2 and page["pages"] == 2 and page["items"][0].score == 9

    updated = repository.update(alpha.id, {"score": 5, "id": "cannot-change"})
    assert updated.id == alpha.id and updated.score == 5 and updated.updated_at >= alpha.updated_at
    deleted = repository.delete(beta.id)
    assert deleted.id == beta.id and repository.get_by_id(beta.id) is None


def test_repository_validates_and_detects_corruption(tmp_path: Path) -> None:
    path = tmp_path / "examples.json"
    repository = JsonRepository(path, ExampleRecord)
    with pytest.raises(RepositoryError):
        repository.create({"name": "x", "score": -1})
    path.write_text("{broken", encoding="utf-8")
    with pytest.raises(RepositoryCorruptError):
        repository.get_all()


def test_repository_concurrent_creates_do_not_lose_records(tmp_path: Path) -> None:
    repository = JsonRepository(tmp_path / "examples.json", ExampleRecord, backup_before_write=False)
    errors: list[Exception] = []

    def create(index: int) -> None:
        try:
            repository.create({"name": f"Record {index}", "score": index})
        except Exception as exc:  # test captures failures across threads
            errors.append(exc)

    threads = [threading.Thread(target=create, args=(index,)) for index in range(30)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert errors == []
    assert len(repository.get_all()) == 30
    assert len({item.id for item in repository.get_all()}) == 30


def test_repository_transaction_uses_latest_record(tmp_path: Path) -> None:
    repository = JsonRepository(tmp_path / "examples.json", ExampleRecord, backup_before_write=False)
    item = repository.create({"name": "Counter", "score": 0})
    for _ in range(5):
        repository.transact(item.id, lambda current: {"score": current["score"] + 1})
    assert repository.require(item.id).score == 5

