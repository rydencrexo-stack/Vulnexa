"""Real external-tool scanners: Nuclei (CVEs), SSTImap, SQLmap, ssrfmap.

Each returns a consistent envelope: CLI command + raw output + normalized
findings + summary. If a tool is missing the CLI preview is still returned.
"""

from __future__ import annotations

import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlsplit

from app.scanners import toolkit
from app.scanners.toolkit import find_tool, parse_jsonl, run_cli
from app.scanners.xss_engine import normalize_target

BACKEND_DIR = Path(__file__).resolve().parents[2]


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _module_command(binary: str, *args: str) -> list[str]:
    if binary.startswith("python -m "):
        return ["python", "-m", binary.split(" ", 2)[2], *args]
    return [binary, *args]


def _envelope(tool: str, target: str, cli: dict[str, Any], cliInstalled: bool) -> dict[str, Any]:
    return {
        "tool": tool,
        "target": target,
        "scannedAt": _now(),
        "durationSeconds": 0,
        "cliInstalled": cliInstalled,
        "cli": cli,
        "summary": {"findingsCount": 0, "status": "not_run"},
        "findings": [],
        "errors": [],
    }


# ------------------------------------------------------------------ nuclei
def scan_nuclei(target: str, *, severity: str = "high,critical", tags: str = "", templates: str = "", timeout: float = 180.0) -> dict[str, Any]:
    started = time.monotonic()
    url = normalize_target(target)
    binary = find_tool("nuclei", env_name="NUCLEI_PATH")
    installed = bool(binary)
    command = [
        *([] if not binary else _module_command(binary)),
        "-u", url, "-silent", "-nc", "-j", "-rl", "25", "-timeout", "8",
    ]
    if severity:
        command += ["-severity", severity]
    if tags:
        command += ["-tags", tags]
    if templates:
        command += ["-t", templates]
    cli = toolkit.build_cli_block(command, binary=binary, installed=installed)
    cli["commandString"] = "nuclei " + " ".join(command[len(_module_command(binary)) if binary else 0:])
    result = _envelope("nuclei", url, cli, installed)
    if not installed:
        result["errors"].append("Nuclei binary not found. Install it from https://github.com/projectdiscovery/nuclei or set NUCLEI_PATH.")
        result["durationSeconds"] = round(time.monotonic() - started, 2)
        return result

    proc = run_cli(command, timeout=timeout, cwd=BACKEND_DIR)
    cli["exitCode"] = proc["exitCode"]
    cli["rawOutput"] = (proc["stdout"] + "\n" + proc["stderr"])[:6000]
    cli["timedOut"] = proc["timedOut"]
    result["durationSeconds"] = round(time.monotonic() - started, 2)
    if proc["timedOut"]:
        result["errors"].append("Nuclei exceeded the timeout and was stopped.")
        return result

    records = parse_jsonl(proc["stdout"])
    findings = []
    for record in records:
        info = record.get("info", {}) or {}
        findings.append({
            "id": record.get("template-id", "nuclei-finding"),
            "title": info.get("name") or record.get("template-id", "Nuclei finding"),
            "severity": (info.get("severity") or "info").lower(),
            "templateId": record.get("template-id", ""),
            "tags": (info.get("tags") or []) if isinstance(info.get("tags"), list) else (str(info.get("tags", "")).split(",") if info.get("tags") else []),
            "matcherStatus": record.get("matcher-status", False),
            "matchedAt": record.get("matched-at", ""),
            "url": record.get("url", ""),
            "type": record.get("type", ""),
            "host": record.get("host", ""),
            "port": record.get("port", ""),
            "scheme": record.get("scheme", ""),
            "curl": record.get("curl-command", ""),
            "description": info.get("description", ""),
            "reference": info.get("reference", []),
            "evidence": record.get("response", "")[:600],
        })
    result["findings"] = findings
    result["summary"] = {
        "findingsCount": len(findings),
        "status": "findings" if findings else "clean",
        "severity": severity,
        "templates": templates or "default",
    }
    return result


