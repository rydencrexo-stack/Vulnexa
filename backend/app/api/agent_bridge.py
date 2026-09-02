from __future__ import annotations

import asyncio
import json
import queue
import re
import threading
import time
from typing import Any

from fastapi import APIRouter, Depends, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, get_settings
from app.config import Settings
from app.security.auth import create_access_token, decode_access_token
from app.services.opencode import (
    OpenCodeClient,
    OpenCodeError,
    parse_vulnexa_result,
)
from app.utils.scope import is_public_address, normalize_host

router = APIRouter(prefix="/api/agent", tags=["bug-hunter"])

_ALLOWED_COMMANDS = {"recon", "analyze", "report", "assess"}
_ALLOWED_MODELS = {
    "deepseek-v4-flash": {"providerID": "opencode-go", "modelID": "deepseek-v4-flash"},
    "deepseek-v4-pro": {"providerID": "opencode-go", "modelID": "deepseek-v4-pro"},
}

_SENSITIVE_KEY_RE = re.compile(r"(?i)(authorization|cookie|credential|password|passwd|secret|token|api[_-]?key)")


def _clean_string_list(value: object, *, limit: int = 200, item_limit: int = 80) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned: list[str] = []
    for item in value[:limit]:
        text = str(item).strip()[:item_limit]
        if text and text not in cleaned:
            cleaned.append(text)
    return cleaned


def _redact_event_value(value: Any, key: str = "") -> Any:
    """Keep useful tool telemetry visible without leaking supplied credentials."""
    if _SENSITIVE_KEY_RE.search(key):
        return "[redacted]"
    if isinstance(value, dict):
        return {str(k): _redact_event_value(v, str(k)) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact_event_value(item, key) for item in value[:40]]
    if isinstance(value, str):
        return value[:8000]
    return value


def _redact_known_text(value: str, contexts: list[str]) -> str:
    redacted = value
    candidates: set[str] = set()
    for context in contexts:
        if not context:
            continue
        candidates.add(context.strip())
        for line in context.splitlines():
            line = line.strip()
            if len(line) >= 8:
                candidates.add(line)
            for separator in (":", "="):
                if separator in line:
                    tail = line.split(separator, 1)[1].strip()
                    if len(tail) >= 8:
                        candidates.add(tail)
    for secret in sorted((item for item in candidates if item), key=len, reverse=True):
        redacted = redacted.replace(secret, "[redacted]")
    return redacted


