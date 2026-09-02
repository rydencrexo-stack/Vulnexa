"""Open Redirect scanner.

Sends the protocol/encoding bypass payload corpus against a redirect parameter
and detects:
  * 3xx responses with a Location header to the marker host (or an external host)
  * JS redirects (location.href / window.location / meta refresh) to the marker

Uses raw HTTP (no redirect-following, no strict URL parsing) so even malformed
redirect targets like ``//evil.com`` or ``%2f%2fevil.com`` are read correctly.

If no parameter is supplied the scanner auto-detects common redirect params by
probing with a harmless marker and watching for redirect behavior.
"""

from __future__ import annotations

import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit

from app.scanners.open_redirect_payloads import JS_REDIRECT_RE, REDIRECT_PARAMS, all_payloads
from app.scanners.xss_engine import normalize_target

MARKER = "evil.com"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: N802
        raise urllib.error.HTTPError(req.full_url, code, msg, headers, fp)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _raw_get(url: str, timeout: float) -> tuple[int | None, dict[str, str], str]:
    opener = urllib.request.build_opener(_NoRedirect)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        response = opener.open(request, timeout=timeout)
        body = response.read(30000).decode("utf-8", errors="replace")
        return response.status, {key.lower(): value for key, value in response.headers.items()}, body
    except urllib.error.HTTPError as exc:
        body = exc.read(30000).decode("utf-8", errors="replace")
        return exc.code, {key.lower(): value for key, value in exc.headers.items()}, body
    except Exception:  # noqa: BLE001 - any fetch failure just skips this payload
        return None, {}, ""


def _extract_js_redirect(body: str) -> str | None:
    for pattern in JS_REDIRECT_RE:
        match = re.search(pattern, body, re.IGNORECASE | re.DOTALL)
        if match and match.group(1):
            return match.group(1)
    return None


def _location_points_outside(location: str) -> bool:
    cleaned = location.strip().strip("'\"")
    lowered = cleaned.lower()
    if not lowered:
        return False
    return lowered.startswith("//") or lowered.startswith("http://") or lowered.startswith("https://") or lowered.startswith("http:") or lowered.startswith("https:") or lowered.startswith("%") or lowered.startswith("\\\\")


def scan_open_redirect(target: str, *, parameter: str | None = None, timeout: float = 6.0, max_payloads: int = 400) -> dict[str, Any]:
    started = time.monotonic()
    url = normalize_target(target)
    result: dict[str, Any] = {
        "target": url,
        "scannedAt": _now(),
        "durationSeconds": 0,
        "parameter": parameter or "",
        "autoDetected": False,
        "payloadsTested": 0,
        "requestsSent": 0,
        "findings": [],
        "log": [],
        "errors": [],
    }

    parsed = urlsplit(url)
    if not parsed.query:
        result["errors"].append("The target URL has no query parameters. Add a parameter that performs redirects, e.g. /redirect?url=https://example.com")
        result["durationSeconds"] = round(time.monotonic() - started, 2)
        return result

    params = dict(parse_qsl(parsed.query))
    base = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    candidates: list[str] = []
    if parameter:
        candidates = [parameter]
        if parameter not in params:
            params[parameter] = "https://example.com"
    else:
        auto, _ = next(((name, name) for name in REDIRECT_PARAMS if name in params), ("", ""))
        if auto:
            candidates = [auto]
            result["parameter"] = auto
            result["autoDetected"] = True
        else:
            for name in REDIRECT_PARAMS:
                probe_params = dict(params)
                probe_params[name] = f"//{MARKER}/probe"
                probe_url = f"{base}?{urlencode(probe_params)}"
                status, headers, body = _raw_get(probe_url, timeout)
                location = headers.get("location", "")
                js = _extract_js_redirect(body)
                if status in {301, 302, 303, 307, 308} and location and MARKER in location.lower():
                    candidates.append(name)
                elif js and MARKER in js.lower():
                    candidates.append(name)
                if len(candidates) >= 3:
                    break
            if candidates:
                result["parameter"] = candidates[0]
                result["autoDetected"] = True

    if not candidates:
        candidates = [next(iter(params.keys()))]
        result["parameter"] = candidates[0]
        result["autoDetected"] = False

    payloads = all_payloads()[:max_payloads]
    tested = 0
    for name in candidates:
        for payload in payloads:
            tested += 1
            test_params = dict(params)
            test_params[name] = payload
            test_url = f"{base}?{urlencode(test_params)}"
            result["log"].append(f"[{tested:04d}] {name}={payload}")
            status, headers, body = _raw_get(test_url, timeout)
            if status is None:
                continue
            result["requestsSent"] += 1
            location = headers.get("location", "")
            js = _extract_js_redirect(body)
            detected = None
            redirect_target = ""
            if status in {301, 302, 303, 307, 308} and location:
                if MARKER in location.lower():
                    detected = "http_redirect_location"
                    redirect_target = location
                elif _location_points_outside(location):
                    detected = "http_redirect_external"
                    redirect_target = location
            elif js:
                if MARKER in js.lower():
                    detected = "javascript_redirect"
                    redirect_target = js
                elif _location_points_outside(js):
                    detected = "javascript_redirect_external"
                    redirect_target = js
            if detected:
                result["findings"].append({
                    "id": f"oredirect-{name}-{tested}",
                    "title": f"Open redirect via {name}",
                    "severity": "high" if detected in {"http_redirect_location", "javascript_redirect"} else "medium",
                    "param": name,
                    "payload": payload,
                    "statusCode": status,
                    "location": redirect_target,
                    "detection": detected,
                    "evidence": f"{status} -> {redirect_target}",
                    "url": test_url,
                    "pocCurl": f'curl -s -i "{test_url}"',
                })
            if len(result["findings"]) >= 25:
                break
        if len(result["findings"]) >= 25:
            break

    result["payloadsTested"] = tested
    result["durationSeconds"] = round(time.monotonic() - started, 2)
    result["summary"] = {
        "findingsCount": len(result["findings"]),
        "payloadsTested": tested,
        "requestsSent": result["requestsSent"],
        "parameter": result["parameter"],
        "autoDetected": result["autoDetected"],
    }
    return result