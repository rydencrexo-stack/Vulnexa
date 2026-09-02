from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from app.models.domain import Role, User
from app.repositories.json_repository import JsonRepository
from app.utils.errors import not_found


def visible_items(repository: JsonRepository[Any], user: User) -> list[Any]:
    items = repository.get_all()
    if user.role == Role.ADMIN:
        return items
    return [item for item in items if getattr(item, "workspace_id", None) in user.workspace_ids]


def visible_record(repository: JsonRepository[Any], record_id: str, user: User, label: str) -> Any:
    item = repository.get_by_id(record_id)
    if item is None:
        raise not_found(label)
    workspace_id = getattr(item, "workspace_id", None)
    if user.role != Role.ADMIN and workspace_id is not None and workspace_id not in user.workspace_ids:
        # Intentionally indistinguishable from a missing object.
        raise not_found(label)
    return item


def query_items(
    repository: JsonRepository[Any],
    items: Iterable[Any],
    *,
    page: int,
    page_size: int,
    sort_by: str,
    sort_order: str,
) -> dict[str, Any]:
    sorted_items = repository.sort(sort_by, descending=sort_order.lower() == "desc", items=items)
    return repository.paginate(page=page, page_size=page_size, items=sorted_items)


def contains_search(item: Any, query: str, fields: tuple[str, ...]) -> bool:
    needle = query.casefold()
    return any(needle in str(getattr(item, field, "")).casefold() for field in fields)

