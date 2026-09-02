from __future__ import annotations

import asyncio
import os

from fastapi import APIRouter, Body, Request, WebSocket, WebSocketDisconnect

from app.api.common import visible_record
from app.api.deps import CurrentUser, Repositories, ensure_workspace_access
from app.schemas.requests import AgentRunRequest, AgentScanRequest
from app.services.agent import AgentService
from app.utils.errors import not_found


router = APIRouter(prefix="/api/agent", tags=["bug-hunter"])

_ALLOWED_PHASES = {"subdomains", "endpoints", "hidden", "passive", "cred-leak", "static", "cve", "emails", "virustotal"}


@router.websocket("/terminal")
async def terminal(websocket: WebSocket) -> None:
    """Interactive local shell over WebSocket. Each command is run in its own shell and
    its combined stdout/stderr is streamed back line-by-line.

    This is a local-only development tool (the backend binds to 127.0.0.1). A valid
    login session is still required because this endpoint can execute local commands."""
    settings = websocket.app.state.settings
    token = websocket.cookies.get(settings.cookie_name)
    if not token:
        await websocket.close(code=4001)
        return
    try:
        from app.security.auth import decode_access_token
        payload_data = decode_access_token(token, settings)
        user_id = str(payload_data.get("sub"))
        user = websocket.app.state.repositories["users"].get_by_id(user_id)
        if user is None or user.status != "active":
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.close(code=4001)
        return

    await websocket.accept()

    env = dict(os.environ)

    async def run_command(command: str) -> None:
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                env=env,
            )
            assert proc.stdout is not None
            while True:
                line = await proc.stdout.readline()
                if not line:
                    break
                await websocket.send_json({"type": "out", "data": line.decode("utf-8", "replace")})
            code = await proc.wait()
            await websocket.send_json({"type": "exit", "data": str(code)})
        except Exception as exc:
            await websocket.send_json({"type": "error", "data": f"command failed: {exc}"})

    try:
        while True:
            msg = await websocket.receive_text()
            if msg == "\x00__EXIT__\x00":
                break
            # Allow setting environment for the shell (e.g. API keys) via JSON.
            if msg.startswith("__ENV__"):
                try:
                    import json as _json
                    updates = _json.loads(msg[len("__ENV__"):])
                    if isinstance(updates, dict):
                        for k, v in updates.items():
                            if v:
                                env[k] = str(v)
                        await websocket.send_json({"type": "sys", "data": f"[env] {len(updates)} variable(s) set"})
                        continue
                except Exception as exc:
                    await websocket.send_json({"type": "error", "data": f"env error: {exc}"})
                    continue
            await run_command(msg)
    except WebSocketDisconnect:
        pass
    finally:
        await websocket.close()


@router.post("/scan")
def scan_domain(payload: AgentScanRequest, request: Request, _user: CurrentUser) -> dict[str, object]:
    """Real authorized scan against an arbitrary user-provided domain."""
    service = AgentService(request.app.state.settings)
    return service.run_domain(
        payload.domain,
        phases=[phase for phase in payload.phases if phase in _ALLOWED_PHASES],
        skills=payload.skills,
        auth=payload.auth,
    )


@router.post("/run")
def run_agent(
    payload: AgentRunRequest,
    request: Request,
    repositories: Repositories,
    user: CurrentUser,
) -> dict[str, object]:
    ensure_workspace_access(user, payload.workspace_id)
    if payload.target_id:
        target = visible_record(repositories["targets"], payload.target_id, user, "Target")
    elif payload.domain:
        # Find the target matching the requested domain within an accessible workspace.
        candidates = [
            candidate
            for candidate in repositories["targets"].filter(workspace_id=payload.workspace_id)
            if candidate.domain.lower() == payload.domain.lower()
        ]
        if not candidates:
            raise not_found("Target for the requested domain")
        target = candidates[0]
    else:
        raise not_found("A target or domain is required")

    settings = request.app.state.settings
    service = AgentService(settings)
    result = service.run(
        target,
        phases=[phase for phase in payload.phases if phase in _ALLOWED_PHASES],
        skills=payload.skills,
        auth=payload.auth,
    )
    repositories["reports"].create(
        {
            "workspace_id": payload.workspace_id,
            "target_id": target.id,
            "scan_id": None,
            "name": result["name"],
            "type": "AI Bug Hunter",
            "status": "completed",
            "formats": ["json", "html", "csv"],
            "files": {fmt: path.split("/")[-1] for fmt, path in result["artifacts"].items()},
            "summary": {"total": len(result["findings"])},
            "generated_by": user.id,
            "generated_at": result["generatedAt"],
        }
    )
    return result
