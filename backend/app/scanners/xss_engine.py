"""Dalfox XSS scanning engine (https://github.com/hahwul/dalfox).

Runs the real ``dalfox`` binary against a single authorized target and
normalizes its JSON findings. The exact CLI command and raw output are
returned so the UI can show the terminal too.

Dalfox discovery order:
  1. ``DALFOX_PATH`` environment variable
  2. the repository ``backend/bin`` directory (bundled binary)
  3. ``dalfox`` on PATH

If no binary is found the engine still returns the exact CLI command that
would run, so the UI can show a copy-paste terminal preview.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

BASE_DIR = Path(__file__).resolve().parents[2]

SEVERITY_MAP = {
    "Critical": "critical",
    "High": "high",
    "Medium": "medium",
    "Low": "low",
    "Informational": "informational",
}

TYPE_LABELS = {
    "V": "Vulnerable",
    "R": "Reflected",
    "A": "DOM (AST) XSS",
    "I": "Informational",
}

URL_RE = re.compile(r"^https?://", re.IGNORECASE)
DOMAIN_RE = re.compile(
    r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:/.*)?$",
    re.IGNORECASE,
)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def find_dalfox() -> str | None:
    import os

    configured = os.getenv("DALFOX_PATH")
    if configured and Path(configured).exists():
        return str(Path(configured).resolve())
    bundled = sorted(BASE_DIR.glob("bin/**/dalfox.exe"))
    if bundled:
        return str(bundled[0])
    bundled_unix = sorted(BASE_DIR.glob("bin/**/dalfox"))
    if bundled_unix:
        return str(bundled_unix[0])
    return shutil.which("dalfox")


def normalize_target(target: str) -> str:
    value = target.strip()
    if not value:
        raise ValueError("target is required")
    if URL_RE.match(value):
        parsed = urlsplit(value)
        if parsed.scheme.lower() not in {"http", "https"}:
            raise ValueError("only http and https targets are supported")
        if parsed.username or parsed.password:
            raise ValueError("target URLs cannot contain credentials")
        return value
    if not DOMAIN_RE.match(value):
        raise ValueError("enter a valid domain or http(s) URL — e.g. example.com or https://example.com/path")
    return f"https://{value}"


def run_dalfox(target: str, *, timeout: float = 150.0, dalfox_path: str | None = None) -> dict[str, Any]:
    """Run dalfox against a target and return normalized results + CLI output."""
    started = time.monotonic()
    binary = dalfox_path or find_dalfox()
    command = ["url", "--url", target, "--format", "json", "--silence", "--no-color"]
    version = None

    if binary:
        try:
            version_result = subprocess.run(
                [binary, "version"], capture_output=True, text=True, timeout=20,
            )
            version_text = (version_result.stdout or version_result.stderr or "")
            version_match = re.search(r"\bv?\d+\.\d+\.\d+\b", version_text)
            version = version_match.group(0) if version_match else (version_text.strip().splitlines()[-1].strip() if version_text.strip() else None)
        except Exception:  # noqa: BLE001
            version = None

    result: dict[str, Any] = {
        "target": target,
        "scannedAt": _now(),
        "durationSeconds": 0,
        "cliInstalled": binary is not None,
        "cli": {
            "binary": binary,
            "command": ["dalfox", *command],
            "commandString": f"dalfox {' '.join(command)}",
            "version": version,
            "output": [],
            "exitCode": None,
        },
        "summary": {"findingsCount": 0, "totalRequests": 0, "scanDurationMs": 0, "incomplete": False, "status": "adapter_not_installed"},
        "findings": [],
        "errors": [],
    }

    if not binary:
        result["errors"].append("Dalfox binary was not found. Install it with `go install github.com/hahwul/dalfox/v2@latest` or set DALFOX_PATH.")
        return result

    try:
        proc = subprocess.run(
            [binary, *command],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(BASE_DIR),
        )
    except subprocess.TimeoutExpired:
        result["errors"].append(f"Dalfox exceeded the {int(timeout)}s timeout and was stopped.")
        result["cli"]["exitCode"] = -9
        result["durationSeconds"] = round(time.monotonic() - started, 2)
        return result
    except OSError as exc:
        result["errors"].append(f"Could not run Dalfox: {exc}")
        result["durationSeconds"] = round(time.monotonic() - started, 2)
        return result

    stdout = proc.stdout or ""
    stderr = proc.stderr or ""
    result["cli"]["exitCode"] = proc.returncode
    for line in (stdout + "\n" + stderr).splitlines():
        if line.strip():
            result["cli"]["output"].append(line.strip())

    payload: dict[str, Any] | None = None
    if stdout.strip():
        try:
            payload = json.loads(stdout)
        except (ValueError, TypeError):
            payload = None

    if payload is None:
        result["errors"].append("Dalfox did not return parseable JSON output.")
        result["cli"]["rawOutput"] = stdout[:4000]
        result["durationSeconds"] = round(time.monotonic() - started, 2)
        return result

    meta = payload.get("meta", {})
    result["summary"] = {
        "findingsCount": meta.get("findings_count", 0),
        "totalRequests": meta.get("total_requests", 0),
        "scanDurationMs": meta.get("scan_duration_ms", 0),
        "incomplete": meta.get("incomplete", False),
        "status": (meta.get("target_summary") or [{}])[0].get("status", "unknown"),
        "targetSummary": meta.get("target_summary", []),
    }
    result["findings"] = [_normalize_finding(item, target) for item in payload.get("findings", [])]
    result["durationSeconds"] = round(time.monotonic() - started, 2)
    return result


def _normalize_finding(item: dict[str, Any], target: str) -> dict[str, Any]:
    parameter = item.get("param", "?")
    finding_type = item.get("type", "")
    type_label = TYPE_LABELS.get(finding_type, item.get("type_description", "XSS"))
    if finding_type == "A":
        title = f"DOM XSS via parameter {parameter}"
    elif finding_type == "R":
        title = f"Reflected input via parameter {parameter}"
    else:
        title = f"Reflected XSS via parameter {parameter}"
    url = item.get("data") or target
    severity = SEVERITY_MAP.get(item.get("severity", ""), "medium")
    evidence = item.get("evidence") or item.get("message_str") or ""
    return {
        "id": f"xss-{parameter or 'param'}-{finding_type or 'v'}",
        "title": title,
        "severity": severity,
        "type": finding_type,
        "typeLabel": type_label,
        "confidence": item.get("confidence", "medium"),
        "confidenceReason": item.get("confidence_reason", ""),
        "cwe": item.get("cwe", "CWE-79"),
        "method": item.get("method", "GET"),
        "param": parameter,
        "payload": item.get("payload", ""),
        "injectType": item.get("inject_type", ""),
        "location": item.get("location", "Query"),
        "detectionMethod": item.get("detection_method", ""),
        "evidence": evidence,
        "url": url,
        "pocCurl": f'curl -s "{url}"',
    }


def scan_xss(target: str, *, timeout: float = 150.0, dalfox_path: str | None = None) -> dict[str, Any]:
    normalized = normalize_target(target)
    return run_dalfox(normalized, timeout=timeout, dalfox_path=dalfox_path)


if __name__ == "__main__":
    import sys

    result = scan_xss(sys.argv[1] if len(sys.argv) > 1 else "https://example.com")
    print(json.dumps(result, indent=2))