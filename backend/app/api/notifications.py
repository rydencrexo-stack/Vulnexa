from __future__ import annotations

from fastapi import APIRouter, Query

from app.api.common import query_items, visible_items, visible_record
from app.api.deps import CurrentUser, Repositories
from app.schemas.requests import NotificationRead


router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _is_read(notification: object, user_id: str) -> bool:
    return bool(notification.read or (notification.user_id is None and user_id in notification.read_by_ids))


def _public_notification(notification: object, user_id: str) -> dict[str, object]:
    data = notification.model_dump(mode="json", by_alias=True)
    data["read"] = _is_read(notification, user_id)
    data.pop("readByIds", None)
    return data


@router.get("")
def list_notifications(
    repositories: Repositories,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, alias="pageSize", ge=1, le=200),
    notification_type: str | None = Query(default=None, alias="type"),
    unread_only: bool = Query(False, alias="unreadOnly"),
) -> dict[str, object]:
    items = [item for item in visible_items(repositories["notifications"], user) if item.user_id in {None, user.id}]
    if notification_type:
        items = [item for item in items if item.type == notification_type]
    if unread_only:
        items = [item for item in items if not _is_read(item, user.id)]
    result = query_items(
        repositories["notifications"], items, page=page, page_size=page_size, sort_by="createdAt", sort_order="desc"
    )
    result["items"] = [_public_notification(item, user.id) for item in result["items"]]
    return result


@router.patch("/{notification_id}")
def mark_notification(
    payload: NotificationRead, notification_id: str, repositories: Repositories, user: CurrentUser
) -> object:
    notification = visible_record(repositories["notifications"], notification_id, user, "Notification")
    if notification.user_id not in {None, user.id} and user.role != "admin":
        from app.utils.errors import not_found

        raise not_found("Notification")
    if notification.user_id is None:
        def update_broadcast(current: dict[str, object]) -> dict[str, object]:
            readers = list(current.get("readByIds", []))
            if payload.read and user.id not in readers:
                readers.append(user.id)
            elif not payload.read:
                readers = [reader for reader in readers if reader != user.id]
            return {"readByIds": readers}

        updated = repositories["notifications"].transact(notification.id, update_broadcast)
    else:
        updated = repositories["notifications"].update(notification.id, {"read": payload.read})
    return _public_notification(updated, user.id)


@router.post("/read-all")
def read_all_notifications(repositories: Repositories, user: CurrentUser) -> dict[str, int]:
    count = 0
    for item in visible_items(repositories["notifications"], user):
        if item.user_id not in {None, user.id} or _is_read(item, user.id):
            continue
        if item.user_id is None:
            repositories["notifications"].transact(
                item.id,
                lambda current: {
                    "readByIds": list(dict.fromkeys([*current.get("readByIds", []), user.id]))
                },
            )
        else:
            repositories["notifications"].update(item.id, {"read": True})
        count += 1
    return {"updated": count}
