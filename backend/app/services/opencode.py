from __future__ import annotations

import json
import re
import threading
import time
from collections.abc import Iterator
from typing import Any

import httpx

RESULT_START = "---VULNEXA_RESULT_START---"
RESULT_END = "---VULNEXA_RESULT_END---"


class OpenCodeError(RuntimeError):
    def __init__(self, status: int | None, message: str) -> None:
        self.status = status
        super().__init__(message)


class OpenCodeClient:
    """Minimal client for a local ``opencode serve`` instance (default 127.0.0.1:4096)."""

    def __init__(self, base_url: str = "http://127.0.0.1:4096", timeout: float = 15.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._event_client: httpx.Client | None = None

    def _get_event_client(self) -> httpx.Client:
        if self._event_client is None or self._event_client.is_closed:
            self._event_client = httpx.Client(timeout=httpx.Timeout(connect=5.0, read=None))
        return self._event_client

    def close_events(self) -> None:
        if self._event_client is not None:
            try:
                self._event_client.close()
            except Exception:  # noqa: BLE001
                pass
            self._event_client = None

    def stream_session_events(self, session_id: str, on_event: Any) -> None:
        """Consume the global live event stream, calling ``on_event(part)`` for each
        ``message.part.updated`` belonging to the given session. Blocks until stopped."""
        client = self._get_event_client()
        with client.stream("GET", f"{self.base_url}/api/event") as resp:
            resp.raise_for_status()
            data_lines: list[str] = []
            for line in resp.iter_lines():
                line = line.rstrip("\n")
                if line.startswith("data:"):
                    data_lines.append(line[5:].strip())
                elif line == "":
                    if data_lines:
                        raw = "\n".join(data_lines)
                        try:
                            payload = json.loads(raw)
                        except json.JSONDecodeError:
                            payload = {}
                        if payload.get("type") == "message.part.updated":
                            data = payload.get("data") or {}
                            if data.get("sessionID") == session_id:
                                part = data.get("part") or {}
                                if part:
                                    on_event(part)
                    data_lines = []

    def _post(self, path: str, json: dict[str, Any] | None = None) -> Any:
        try:
            resp = httpx.post(f"{self.base_url}{path}", json=json, timeout=self.timeout)
        except httpx.HTTPError as exc:
            raise OpenCodeError(None, f"opencode server unreachable: {exc}") from exc
        if resp.status_code >= 400:
            raise OpenCodeError(resp.status_code, resp.text[:300])
        return resp.json()

    def create_session(self, title: str = "Vulnexa scan") -> str:
        # Auto-allow tools/skills so the authorized scan runs headless without blocking on prompts.
        payload: dict[str, Any] = {
            "title": title,
            "permission": [{"permission": "*", "pattern": "*", "action": "allow"}],
        }
        return self._post("/session", payload)["id"]

    def send_message(
        self,
        session_id: str,
        text: str,
        system: str | None = None,
        model: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"parts": [{"type": "text", "text": text}]}
        if system:
            body["system"] = system
        if model:
            body["model"] = model
        try:
            resp = httpx.post(f"{self.base_url}/session/{session_id}/message", json=body, timeout=None)
        except httpx.HTTPError as exc:
            raise OpenCodeError(None, f"message send failed: {exc}") from exc
        if resp.status_code >= 400:
            raise OpenCodeError(resp.status_code, resp.text[:300])
        return resp.json()

    def abort(self, session_id: str) -> None:
        try:
            httpx.post(f"{self.base_url}/session/{session_id}/abort", timeout=self.timeout)
        except httpx.HTTPError:
            pass

    def get_history(self, session_id: str) -> list[dict[str, Any]]:
        """Fetch one page of public durable session events (best-effort)."""
        try:
            resp = httpx.get(f"{self.base_url}/api/session/{session_id}/history", timeout=self.timeout)
        except httpx.HTTPError:
            return []
        if resp.status_code >= 400:
            return []
        try:
            return resp.json().get("data") or []
        except (ValueError, AttributeError):
            return []

    def iter_events(self, session_id: str, stop: threading.Event | None = None) -> Iterator[dict[str, Any]]:
        """Stream SSE events from a session as ``{event, id, data}`` dicts."""
        with httpx.stream("GET", f"{self.base_url}/api/session/{session_id}/event", timeout=None) as resp:
            if resp.status_code >= 400:
                raise OpenCodeError(resp.status_code, resp.text[:300])
            event_name: str | None = None
            data_lines: list[str] = []
            for line in resp.iter_lines():
                if stop is not None and stop.is_set():
                    break
                line = line.rstrip("\n")
                if line.startswith("event:"):
                    event_name = line[6:].strip()
                elif line.startswith("data:"):
                    data_lines.append(line[5:].strip())
                elif line == "":
                    if data_lines:
                        raw = "\n".join(data_lines)
                        try:
                            payload = json.loads(raw)
                        except json.JSONDecodeError:
                            payload = {"raw": raw}
                        yield {
                            "event": payload.get("event") or event_name,
                            "id": payload.get("id"),
                            "data": payload.get("data", payload),
                        }
                    event_name = None
                    data_lines = []


def _walk_text(value: Any, out: list[str]) -> None:
    """Collect human-readable text/step strings from an opencode event payload."""
    if isinstance(value, str):
        if len(value.strip()) > 0:
            out.append(value)
        return
    if isinstance(value, dict):
        for key in ("text", "message", "label"):
            if isinstance(value.get(key), str) and value[key].strip():
                out.append(value[key])
        for val in value.values():
            _walk_text(val, out)
    elif isinstance(value, list):
        for val in value:
            _walk_text(val, out)


def parse_vulnexa_result(text: str) -> dict[str, Any] | None:
    """Extract the structured JSON the agent emits between RESULT delimiters."""
    if RESULT_START in text:
        tail = text.split(RESULT_START, 1)[1]
        if RESULT_END in tail:
            tail = tail.split(RESULT_END, 1)[0]
        try:
            return json.loads(tail)
        except json.JSONDecodeError:
            pass
    # Fallback: locate the first plausible JSON object anywhere in the reply.
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        candidate = match.group(0)
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
    return None


def run_scan(
    client: OpenCodeClient,
    target: str,
    command: str = "recon",
    system: str | None = None,
    session_id: str | None = None,
    max_seconds: float = 240.0,
) -> Iterator[dict[str, Any]]:
    """Drive an OpenCode agent scan and yield normalized client events.

    Live logs are polled (best-effort) from the session history while the message
    runs; the final structured JSON is parsed from the completed message.
    """
    if session_id is None:
        session_id = client.create_session(f"Vulnexa {command} · {target}")
    holder: dict[str, Any] = {}

    def _send() -> None:
        try:
            holder["message"] = client.send_message(session_id, f"/{command} {target}", system=system)
        except Exception as exc:  # noqa: BLE001 - surface as an error event
            holder["error"] = str(exc)

    thread = threading.Thread(target=_send, daemon=True)
    thread.start()

    yield {"type": "status", "text": f"opencode session {session_id}"}

    started = time.monotonic()
    seen = 0
    last_heartbeat = started
    while thread.is_alive() and "error" not in holder:
        for event in client.get_history(session_id):
            for text in _walk_text(event.get("data"), []):
                if text.strip():
                    yield {"type": "log", "level": "info", "text": text[:2000]}
        seen += 0
        if time.monotonic() - last_heartbeat >= 3.0:
            last_heartbeat = time.monotonic()
            yield {"type": "status", "text": f"scanning {target} · command /{command}"}
        if time.monotonic() - started > max_seconds:
            holder["error"] = "Scan exceeded the maximum duration and was stopped."
            client.abort(session_id)
            break
        time.sleep(1.5)

    thread.join(timeout=10)

    if holder.get("error"):
        yield {"type": "error", "message": holder["error"]}
        return

    message = holder.get("message") or {}
    parts = message.get("parts") or []
    full_text = "\n".join(str(part.get("text", "")) for part in parts if part.get("text"))
    for i in range(0, len(full_text), 2000):
        yield {"type": "log", "level": "info", "text": full_text[i : i + 2000]}
    result = parse_vulnexa_result(full_text)

    if result:
        yield {
            "type": "done",
            "target": target,
            "summary": result.get("summary") or result.get("executiveSummary") or "Assessment complete.",
            "assets": result.get("assets", []),
            "endpoints": result.get("endpoints", []),
            "findings": result.get("findings", []),
            "coverage": result.get("coverage", 60),
        }
    else:
        yield {"type": "done", "target": target, "summary": full_text[:3000], "assets": [], "endpoints": [], "findings": [], "coverage": 0}