def _build_assessment_prompt(
    *,
    host: str,
    command: str,
    auth_profile: str,
    credentials: str,
    headers: str,
    notes: str,
    scoped_assets: list[str],
    phases: list[str],
    skills: list[str],
    model_id: str,
) -> str:
    """Create one evidence-led, non-destructive workflow for the OpenCode session."""
    phase_text = ", ".join(phases) or "complete authorized assessment"
    skill_text = ", ".join(skills) or "select applicable installed security skills"
    context: list[str] = [
        f"Target: {host}",
        f"Requested workflow: {command}",
        f"Selected phases: {phase_text}",
        f"Available/requested skill playbooks: {skill_text}",
        f"Required model: opencode-go/{model_id}",
    ]
    if scoped_assets:
        context.append("Recon Overview inventory (verify before testing): " + ", ".join(scoped_assets))
    if auth_profile and auth_profile not in {"None - non-authenticated", "None — non-authenticated"}:
        context.append(f"Authentication profile: {auth_profile}")
    if credentials:
        context.append("Operator-supplied test credentials (never echo or place in the report): " + credentials[:4000])
    if headers:
        context.append("Operator-supplied request headers (never echo secrets): " + headers[:4000])
    if notes:
        context.append("Operator notes: " + notes[:4000])

    return f"""You are Vulnexa Antigravity, an authorized web security assessment agent. Work only on the exact target and scoped subdomains below. Use safe, rate-limited, non-destructive checks. Do not perform denial of service, credential attacks, persistence, destructive writes, or access unrelated tenant data. Use minimal canary proofs and stop a test when impact is established.

Run the assessment as one continuous journal in this OpenCode session. Narrate each phase, command/tool purpose, observation, response differential, and limitation as it happens so the operator receives a complete live CLI transcript.

Required workflow:
1. Validate scope and build the asset journal from Recon Overview plus passive discovery.
2. Enumerate and verify subdomains and live services; record status, title, technology, and source.
3. Crawl HTML, forms, robots, sitemaps, archives, JavaScript bundles/chunks, and source maps. Extract REST, GraphQL, WebSocket, RPC and hidden API routes, hosts, methods, parameters, authentication hints, and client-side configuration. Test discovered APIs as first-class endpoints.
4. Load the installed baseline skills `bb-methodology`, `recon-scope-triage`, and `param-coverage-discipline`, then load only the relevant installed hunt skills. Give priority to `hunt-source-leak`, `hunt-spa-api`, `hunt-shadow-api`, `hunt-api-misconfig`, `hunt-access-control`, `hunt-web-injection`, and `hunt-xss-csrf`; choose additional requested skills when the detected stack or endpoint makes them applicable.
5. Build a coverage matrix for every requested class. Safely test authentication/authorization, IDOR/BOLA, session/JWT/OAuth, injection families, XSS/CSRF, SSRF, upload/path traversal, GraphQL/WebSocket, caching/CORS, redirects, business logic, subdomain takeover, secrets/source maps, TLS, cookies, security headers, version/CVE signals, and common misconfiguration. Mark each row confirmed, tested-no-finding, not-applicable, or blocked, with evidence.
6. Treat scanner output as leads, not confirmed vulnerabilities. Validate candidates with controls and response differentials. Report basic hardening issues too, but label best-practice-only observations accurately.
7. Finish with a detailed, evidence-backed report. Never invent hosts, requests, findings, impact, or successful exploitation.

At completion output strict JSON between ---VULNEXA_RESULT_START--- and ---VULNEXA_RESULT_END---. Include keys: summary, assets, endpoints, findings, coverage, coverageMatrix, methodology, limitations. Each asset should include hostname/url/status/title/technologies/source. Each endpoint should include url/method/kind/source/parameters/authHint/status. Each finding should include title/severity/confidence/source/endpoint/description/evidence/impact/reproduction/remediation/cwe/owasp/status. Coverage must be 0-100 and reflect actual tested surface, not elapsed time.

Engagement context:
{chr(10).join(context)}"""


@router.post("/ws-token")
def agent_ws_token(user: CurrentUser, settings: Settings = Depends(get_settings)) -> dict[str, object]:
    """Issue a short-lived token the browser can use to authenticate the agent WebSocket."""
    token = create_access_token(user.id, str(user.role), settings)
    return {"token": token, "expiresIn": settings.access_token_minutes * 60}


class ChatMessage(BaseModel):
    role: str
    content: str


class FastChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    context: str = ""


@router.post("/chat-fast")
def fast_chat(payload: FastChatRequest, request: Request, user: CurrentUser, settings: Settings = Depends(get_settings)) -> dict[str, object]:
    """Fast single-model chat (no agent loop) for the AI Analyst."""
    import httpx

    from app.services.offline_analyst import answer_question

    last_user = next(
        (m.content for m in reversed(payload.messages) if m.role == "user"),
        "",
    )
    if not settings.opencode_api_key:
        return {"reply": answer_question(last_user, request.app.state.repositories)}
    system = "You are Vulnexa's AI analyst. Answer clearly and concisely in the operator's language. Do not invent data."
    if payload.context:
        system += f"\nWorkspace context: {payload.context[:2000]}"
    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    for message in payload.messages[-12:]:
        messages.append({"role": message.role if message.role in ("user", "assistant") else "user", "content": message.content[:4000]})
    try:
        content = None
        for attempt in range(2):
            resp = httpx.post(
                f"{settings.opencode_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {settings.opencode_api_key}"},
                json={"model": settings.opencode_model, "messages": messages, "max_tokens": 900},
                timeout=60,
            )
            if resp.status_code == 429 and attempt < 1:
                time.sleep(1.5)
                continue
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            break
        if content is not None:
            return {"reply": content}
    except Exception:  # noqa: BLE001
        pass
    # Model unavailable (quota, rate limit, outage): answer from live data instead.
    return {"reply": answer_question(last_user, request.app.state.repositories)}


