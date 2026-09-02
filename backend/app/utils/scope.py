from __future__ import annotations

import fnmatch
import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import unquote, urlsplit

from app.models.domain import Target, TargetScope
from app.utils.errors import unsafe


SENSITIVE_PATHS = {
    "/logout",
    "/delete-account",
    "/payments",
    "/billing",
    "/admin/delete",
}


@dataclass(frozen=True, slots=True)
class ScopeDecision:
    allowed: bool
    reason: str


def normalize_host(host: str) -> str:
    return host.strip().lower().rstrip(".")


def host_matches(host: str, pattern: str) -> bool:
    host = normalize_host(host)
    pattern = normalize_host(pattern)
    if pattern.startswith("*."):
        suffix = pattern[1:]
        return host.endswith(suffix) and host != suffix[1:]
    return host == pattern


def path_matches(path: str, pattern: str) -> bool:
    if pattern.endswith("/*"):
        base = pattern[:-1]
        return path.startswith(base)
    return fnmatch.fnmatchcase(path, pattern)


def normalize_url_path(path: str) -> str:
    """Decode a URL path for scope checks and reject ambiguous traversal forms."""
    decoded = path or "/"
    for _ in range(5):
        expanded = unquote(decoded, errors="strict")
        if expanded == decoded:
            break
        decoded = expanded
    else:
        raise unsafe("Target URL path is encoded too deeply for an unambiguous scope decision")
    if not decoded.startswith("/"):
        raise unsafe("Target URL path must be absolute")
    if "\\" in decoded or any(ord(char) < 32 for char in decoded):
        raise unsafe("Target URL path contains unsafe characters")
    if any(segment in {".", ".."} for segment in decoded.split("/")):
        raise unsafe("Target URL path cannot contain traversal segments")
    return decoded


def is_public_address(host: str, *, resolve_dns: bool = False) -> bool:
    addresses: set[str] = set()
    try:
        addresses.add(str(ipaddress.ip_address(host.strip("[]"))))
    except ValueError:
        if not resolve_dns:
            return True
        try:
            addresses.update(info[4][0] for info in socket.getaddrinfo(host, None))
        except socket.gaierror:
            # Unresolvable domains fail later at a controlled integration boundary;
            # they are not assumed to be private.
            return True
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if not ip.is_global:
            return False
    return True


def validate_target_url(url: str, *, cloud_mode: bool = False) -> tuple[str, str, int]:
    if any(char == " " or ord(char) < 32 for char in url):
        raise unsafe("Target URL contains whitespace or control characters")
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"}:
        raise unsafe("Only http and https targets are supported")
    if parsed.username or parsed.password:
        raise unsafe("Target URLs cannot contain credentials")
    if not parsed.hostname:
        raise unsafe("Target URL must contain a hostname")
    host = normalize_host(parsed.hostname)
    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError as exc:
        raise unsafe("Target URL contains an invalid port") from exc
    if cloud_mode and not is_public_address(host, resolve_dns=True):
        raise unsafe("Private, loopback, link-local, reserved, and special-use addresses are blocked in cloud mode")
    return parsed.scheme, host, port


def ensure_scope_consistent(domain: str, scope: TargetScope) -> None:
    if not scope.included_hosts:
        raise unsafe("At least one included host is required")
    for pattern in scope.included_hosts:
        base = pattern[2:] if pattern.startswith("*.") else pattern
        if base != domain and not base.endswith("." + domain):
            raise unsafe(f"Included host {pattern!r} is outside target domain {domain!r}")
    if set(scope.included_hosts) & set(scope.excluded_hosts):
        raise unsafe("A host cannot be both included and excluded")
    if set(scope.included_paths) & set(scope.excluded_paths):
        raise unsafe("A path cannot be both included and excluded")


def evaluate_url_scope(target: Target, url: str, *, cloud_mode: bool = False) -> ScopeDecision:
    try:
        _, host, port = validate_target_url(url, cloud_mode=cloud_mode)
        parsed = urlsplit(url)
        path = normalize_url_path(parsed.path)
    except Exception as exc:
        return ScopeDecision(False, str(exc))
    scope = target.scope
    if any(host_matches(host, excluded) for excluded in scope.excluded_hosts):
        return ScopeDecision(False, "host is explicitly excluded")
    if not any(host_matches(host, included) for included in scope.included_hosts):
        return ScopeDecision(False, "host is not included")
    if port not in scope.allowed_ports:
        return ScopeDecision(False, "port is not allowed")
    if any(path_matches(path, excluded) for excluded in scope.excluded_paths):
        return ScopeDecision(False, "path is explicitly excluded")
    sensitive_root = next(
        (root for root in SENSITIVE_PATHS if path == root or path.startswith(root + "/")),
        None,
    )
    if sensitive_root:
        explicitly_included = any(
            (pattern == sensitive_root or pattern.startswith(sensitive_root + "/"))
            and path_matches(path, pattern)
            for pattern in scope.included_paths
        )
        if not explicitly_included:
            return ScopeDecision(False, "sensitive path is not explicitly included")
    if not any(path_matches(path, included) for included in scope.included_paths):
        return ScopeDecision(False, "path is not included")
    return ScopeDecision(True, "URL is within the authorized target scope")


def require_scannable_target(target: Target, *, start_url: str | None = None, cloud_mode: bool = False) -> None:
    if target.verification.status != "verified":
        raise unsafe("Target ownership must be verified before reconnaissance or scanning")
    ensure_scope_consistent(target.domain, target.scope)
    candidate = start_url or str(target.base_url)
    decision = evaluate_url_scope(target, candidate, cloud_mode=cloud_mode)
    if not decision.allowed:
        raise unsafe(f"Scan start URL is out of scope: {decision.reason}")


def validate_redirect(target: Target, redirect_url: str, *, cloud_mode: bool = False) -> ScopeDecision:
    return evaluate_url_scope(target, redirect_url, cloud_mode=cloud_mode)
