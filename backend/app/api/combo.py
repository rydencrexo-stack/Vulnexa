from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.api.deps import AppSettings, CurrentUser, get_settings
from app.config import Settings
from app.services.combo_store import ComboStore, split_record

router = APIRouter(prefix="/api/combo", tags=["combo"])

SEARCH_TYPES = {"domain", "login", "password", "mail", "keyword"}
FORMAT = "url:login:pass"
LOGIN_PREVIEW = 100


class ComboSearchRequest(BaseModel):
    searchType: str = Field(..., description="domain | login | password | mail | keyword")
    query: str = Field(..., min_length=1, max_length=512)
    premium: bool = False


def _store(settings: Settings) -> ComboStore:
    return ComboStore(settings.data_directory / "combolist")


@router.post("/search")
def combo_search(
    payload: ComboSearchRequest,
    _user: CurrentUser,
    settings: AppSettings,
) -> dict[str, object]:
    """Search the local, operator-controlled dataset (url:login:pass)."""
    search_type = payload.searchType.strip().lower()
    if search_type not in SEARCH_TYPES:
        raise HTTPException(status_code=400, detail=f"searchType must be one of: {', '.join(sorted(SEARCH_TYPES))}")

    store = _store(settings)
    dispatch = {
        "domain": store.by_domain,
        "login": store.by_login,
        "password": store.by_password,
        "mail": store.by_email,
        "keyword": store.by_keyword,
    }
    result = dispatch[search_type](payload.query)

    free_sample = 500
    premium_sample = 100_000
    total = len(result.matches)
    shown = min(total, premium_sample if payload.premium else free_sample)
    results = result.matches[: min(shown, 5_000)]

    logins: list[str] = []
    seen_logins: set[str] = set()
    for line in result.matches[:LOGIN_PREVIEW]:
        _, login, _ = split_record(line)
        if login and login not in seen_logins:
            seen_logins.add(login)
            logins.append(login)

    preview: list[str] = []
    seen_preview: set[str] = set()
    for line in result.matches[:LOGIN_PREVIEW]:
        url, login, password = split_record(line)
        if not login:
            continue
        record = f"{url or ''} {login} {password}".strip()
        if record not in seen_preview:
            seen_preview.add(record)
            preview.append(record)

    return {
        "format": FORMAT,
        "searchType": search_type,
        "query": payload.query,
        "premium": payload.premium,
        "total": total,
        "shown": shown,
        "freeSample": free_sample,
        "premiumSample": premium_sample,
        "linesScanned": result.lines_scanned,
        "filesScanned": result.files_scanned,
        "logins": logins,
        "preview": preview,
        "results": results,
    }


@router.get("/export")
def combo_export(
    searchType: str,
    query: str,
    premium: bool = False,
    _user: CurrentUser = None,  # type: ignore[assignment]
    settings: Settings = Depends(get_settings),
) -> Response:
    """Download the full matching dataset as a text file (auth required)."""
    if _user is None:
        raise HTTPException(status_code=401, detail="Authentication is required.")
    del _user
    search_type = (searchType or "").strip().lower()
    if search_type not in SEARCH_TYPES or not query.strip():
        raise HTTPException(status_code=400, detail="Invalid searchType or query")

    store = _store(settings)
    dispatch = {
        "domain": store.by_domain,
        "login": store.by_login,
        "password": store.by_password,
        "mail": store.by_email,
        "keyword": store.by_keyword,
    }
    result = dispatch[search_type](query.strip())
    limit = 100_000 if premium else 500
    sample = result.matches[:limit]
    body = ("\n".join(sample) + "\n").encode("utf-8", errors="ignore")
    safe_name = "".join(c if c.isalnum() or c in ".-_" else "_" for c in query.strip())[:40] or "search"
    return Response(
        content=body,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.txt"'},
    )