# ------------------------------------------------------------------- sstimap
def _find_sstimap() -> str | None:
    configured = __import__("os").getenv("SSTIMAP_PATH")
    if configured:
        return configured
    for candidate in BACKEND_DIR.glob("tools/**/sstimap.py"):
        if candidate.is_file():
            return str(candidate.resolve())
    return None


def scan_ssti(target: str, *, timeout: float = 180.0) -> dict[str, Any]:
    started = time.monotonic()
    url = normalize_target(target)
    binary = _find_sstimap()
    installed = bool(binary)
    command = ["python", binary, "-u", url, "-m", "GET", "--no-color", "-l", "1"]
    cli = toolkit.build_cli_block(command, binary="python " + binary, installed=installed)
    cli["commandString"] = "python SSTImap.py -u <url> -m GET --no-color -l 1"
    result = _envelope("sstimap", url, cli, installed)
    if not installed:
        result["errors"].append("SSTImap not found. Clone https://github.com/vladko312/SSTImap into backend/tools or set SSTIMAP_PATH.")
        result["durationSeconds"] = round(time.monotonic() - started, 2)
        return result
    proc = run_cli(command, timeout=timeout, cwd=BACKEND_DIR)
    cli["exitCode"] = proc["exitCode"]
    cli["rawOutput"] = (proc["stdout"] + "\n" + proc["stderr"])[:8000]
    cli["timedOut"] = proc["timedOut"]
    result["durationSeconds"] = round(time.monotonic() - started, 2)
    if proc["timedOut"]:
        result["errors"].append("SSTImap exceeded the timeout and was stopped.")
        return result
    combined = proc["stdout"] + "\n" + proc["stderr"]
    findings: list[dict[str, Any]] = []
    engine = ""
    vulnerable = False
    for line in combined.splitlines():
        if re.search(r"vulnerab", line, re.IGNORECASE):
            vulnerable = True
        engine_match = re.search(r"engine[:\s]*([A-Za-z]+)", line, re.IGNORECASE)
        if engine_match:
            engine = engine_match.group(1)
    if vulnerable:
        findings.append({
            "id": "ssti-vulnerable",
            "title": "Server-Side Template Injection",
            "severity": "high",
            "engine": engine,
            "evidence": f"SSTImap reported a vulnerable injection point (engine: {engine or 'unknown'}).",
            "url": url,
        })
    result["findings"] = findings
    result["summary"] = {"findingsCount": len(findings), "status": "findings" if findings else "clean", "engine": engine}
    return result


# -------------------------------------------------------------------- sqlmap
def scan_sqli(target: str, *, timeout: float = 180.0, level: int = 1, risk: int = 1) -> dict[str, Any]:
    started = time.monotonic()
    url = normalize_target(target)
    binary = find_tool("sqlmap", env_name="SQLMAP_PATH", python_module="sqlmap")
    installed = bool(binary)
    command = [
        *_module_command(binary),
        "-u", url, "--batch", "--level", str(level), "--risk", str(risk),
        "--threads", "2", "--smart", "--timeout", "10", "--retries", "1",
        "--output-dir", str(BACKEND_DIR / "tools" / "sqlmap-output"),
        "--flush-session", "--disable-coloring",
    ]
    cli = toolkit.build_cli_block(command, binary=binary, installed=installed)
    result = _envelope("sqlmap", url, cli, installed)
    if not installed:
        result["errors"].append("SQLMap not found. Install it with `pip install sqlmap` or set SQLMAP_PATH.")
        result["durationSeconds"] = round(time.monotonic() - started, 2)
        return result
    proc = run_cli(command, timeout=timeout, cwd=BACKEND_DIR)
    cli["exitCode"] = proc["exitCode"]
    cli["rawOutput"] = (proc["stdout"] + "\n" + proc["stderr"])[:8000]
    cli["timedOut"] = proc["timedOut"]
    result["durationSeconds"] = round(time.monotonic() - started, 2)
    if proc["timedOut"]:
        result["errors"].append("SQLMap exceeded the timeout and was stopped. Narrow the target or lower the level.")
        return result
    combined = proc["stdout"] + "\n" + proc["stderr"]
    findings: list[dict[str, Any]] = []
    # sqlmap reports vulnerable parameters like: "Parameter: id (GET)" ... "Type: boolean-based blind"
    param_blocks = re.findall(r"Parameter:\s*([^\n]+)\n((?:(?!Parameter:).)*?Type:\s*[^\n]+\n)", combined, re.IGNORECASE | re.DOTALL)
    for param_line, block in param_blocks:
        types = re.findall(r"Type:\s*([^\n]+)", block, re.IGNORECASE)
        findings.append({
            "id": f"sqli-{param_line.strip()}",
            "title": f"SQL injection in parameter {param_line.strip()}",
            "severity": "high",
            "param": param_line.strip(),
            "type": types[0] if types else "unknown",
            "allTypes": types,
            "evidence": block.strip()[:800],
            "url": url,
        })
    if not findings and re.search(r"is vulnerable|all tested parameters do not appear to be injectable", combined, re.IGNORECASE) and "do not appear" not in combined.lower():
        findings.append({"id": "sqli-detected", "title": "SQL injection detected", "severity": "high", "param": "?", "type": "unknown", "evidence": combined[:800], "url": url})
    result["findings"] = findings
    result["summary"] = {"findingsCount": len(findings), "status": "findings" if findings else "clean", "level": level, "risk": risk}
    return result


