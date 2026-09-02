"""Secrets exposure scanner (PAN engine).

Crawls a target's HTML + JavaScript (with source maps where present) and flags
credential/secret patterns. Detection combines regex signatures, context, and
high-entropy checks. Matches are redacted in evidence.

Optional repo tools (Gitleaks / TruffleHog) are detected and reported as
available adapters, but the URL-based PAN engine is the real scanner here.
"""

from __future__ import annotations

import base64
import binascii
import re
import time
import zlib
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin, urlsplit

import httpx

from app.scanners.xss_engine import normalize_target

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

SECRET_RULES: list[dict[str, Any]] = [
    {"name": "AWS Access Key", "severity": "high", "pattern": re.compile(r"\b(?:AKIA|ASIA|AIDA|AROA|AIPA|ANPA|ANVA|A3T)[0-9A-Z]{16}\b")},
    {"name": "AWS Secret Key", "severity": "high", "pattern": re.compile(r"(?i)aws.{0,20}?['\"\s:=]+([A-Za-z0-9/+=]{40})")},
    {"name": "GitHub Token", "severity": "high", "pattern": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b")},
    {"name": "GitLab Token", "severity": "medium", "pattern": re.compile(r"\bglpat-[A-Za-z0-9_\-]{20,}\b")},
    {"name": "Google API Key", "severity": "medium", "pattern": re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")},
    {"name": "Stripe Secret Key", "severity": "high", "pattern": re.compile(r"\bsk_(?:test|live)_[0-9a-zA-Z]{24,}\b")},
    {"name": "Stripe Publishable Key", "severity": "low", "pattern": re.compile(r"\bpk_(?:test|live)_[0-9a-zA-Z]{24,}\b")},
    {"name": "Slack Token", "severity": "high", "pattern": re.compile(r"\bxox[baprs]-\d{10,13}-[A-Za-z0-9]{10,40}\b")},
    {"name": "Slack Webhook", "severity": "high", "pattern": re.compile(r"https://hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+")},
    {"name": "Private Key Block", "severity": "critical", "pattern": re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----")},
    {"name": "JWT Token", "severity": "medium", "pattern": re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b")},
    {"name": "Bearer Token", "severity": "medium", "pattern": re.compile(r"(?i)\bBearer\s+[A-Za-z0-9\-._~+/]{20,}")},
    {"name": "Telegram Bot Token", "severity": "medium", "pattern": re.compile(r"\b\d{8,10}:[A-Za-z0-9_\-]{35}\b")},
    {"name": "SendGrid API Key", "severity": "medium", "pattern": re.compile(r"\bSG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}\b")},
    {"name": "Twilio API Key", "severity": "medium", "pattern": re.compile(r"\bSK[0-9a-fA-F]{32}\b")},
    {"name": "Heroku API Key", "severity": "medium", "pattern": re.compile(r"(?i)heroku.{0,20}?['\"\s:=]+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})")},
    {"name": "Firebase URL", "severity": "low", "pattern": re.compile(r"https://[a-z0-9-]+\.firebaseio\.com")},
    {"name": "SQL Connection String", "severity": "medium", "pattern": re.compile(r"(?i)(mysql|postgres|postgresql|mssql|mongodb(?:\+srv)?)://[^\s'\"]{6,}")},
    {"name": "Redis URL", "severity": "low", "pattern": re.compile(r"\bredis://[^\s'\"]{6,}")},
    {"name": "Generic Password Assignment", "severity": "medium", "pattern": re.compile(r"(?i)\b(password|passwd|pwd|api[_-]?key|secret|token|access[_-]?key)\s*[:=]\s*['\"][^'\"]{8,}['\"]")},
    {"name": "Generic Base64 Secret", "severity": "low", "pattern": re.compile(r"\b(?:secret|token|key)\s*[:=]\s*['\"]([A-Za-z0-9+/]{24,}={0,2})['\"]")},
]

MAX_SCRIPTS = 60
MAX_BODY = 800_000


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _redact(match: str) -> str:
    if len(match) <= 10:
        return "*" * len(match)
    return f"{match[:6]}…{match[-4:]}"


def _entropy(value: str) -> float:
    if not value:
        return 0.0
    import math

    counts: dict[str, int] = {}
    for char in value:
        counts[char] = counts.get(char, 0) + 1
    total = len(value)
    return -sum((count / total) * math.log2(count / total) for count in counts.values())


def _decode_sourcemap(content: bytes, base_url: str) -> tuple[str, list[str]]:
    """Return (decoded_source_content, extra_script_urls) from a source map."""
    text = ""
    urls: list[str] = []
    try:
        stripped = content.decode("utf-8", errors="replace")
        try:
            payload = __import__("json").loads(stripped)
            if isinstance(payload, dict) and "sourcesContent" in payload:
                text = "\n".join(str(item) for item in payload["sourcesContent"] if item)
            if isinstance(payload, dict) and "sources" in payload:
                for source in payload["sources"][:20]:
                    if isinstance(source, str) and "://" in source:
                        urls.append(source)
        except (ValueError, TypeError):
            if stripped.startswith("data:application/json;base64,"):
                raw = base64.b64decode(stripped.split(",", 1)[1])
                payload = __import__("json").loads(raw)
                if isinstance(payload, dict) and "sourcesContent" in payload:
                    text = "\n".join(str(item) for item in payload["sourcesContent"] if item)
    except (binascii.Error, ValueError, TypeError):
        pass
    return text, urls


def scan_secrets(target: str, *, timeout: float = 8.0, max_scripts: int = MAX_SCRIPTS) -> dict[str, Any]:
    started = time.monotonic()
    url = normalize_target(target)
    result: dict[str, Any] = {
        "target": url,
        "scannedAt": _now(),
        "durationSeconds": 0,
        "scriptsScanned": 0,
        "bodiesScanned": 0,
        "findings": [],
        "log": [],
        "errors": [],
    }
    client = httpx.Client(timeout=timeout, headers={"User-Agent": USER_AGENT}, follow_redirects=True, verify=True)

    texts: list[tuple[str, str]] = []  # (source_label, text)

    try:
        response = client.get(url)
    except httpx.HTTPError as exc:
        result["errors"].append(f"Could not fetch {url}: {exc}")
        result["durationSeconds"] = round(time.monotonic() - started, 2)
        client.close()
        return result

    result["log"].append(f"GET {url} -> {response.status_code}")
    body = response.text[:MAX_BODY]
    texts.append((url, body))
    result["bodiesScanned"] += 1

    script_urls: list[str] = []
    for match in re.finditer(r'<script[^>]+src=["\']([^"\']+)["\']', body, re.IGNORECASE):
        src = urljoin(url, match.group(1))
        if src not in script_urls and urlsplit(src).hostname:
            script_urls.append(src)

    source_map_candidates: list[str] = []
    for match in re.finditer(r'(?://[#@]\s*sourceMappingURL=([^\s]+)|sourceMappingURL=([^\s"\']+))', body, re.IGNORECASE):
        found = match.group(1) or match.group(2)
        if found and "://" in found:
            source_map_candidates.append(found)
        elif found:
            source_map_candidates.append(urljoin(url, found))

    for script in script_urls[:max_scripts]:
        try:
            script_response = client.get(script)
        except httpx.HTTPError:
            continue
        if script_response.status_code != 200:
            continue
        script_body = script_response.text[:MAX_BODY]
        texts.append((script, script_body))
        result["scriptsScanned"] += 1
        result["log"].append(f"fetched script {script}")
        sm_match = re.search(r'(?://[#@]\s*sourceMappingURL=([^\s]+)|sourceMappingURL=([^\s"\']+))', script_body, re.IGNORECASE)
        if sm_match:
            found = sm_match.group(1) or sm_match.group(2)
            sm_url = found if "://" in found else urljoin(script, found)
            source_map_candidates.append(sm_url)

    for sm_url in list(dict.fromkeys(source_map_candidates))[:10]:
        try:
            sm_response = client.get(sm_url)
        except httpx.HTTPError:
            continue
        if sm_response.status_code != 200:
            continue
        decoded, _ = _decode_sourcemap(sm_response.content, url)
        if decoded:
            texts.append((sm_url, decoded[:MAX_BODY]))
            result["log"].append(f"decoded source map {sm_url}")

    seen: set[str] = set()
    for source, text in texts:
        for rule in SECRET_RULES:
            for match in rule["pattern"].finditer(text):
                value = match.group(1) if match.lastindex else match.group(0)
                value = value.strip().strip("'\"")
                if not value or len(value) < 6:
                    continue
                if rule["name"] in {"Generic Base64 Secret", "Generic Password Assignment", "Bearer Token", "JWT Token"}:
                    if _entropy(value) < 3.0 and len(value) < 16:
                        continue
                key = f"{rule['name']}|{value}"
                if key in seen:
                    continue
                seen.add(key)
                result["findings"].append({
                    "id": f"secret-{len(result['findings']) + 1}",
                    "title": rule["name"],
                    "severity": rule["severity"],
                    "source": source,
                    "value": _redact(value),
                    "length": len(value),
                    "entropy": round(_entropy(value), 2),
                    "evidence": f"{rule['name']} pattern in {source} — value redacted ({_redact(value)})",
                })

    result["findings"].sort(key=lambda item: ("critical", "high", "medium", "low").index(item["severity"]) if item["severity"] in {"critical", "high", "medium", "low"} else 9)
    result["durationSeconds"] = round(time.monotonic() - started, 2)
    result["summary"] = {
        "findingsCount": len(result["findings"]),
        "scriptsScanned": result["scriptsScanned"],
        "bodiesScanned": result["bodiesScanned"],
        "engine": "PAN",
    }
    client.close()
    return result