def _user_from_token(token: str, websocket: WebSocket) -> object | None:
    settings: Settings = websocket.app.state.settings
    repositories = websocket.app.state.repositories
    if not token:
        return None
    try:
        payload = decode_access_token(token, settings)
        user = repositories["users"].get_by_id(str(payload["sub"]))
        return user if user is not None and user.status == "active" else None
    except Exception:  # noqa: BLE001
        return None


def _authed_user(websocket: WebSocket, token: str | None = None) -> object | None:
    settings: Settings = websocket.app.state.settings
    repositories = websocket.app.state.repositories
    if token:
        user = _user_from_token(token, websocket)
        if user:
            return user
    token = websocket.cookies.get(settings.cookie_name)
    if not token:
        authorization = websocket.headers.get("Authorization", "")
        if authorization.lower().startswith("bearer "):
            token = authorization[7:].strip()
    return _user_from_token(token or "", websocket)


def _message_parts_lines(message: dict) -> list[str]:
    """Render an opencode assistant message as terminal lines (step + reasoning + text)."""
    lines: list[str] = []
    for part in message.get("parts") or []:
        ptype = part.get("type")
        if ptype == "reasoning":
            text = (part.get("text") or "").strip()
            if text:
                lines.append(f"[reasoning] {text}")
        elif ptype == "text":
            text = (part.get("text") or "").strip()
            if text:
                lines.append(text)
        elif ptype == "step-start":
            lines.append("[step] starting…")
        elif ptype == "step-finish":
            reason = part.get("reason") or ""
            lines.append(f"[step] finished ({reason})")
    return lines