# ------------------------------------------------------------------- ssrfmap
def scan_ssrf(target: str, *, parameter: str | None = None, timeout: float = 120.0) -> dict[str, Any]:
    started = time.monotonic()
    url = normalize_target(target)
    binary = find_tool("ssrfmap", env_name="SSRFMAP_PATH")
    installed = bool(binary)
    result = _envelope("ssrfmap", url, {"binary": binary, "installed": installed}, installed)
    if not installed:
        result["errors"].append("ssrfmap not found. Clone https://github.com/swisskyrepo/ssrfmap into backend/tools or set SSRFMAP_PATH.")
        result["durationSeconds"] = round(time.monotonic() - started, 2)
        return result

    parsed = urlsplit(url)
    params = dict(parse_qsl(parsed.query))
    param = parameter or next(iter(params.keys()), None)
    if not param:
        result["errors"].append("The target URL has no parameters. Provide a parameter that makes server-side requests, e.g. ?url=https://example.com")
        result["durationSeconds"] = round(time.monotonic() - started, 2)
        return result

    # Build a raw HTTP request file ssrfmap can consume
    host = parsed.netloc
    marker = "PANSSRFMARKER"
    query = "&".join(f"{key}={marker if key == param else value}" for key, value in params.items())
    path = parsed.path or "/"
    if query:
        path = f"{path}?{query}"
    request_file = BACKEND_DIR / "tools" / "ssrfmap_request.txt"
    request_file.write_text(
        f"GET {path} HTTP/1.1\r\nHost: {host}\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n",
        encoding="utf-8",
    )
    command = ["python", binary, "-r", str(request_file), "-p", param, "--level", "1"]
    cli = toolkit.build_cli_block(command, binary="python " + binary, installed=True)
    cli["commandString"] = f"python ssrfmap.py -r {request_file.name} -p {param} --level 1"
    result["cli"] = cli
    proc = run_cli(command, timeout=timeout, cwd=BACKEND_DIR)
    cli["exitCode"] = proc["exitCode"]
    cli["rawOutput"] = (proc["stdout"] + "\n" + proc["stderr"])[:8000]
    cli["timedOut"] = proc["timedOut"]
    result["durationSeconds"] = round(time.monotonic() - started, 2)
    combined = proc["stdout"] + "\n" + proc["stderr"]
    findings: list[dict[str, Any]] = []
    for line in combined.splitlines():
        if re.search(r"\[.\]\s+(ssrf|.*(?:module|payload).*(?:found|vulnerable|open))", line, re.IGNORECASE) or re.search(r"vulnerab", line, re.IGNORECASE):
            findings.append({"id": f"ssrf-{len(findings) + 1}", "title": "Server-Side Request Forgery", "severity": "high", "param": param, "evidence": line.strip()[:600], "url": url})
    result["findings"] = findings
    result["summary"] = {"findingsCount": len(findings), "status": "findings" if findings else "clean", "parameter": param}
    return result