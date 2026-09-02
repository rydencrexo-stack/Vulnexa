from __future__ import annotations

from pathlib import Path

import pytest

from app.services.combo_store import ComboStore, split_record


@pytest.fixture()
def store(tmp_path: Path) -> ComboStore:
    dataset = tmp_path / "combolist"
    dataset.mkdir(exist_ok=True)
    (dataset / "example.txt").write_text(
        "\n".join(
            [
                "example.com:alice@example.com:hunter2",
                "mastersofterp.in:root:toor",
                "foo.net:bob:hunter2",
                "example.com:carol@example.com:pass:with:colons",
                "example.org:alice@example.com:s3cret",
                "nonsense line without separators",
                "plain:pass",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    return ComboStore(dataset)


def test_split_record_url_login_pass():
    assert split_record("example.com:alice@example.com:hunter2") == (
        "example.com",
        "alice@example.com",
        "hunter2",
    )


def test_split_record_password_with_colons():
    assert split_record("example.com:carol:s3cret") == ("example.com", "carol", "s3cret")


def test_split_record_login_pass():
    assert split_record("plain:pass") == (None, "plain", "pass")


def test_by_domain(store: ComboStore):
    result = store.by_domain("example.com")
    assert len(result.matches) == 2
    assert "example.com:alice@example.com:hunter2" in result.matches
    assert "mastersofterp.in:root:toor" not in result.matches


def test_by_login(store: ComboStore):
    result = store.by_login("alice@example.com")
    assert len(result.matches) == 2


def test_by_password(store: ComboStore):
    result = store.by_password("hunter2")
    assert len(result.matches) == 2


def test_by_email(store: ComboStore):
    result = store.by_email("alice@example.com")
    assert len(result.matches) == 2


def test_by_keyword(store: ComboStore):
    result = store.by_keyword("mastersofterp")
    assert result.matches == ["mastersofterp.in:root:toor"]


def test_empty_dataset(tmp_path: Path):
    empty = ComboStore(tmp_path / "does-not-exist")
    result = empty.by_domain("anything")
    assert result.matches == []
    assert result.lines_scanned == 0