@router.websocket("/ws")
async def agent_ws(websocket: WebSocket) -> None:
    """Live OpenCode agent session: runs an initial scan, then allows free chat
    on the same session until the client closes. Authenticated + target-scope guarded."""
    await websocket.accept()
    try:
        request = await websocket.receive_json()
    except (WebSocketDisconnect, Exception):  # noqa: BLE001
        await websocket.close(code=1008)
        return

    token = str(request.get("token") or "").strip() or None
    if _authed_user(websocket, token) is None:
        await websocket.send_text(json.dumps({"type": "error", "message": "Authentication failed."}))
        await websocket.close(code=4401)
        return

    target = str(request.get("target") or "").strip()
    command = str(request.get("command") or "assess").strip()
    if command not in _ALLOWED_COMMANDS:
        command = "assess"
    mode = str(request.get("mode") or "").strip()
    acknowledged = bool(request.get("acknowledged")) or mode == "chat"
    notes = str(request.get("notes") or "").strip()
    auth_profile = str(request.get("auth") or "").strip()
    credentials = str(request.get("credentials") or "").strip()
    headers = str(request.get("headers") or "").strip()
    model_name = str(request.get("model") or "deepseek-v4-flash").strip()
    model = _ALLOWED_MODELS.get(model_name, _ALLOWED_MODELS["deepseek-v4-flash"])
    recon_assets = request.get("reconAssets") or []
    if not isinstance(recon_assets, list):
        recon_assets = []
    phases = _clean_string_list(request.get("phases"), limit=40)
    skills = _clean_string_list(request.get("skills"), limit=160)

    if not acknowledged:
        await websocket.send_text(json.dumps({"type": "error", "message": "Authorization acknowledgment is required to start a scan."}))
        await websocket.close()
        return

    host = "chat"
    if mode != "chat":
        try:
            host = normalize_host(target)
        except Exception:  # noqa: BLE001
            await websocket.send_text(json.dumps({"type": "error", "message": "Target is not a valid domain."}))
            await websocket.close()
            return

        if not is_public_address(host, resolve_dns=True):
            await websocket.send_text(json.dumps({"type": "error", "message": "Target is not a public address (or could not be resolved). Private/loopback targets are blocked."}))
            await websocket.close()
            return

    client = OpenCodeClient()
    try:
        session_id = client.create_session("Vulnexa AI Analyst" if mode == "chat" else f"Vulnexa {command} · {host}")
    except OpenCodeError as exc:
        await websocket.send_text(json.dumps({"type": "error", "message": str(exc)}))
        await websocket.close()
        return

    await websocket.send_text(json.dumps({
        "type": "status",
        "kind": "session",
        "level": "ok",
        "text": f"connected · OpenCode session {session_id} · {model['modelID']} · {len(skills)} skill playbooks available",
        "sessionId": session_id,
        "model": model["modelID"],
        "skillCount": len(skills),
    }))

    outgoing: queue.Queue = queue.Queue()

    def run_prompt(text: str, tag: str, phase: str) -> None:
        """Send a prompt to the opencode session, streaming the agent's LIVE parts
        (reasoning, text, tool calls) via the event stream, then return the result."""
        holder: dict[str, object] = {}
        started = time.monotonic()
        streamed_any = False
        text_offsets: dict[str, int] = {}
        tool_snapshots: dict[str, str] = {}

        def _send() -> None:
            try:
                holder["message"] = client.send_message(session_id, text, model=model)
            except Exception as exc:  # noqa: BLE001
                holder["error"] = str(exc)

        def _on_part(part: dict) -> None:
            nonlocal streamed_any
            ptype = part.get("type")
            part_id = str(part.get("id") or f"{ptype}:{part.get('messageID') or 'current'}")
            if ptype in {"text", "reasoning"}:
                value = str(part.get("text") or "")
                previous = text_offsets.get(part_id, 0)
                if len(value) < previous:
                    previous = 0
                delta = value[previous:]
                text_offsets[part_id] = len(value)
                if delta:
                    streamed_any = True
                    outgoing.put({
                        "type": "log",
                        "kind": ptype,
                        "level": "ai" if ptype == "reasoning" else "info",
                        "text": _redact_known_text(delta, [credentials, headers]),
                    })
            elif ptype == "step-start":
                streamed_any = True
                outgoing.put({"type": "log", "kind": "step", "level": "info", "text": "[step] starting…"})
            elif ptype == "step-finish":
                streamed_any = True
                outgoing.put({"type": "log", "kind": "step", "level": "ok", "text": f"[step] finished ({part.get('reason') or 'complete'})"})
            elif ptype == "tool":
                name = part.get("tool") or part.get("name") or "tool"
                raw_state = part.get("state") or {}
                state = raw_state if isinstance(raw_state, dict) else {"status": str(raw_state)}
                safe_state = _redact_event_value(state)
                snapshot = json.dumps(safe_state, ensure_ascii=False, sort_keys=True, default=str)
                if tool_snapshots.get(part_id) == snapshot:
                    return
                tool_snapshots[part_id] = snapshot
                status = str(state.get("status") or "update")
                title = str(state.get("title") or "").strip()
                detail: list[str] = [f"[tool] {name} · {status}" + (f" · {title}" if title else "")]
                if state.get("input") is not None:
                    detail.append("input  " + json.dumps(_redact_event_value(state.get("input")), ensure_ascii=False, default=str)[:8000])
                if state.get("output") not in (None, ""):
                    detail.append("output " + str(_redact_event_value(state.get("output")))[:12000])
                if state.get("error") not in (None, ""):
                    detail.append("error  " + str(_redact_event_value(state.get("error")))[:8000])
                streamed_any = True
                outgoing.put({
                    "type": "log",
                    "kind": "tool",
                    "level": "err" if status == "error" else "ok" if status == "completed" else "cmd",
                    "text": _redact_known_text("\n".join(detail), [credentials, headers]),
                    "tool": str(name),
                    "toolStatus": status,
                })

        def _events() -> None:
            try:
                client.stream_session_events(session_id, _on_part)
            except Exception:  # noqa: BLE001
                pass

        t_send = threading.Thread(target=_send, daemon=True)
        t_ev = threading.Thread(target=_events, daemon=True)
        t_send.start()
        t_ev.start()

        last_status = 0
        while t_send.is_alive():
            elapsed = int(time.monotonic() - started)
            if elapsed > 3600:
                holder["error"] = "The agent did not respond within 1 hour."
                client.abort(session_id)
                break
            if elapsed - last_status >= 10:
                last_status = elapsed
                outgoing.put({"type": "status", "kind": "heartbeat", "level": "info", "text": f"agent working… {elapsed}s · {tag}", "elapsed": elapsed})
            time.sleep(1.5)

        client.close_events()  # unblocks the event listener now that the run is done
        t_ev.join(timeout=3)
        t_send.join(timeout=5)

        if holder.get("error"):
            outgoing.put({"type": "error", "message": str(holder["error"])})
            return

        message = holder.get("message") or {}
        if not streamed_any:
            for line in _message_parts_lines(message):
                outgoing.put({"type": "log", "kind": "text", "level": "info", "text": _redact_known_text(line, [credentials, headers])})

        text = "\n".join(str(part.get("text", "")) for part in (message.get("parts") or []) if part.get("text"))
        result = parse_vulnexa_result(text)
        if result:
            result = json.loads(_redact_known_text(json.dumps(result, ensure_ascii=False, default=str), [credentials, headers]))
            outgoing.put({
                "type": "done",
                "phase": phase,
                "target": target,
                "summary": result.get("summary") or result.get("executiveSummary") or "Assessment complete.",
                "assets": result.get("assets", []),
                "endpoints": result.get("endpoints", []),
                "findings": result.get("findings", []),
                "coverage": result.get("coverage", 60),
                "result": result,
            })
        else:
            outgoing.put({"type": "done", "phase": phase, "target": target, "summary": text[:3000], "assets": [], "endpoints": [], "findings": [], "coverage": 0})

    # Kick off the initial scan (skip in chat mode — the agent just chats).
    if mode != "chat":
        scoped_assets: list[str] = []
        for value in recon_assets[:200]:
            try:
                asset = normalize_host(str(value))
            except Exception:  # noqa: BLE001
                continue
            if asset == host or asset.endswith("." + host):
                scoped_assets.append(asset)
        initial_prompt = _build_assessment_prompt(
            host=host,
            command=command,
            auth_profile=auth_profile,
            credentials=credentials,
            headers=headers,
            notes=notes,
            scoped_assets=sorted(set(scoped_assets)),
            phases=phases,
            skills=skills,
            model_id=model["modelID"],
        )
        threading.Thread(target=run_prompt, args=(initial_prompt, "full assessment", "scan"), daemon=True).start()

    try:
        while True:
            try:
                msg = outgoing.get_nowait()
            except queue.Empty:
                control = None
                try:
                    control = await asyncio.wait_for(websocket.receive_json(), timeout=0.5)
                except asyncio.TimeoutError:
                    control = None
                except WebSocketDisconnect:
                    client.abort(session_id)
                    break
                except Exception:  # noqa: BLE001 - transient read error, do not kill the scan
                    control = None

                if control is not None:
                    action = control.get("action")
                    if action == "close":
                        client.abort(session_id)
                        break
                    if action == "chat":
                        text = str(control.get("text") or "").strip()
                        if text:
                            outgoing.put({"type": "log", "kind": "operator", "level": "cmd", "text": f"> {text}"})
                            threading.Thread(target=run_prompt, args=(text, "chat", "chat"), daemon=True).start()
                    continue

                await asyncio.sleep(0.1)
                continue

            if msg.get("type") == "__end__":
                break
            await websocket.send_text(json.dumps(msg, default=str))
    finally:
        await websocket.close()
