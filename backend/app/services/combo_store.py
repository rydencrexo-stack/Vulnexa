from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

logger = logging.getLogger("pan.combo_store")


def split_record(line: str) -> tuple[str | None, str, str]:
    """Parse a combolist line into (url, login, password).

    Supported shapes (colon-delimited, password may itself contain colons):
      url:login:pass
      email:pass
      login:pass

    Returns url (may be None), login, password.
    """
    stripped = line.lstrip("\ufeff").strip()
    if not stripped:
        return None, "", ""
    parts = stripped.split(":", 2)
    if len(parts) == 3:
        return parts[0].strip(), parts[1].strip(), parts[2].strip()
    if len(parts) == 2:
        return None, parts[0].strip(), parts[1].strip()
    return None, parts[0].strip(), ""


def format_record(url: str | None, login: str, password: str) -> str:
    return f"{url or ''}:{login}:{password}"


class SearchMatch:
    __slots__ = ("url", "login", "password")

    def __init__(self, url: str | None, login: str, password: str) -> None:
        self.url = url
        self.login = login
        self.password = password

    def to_line(self) -> str:
        return format_record(self.url, self.login, self.password)


@dataclass(slots=True)
class SearchResult:
    matches: list[str]
    lines_scanned: int
    files_scanned: int


class ComboStore:
    """Streaming search over local, operator-controlled combolist datasets.

    Only search against data you are authorized to hold. The store never
    writes to the dataset; it is strictly a read-only query layer.
    """

    def __init__(self, data_dir: str | Path, *, line_limit: int = 500_000) -> None:
        self.data_dir = Path(data_dir)
        self.line_limit = line_limit

    def dataset_files(self) -> list[Path]:
        if not self.data_dir.exists():
            return []
        return sorted(p for p in self.data_dir.rglob("*.txt") if p.is_file())

    def _lines(self) -> Iterable[str]:
        for path in self.dataset_files():
            try:
                with path.open("r", encoding="utf-8", errors="ignore") as handle:
                    for raw in handle:
                        yield raw
            except OSError as exc:
                logger.warning("combo_store: could not read %s: %s", path, exc)

    def _search(self, predicate) -> SearchResult:
        seen: set[str] = set()
        matches: list[str] = []
        lines = 0
        files = 0
        for path in self.dataset_files():
            files += 1
            scanned_in_file = 0
            try:
                with path.open("r", encoding="utf-8", errors="ignore") as handle:
                    for raw in handle:
                        if scanned_in_file >= self.line_limit:
                            break
                        lines += 1
                        scanned_in_file += 1
                        url, login, password = split_record(raw)
                        if not login and not password:
                            continue
                        if predicate(url, login, password):
                            line = format_record(url, login, password)
                            if line not in seen:
                                seen.add(line)
                                matches.append(line)
            except OSError as exc:
                logger.warning("combo_store: could not read %s: %s", path, exc)
        return SearchResult(matches=matches, lines_scanned=lines, files_scanned=files)

    @staticmethod
    def _contains(haystack: str | None, needle: str) -> bool:
        return bool(haystack) and needle.lower() in haystack.lower()

    def by_domain(self, domain: str) -> SearchResult:
        needle = domain.strip().lower().lstrip("*")
        return self._search(lambda url, login, password: self._contains(url, needle))

    def by_login(self, login: str) -> SearchResult:
        needle = login.strip().lower()
        return self._search(lambda url, l, password: self._contains(l, needle))

    def by_password(self, password: str) -> SearchResult:
        needle = password.strip()
        return self._search(lambda url, login, p: self._contains(p, needle))

    def by_email(self, email: str) -> SearchResult:
        needle = email.strip().lower()
        return self._search(
            lambda url, login, password: self._contains(login, needle) or self._contains(url, needle)
        )

    def by_keyword(self, keyword: str) -> SearchResult:
        needle = keyword.strip().lower()
        return self._search(
            lambda url, login, password: self._contains(url, needle)
            or self._contains(login, needle)
            or self._contains(password, needle)
        )