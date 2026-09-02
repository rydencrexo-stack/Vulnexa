"""Shared toolkit helpers for real scanner binaries.

Each engine discovers its tool (env var -> bundled ``backend/bin`` / ``backend/tools``
-> PATH -> Python module), runs it with a hard timeout, captures the exact CLI
command + terminal output, and normalizes findings. When a tool is missing the
engine still returns the CLI preview so the UI can show a copy-paste command.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[2]


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def find_tool(name: str, *, env_name: str | None = None, bundled: bool = True, python_module: str | None = None) -> str | None:
    env_value = os.getenv(env_name) if env_name else os.getenv(name.upper().replace("-", "_"))
    if env_value:
        path = Path(env_value)
        if path.exists():
            return str(path.resolve())
    if bundled:
        matches = sorted(BACKEND_DIR.glob(f"bin/**/{name}*.exe"))
        if not matches:
            matches = sorted(BACKEND_DIR.glob(f"bin/**/{name}"))
        if not matches:
            matches = sorted(BACKEND_DIR.glob(f"tools/**/{name}*"))
        for match in matches:
            if match.is_file() and (match.suffix in {".exe", ".py"} or name in match.name):
                return str(match.resolve())
    on_path = shutil.which(name)
    if on_path:
        return on_path
    if python_module and shutil.which("python"):
        try:
            import importlib

            importlib.import_module(python_module)
            return f"python -m {python_module}"
        except ImportError:
            return None
    return None


def run_cli(command: list[str], *, timeout: float = 120.0, cwd: Path | None = None) -> dict[str, Any]:
    """Run a CLI command, returning stdout, stderr, exit code, or a timeout error."""
    started = __import__("time").monotonic()
    env = dict(os.environ)
    env.setdefault("PYTHONIOENCODING", "utf-8")
    env.setdefault("PYTHONUTF8", "1")
    try:
        proc = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            cwd=str(cwd) if cwd else None,
            env=env,
        )
        return {
            "exitCode": proc.returncode,
            "stdout": proc.stdout or "",
            "stderr": proc.stderr or "",
            "timedOut": False,
            "durationSeconds": round(__import__("time").monotonic() - started, 2),
        }
    except subprocess.TimeoutExpired:
        return {
            "exitCode": None,
            "stdout": "",
            "stderr": f"Command exceeded the {int(timeout)}s timeout and was stopped.",
            "timedOut": True,
            "durationSeconds": round(__import__("time").monotonic() - started, 2),
        }
    except OSError as exc:
        return {
            "exitCode": None,
            "stdout": "",
            "stderr": f"Could not run command: {exc}",
            "timedOut": False,
            "durationSeconds": round(__import__("time").monotonic() - started, 2),
        }


def parse_jsonl(text: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except ValueError:
            continue
        if isinstance(payload, dict):
            records.append(payload)
    return records


def build_cli_block(command: list[str], *, binary: str | None, installed: bool) -> dict[str, Any]:
    display = command[:]
    if binary and binary.startswith("python -m"):
        display = ["python", *command]
    elif binary:
        display = [binary.split("\\")[-1].split("/")[-1], *command]
    return {
        "binary": binary,
        "installed": installed,
        "command": display,
        "commandString": " ".join(display),
    }