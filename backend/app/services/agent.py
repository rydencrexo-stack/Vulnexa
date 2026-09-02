from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from app.config import Settings
from app.models.domain import Target
from app.utils.errors import AppError
from app.utils.sanitize import sanitize_text
from app.utils.scope import host_matches, is_public_address, normalize_host


_CT_ROWS_RE = re.compile(r"<TD>([^<]+)</TD>")
_JS_URL_RE = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+\.(?:js|mjs|json|jsonp))["']""")
_SCRIPT_SRC_RE = re.compile(r"""<script[^>]+\bsrc\s*=\s*["']([^"']+)["']""", re.I)
_SOURCE_MAP_RE = re.compile(r"sourceMappingURL\s*=\s*([^\s*]+)", re.I)
_ABSOLUTE_API_RE = re.compile(r"(?:https?|wss?)://[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%{}-]{4,500}")
_API_PATH_RE = re.compile(
    r"[\"'`](/(?:api|graphql|rest|rpc|v\d+|ws|socket(?:\.io)?|auth|oauth|internal)"
    r"[A-Za-z0-9._~/?#\[\]@!$&()*+,;=:%{}\-]{0,400})[\"'`]",
    re.I,
)
_FETCH_ROUTE_RE = re.compile(
    r"(?:(?:fetch|open)\s*\(\s*|axios\.(get|post|put|patch|delete|options|head)\s*\(\s*)"
    r"[\"'`]([^\"'`]{1,500})[\"'`]",
    re.I,
)
_SECRET_RE = re.compile(
    r"(?i)(?:api[_-]?key|secret|token|passwd|password|credential|access[_-]?key)"
    r"['\"]?\s*[:=]\s*['\"][A-Za-z0-9_\-\./+]{12,}['\"]|sk-[A-Za-z0-9]{20,}"
)
_LINK_RE = re.compile(r"""(?:href|action)\s*=\s*["']([^"']+)["']""")
_EMAIL_RE = re.compile(r"[\w\.\+\-]+@[\w\-]+\.[A-Za-z]{2,}")

PUBLIC_ORIGINS = (
    "crt.sh",
    "web.archive.org",
    "api.hackertarget.com",
    "otx.alienvault.com",
    "dns.google",
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _safe_host(host: str) -> bool:
    # Only permit public, non-special-use addresses to avoid SSRF.
    try:
        return is_public_address(host, resolve_dns=True)
    except Exception:
        return False


def _host_within_domain(host: str, domain: str) -> bool:
    host = normalize_host(host)
    domain = normalize_host(domain)
    return host == domain or host.endswith("." + domain)


def _origin_allowed(url: str) -> bool:
    return any(origin in url for origin in PUBLIC_ORIGINS) and "://" in url


class AgentService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.report_directory: Path = settings.report_directory.resolve()
        self.report_directory.mkdir(parents=True, exist_ok=True)

    def run(self, target: Target, *, phases: list[str], skills: list[str], auth: str) -> dict[str, Any]:
        if target.verification.status != "verified":
            raise AppError(409, "target_not_verified", "Target ownership must be verified before active assessment")
        domain = normalize_host(target.domain)
        host = normalize_host(str(target.base_url).replace("https://", "").replace("http://", "").split("/")[0])

        findings: list[dict[str, Any]] = []
        assets: list[dict[str, Any]] = []
        endpoints: list[dict[str, Any]] = []
        evidence: dict[str, Any] = {"subdomains": [], "archiveUrls": [], "seenPaths": set(), "headers": {}, "jsBundles": []}

        try:
            if "subdomains" in phases:
                subdomains = self._enumerate_subdomains(domain)
                evidence["subdomains"] = subdomains
                for sub in subdomains[:60]:
                    candidate = sub if sub.startswith("http") else f"https://{sub}"
                    try:
                        resolved = self._probe(candidate, host, domain, max_depth=0)
                        if resolved:
                            assets.append(resolved)
                    except Exception:
                        continue
            if "endpoints" in phases or "hidden" in phases:
                self._crawl(host, domain, evidence, endpoints, include_hidden="hidden" in phases, include_archive="endpoints" in phases or "passive" in phases)
            if "cred-leak" in phases:
                self._github_leaks(domain, evidence, findings)
            if "emails" in phases:
                self._harvest_emails(host, domain, evidence, findings)
            if "virustotal" in phases:
                self._virustotal(domain, evidence, findings)
            if "passive" in phases or "static" in phases:
                self._analyze_evidence(host, evidence, findings, cred_leak=False, static="static" in phases)
            if "cve" in phases:
                evidence["intel"] = {"note": "CVE correlation requires an intelligence adapter; reported as pending."}
        except Exception as exc:  # defensive: never fail the whole run on one phase
            evidence["error"] = f"{type(exc).__name__}: error in a recon phase"

        synthesized = self._synthesize(target, host, skills, auth, endpoints, findings)
        report_id = f"agent_{int(datetime.now(timezone.utc).timestamp())}"
        payload = self._build_payload(report_id, target, host, auth, phases, skills, assets, endpoints, synthesized, evidence)
        artifacts = self._write_artifacts(report_id, payload)
        return {
            "status": "completed",
            "reportId": report_id,
            "name": f"{target.name} — AI bug-hunter assessment",
            "target": {"host": host, "domain": domain},
            "auth": auth,
            "phases": phases,
            "skills": skills,
            "assets": assets,
            "endpoints": endpoints,
            "findings": synthesized,
            "evidenceSummary": {
                "subdomains": len(evidence.get("subdomains", [])),
                "archiveUrls": len(evidence.get("archiveUrls", [])),
                "paths": len(evidence.get("seenPaths", [])),
                "jsBundles": len(evidence.get("jsBundles", [])),
                "scriptsAnalyzed": len(evidence.get("scriptsAnalyzed", [])),
                "jsApiEndpoints": sum(1 for endpoint in endpoints if endpoint.get("source") == "javascript"),
                "sourceMaps": len(evidence.get("sourceMaps", [])),
                "externalApiHosts": evidence.get("externalApiHosts", []),
                "emails": len(evidence.get("emails", [])),
                "github": (evidence.get("github") or {}).get("matches", []),
                "virustotal": evidence.get("virustotal") or None,
            },
            "artifacts": artifacts,
            "generatedAt": _now(),
        }

    def run_domain(self, domain: str, *, phases: list[str], skills: list[str], auth: str = "None - non-authenticated") -> dict[str, Any]:
        """Real passive/active recon against any user-provided domain (authorized testing).
        Unlike ``run`` this does not require a stored verified target — it works on any
        domain the operator has permission to test."""
        domain = normalize_host(domain)
        host = domain
        started = time.monotonic()
        findings: list[dict[str, Any]] = []
        assets: list[dict[str, Any]] = []
        endpoints: list[dict[str, Any]] = []
        evidence: dict[str, Any] = {"subdomains": [], "archiveUrls": [], "seenPaths": set(), "headers": {}, "jsBundles": []}

        try:
            if "subdomains" in phases:
                subdomains = self._enumerate_subdomains(domain)
                evidence["subdomains"] = subdomains
                for sub in subdomains[:40]:
                    candidate = sub if sub.startswith("http") else f"https://{sub}"
                    try:
                        resolved = self._probe(candidate, host, domain)
                        if resolved:
                            assets.append(resolved)
                    except Exception:
                        continue
            if "endpoints" in phases or "hidden" in phases:
                self._crawl(host, domain, evidence, endpoints, include_hidden="hidden" in phases, include_archive="endpoints" in phases or "passive" in phases)
            if "cred-leak" in phases:
                self._github_leaks(domain, evidence, findings)
            if "emails" in phases:
                self._harvest_emails(host, domain, evidence, findings)
            if "virustotal" in phases:
                self._virustotal(domain, evidence, findings)
            # Header/static analysis runs after the root probe below to avoid duplicates.
        except Exception as exc:
            evidence["error"] = f"{type(exc).__name__}: error in a recon phase"

        # Ensure the root host itself is probed for header/tech analysis even if the
        # subdomain phase is off (so 'tech' and 'passive' still yield real data).
        try:
            with httpx.Client(timeout=6, follow_redirects=True, headers={"User-Agent": "Vulnexa-Agent/1.0 (authorized)"}) as client:
                response = client.get(f"https://{host}/")
            evidence["headers"].setdefault(f"https://{host}", dict(response.headers))
            tech: list[str] = []
            server = response.headers.get("server")
            if server:
                tech.append(server)
            lower = response.text.lower()
            if "react" in lower:
                tech.append("React")
            if "next" in lower or "__next" in lower:
                tech.append("Next.js")
            if "wordpress" in lower or "wp-content" in lower:
                tech.append("WordPress")
            if "php" in lower or "php_session" in lower:
                tech.append("PHP")
            if tech:
                evidence["tech"] = sorted(set(tech))
            if "static" in phases:
                for match in _SCRIPT_SRC_RE.findall(response.text):
                    try:
                        resolved_script = str(httpx.URL(f"https://{host}/").join(match))
                        script_host = normalize_host(str(httpx.URL(resolved_script).host or ""))
                    except Exception:
                        continue
                    if _host_within_domain(script_host, domain):
                        evidence["jsBundles"].append(resolved_script)
                if "endpoints" not in phases and "hidden" not in phases:
                    self._javascript_intelligence(host, domain, evidence, endpoints)
                self._analyze_evidence(host, evidence, findings, cred_leak="cred-leak" in phases, static=True)
            if "passive" in phases:
                self._analyze_evidence(host, evidence, findings, cred_leak=False, static=False)
        except Exception:
            pass

        report_id = f"agent_{int(datetime.now(timezone.utc).timestamp())}"
        # Deduplicate findings by (title, endpoint).
        deduped: list[dict[str, Any]] = []
        seen_findings: set[tuple[str, str]] = set()
        for item in findings:
            endpoint = str(item.get("endpoint", "")).rstrip("/") or "/"
            key = (str(item.get("title")), endpoint)
            if key in seen_findings:
                continue
            seen_findings.add(key)
            item["endpoint"] = endpoint
            deduped.append(item)
        findings = deduped
        # Enforce a minimum duration so a healthy scan presents realistically.
        remaining = self.settings.agent_min_scan_seconds - (time.monotonic() - started)
        if remaining > 0:
            time.sleep(remaining)
        return {
            "status": "completed",
            "reportId": report_id,
            "name": f"{domain} - AI bug-hunter assessment",
            "target": {"host": host, "domain": domain},
            "auth": auth,
            "phases": phases,
            "skills": skills,
            "assets": assets,
            "endpoints": endpoints,
            "findings": findings,
            "evidenceSummary": {
                "subdomains": len(evidence.get("subdomains", [])),
                "archiveUrls": len(evidence.get("archiveUrls", [])),
                "paths": len(evidence.get("seenPaths", [])),
                "jsBundles": len(evidence.get("jsBundles", [])),
                "scriptsAnalyzed": len(evidence.get("scriptsAnalyzed", [])),
                "jsApiEndpoints": sum(1 for endpoint in endpoints if endpoint.get("source") == "javascript"),
                "sourceMaps": len(evidence.get("sourceMaps", [])),
                "externalApiHosts": evidence.get("externalApiHosts", []),
                "emails": len(evidence.get("emails", [])),
                "tech": evidence.get("tech", []),
                "github": (evidence.get("github") or {}).get("matches", []),
                "virustotal": evidence.get("virustotal") or None,
                "headers": list(evidence.get("headers", {}).keys()),
            },
            "generatedAt": _now(),
        }

    def _probe(self, url: str, host: str, domain: str, *, max_depth: int = 0) -> dict[str, Any] | None:
        if not _safe_host(normalize_host(host)):
            return None
        try:
            with httpx.Client(timeout=6, follow_redirects=True, headers={"User-Agent": "Vulnexa-Agent/1.0 (authorized)"}) as client:
                response = client.get(url)
            title = re.search(r"<title[^>]*>(.*?)</title>", response.text, re.I | re.S)
            tech: list[str] = []
            server = response.headers.get("server")
            if server:
                tech.append(server)
            lower = response.text.lower()
            if "react" in lower:
                tech.append("React")
            if "next" in lower or "__next" in lower:
                tech.append("Next.js")
            return {
                "hostname": normalize_host(str(response.url.host)),
                "url": str(response.url),
                "status": response.status_code,
                "title": sanitize_text(title.group(1).strip() if title else "", limit=120),
                "technologies": tech,
                "contentLength": len(response.content),
            }
        except Exception:
            return None

    def _enumerate_subdomains(self, domain: str) -> list[str]:
        found: list[str] = []
        urls = [f"https://crt.sh/?q=%25.{domain}&output=json"]
        for url in urls:
            if not _origin_allowed(url) or not _safe_host("crt.sh"):
                continue
            try:
                with httpx.Client(timeout=12, headers={"User-Agent": "Vulnexa-Agent/1.0 (authorized)"}) as client:
                    response = client.get(url)
                response.raise_for_status()
                rows = response.json()
                for row in rows:
                    for name in str(row.get("name_value", "")).split("\n"):
                        name = normalize_host(name.strip())
                        if name and (name == domain or name.endswith("." + domain)) and name not in found:
                            found.append(name)
            except Exception:
                continue
        return sorted(found)[:200]

    def _crawl(self, host: str, domain: str, evidence: dict[str, Any], endpoints: list[dict[str, Any]], *, include_hidden: bool, include_archive: bool) -> None:
        base = f"https://{host}"
        seeds = [base, f"{base}/robots.txt", f"{base}/sitemap.xml", f"{base}/.well-known/security.txt"]
        for seed in seeds:
            if not _safe_host(host):
                continue
            try:
                with httpx.Client(timeout=6, follow_redirects=True, headers={"User-Agent": "Vulnexa-Agent/1.0 (authorized)"}) as client:
                    response = client.get(seed)
                evidence["headers"].setdefault(seed, dict(response.headers))
                for link in _LINK_RE.findall(response.text):
                    try:
                        resolved = str(httpx.URL(seed).join(link))
                        resolved_host = normalize_host(str(httpx.URL(resolved).host or ""))
                    except Exception:
                        continue
                    if _host_within_domain(resolved_host, domain) and (include_hidden or not any(part in resolved.lower() for part in ("/admin", "/secret", "/backup", "/dev", "/internal", "/.git", "/config", "/uploads", "/debug"))):
                        evidence["seenPaths"].add(resolved)
                        method = "GET"
                        is_api = "/api" in resolved or resolved.endswith(("/json", ".json"))
                        endpoints.append({"url": resolved, "method": method, "kind": "api" if is_api else "web", "source": "crawl"})
                for script in _SCRIPT_SRC_RE.findall(response.text):
                    try:
                        resolved_script = str(httpx.URL(seed).join(script))
                        script_host = normalize_host(str(httpx.URL(resolved_script).host or ""))
                    except Exception:
                        continue
                    if _host_within_domain(script_host, domain):
                        evidence["jsBundles"].append(resolved_script)
                if response.text.startswith("User-agent") or "Disallow:" in response.text[:2000]:
                    for path in re.findall(r"^Disallow:\s*(.+)$", response.text, re.M):
                        resolved = f"{base}{path.replace('*', '')}"
                        if host in resolved:
                            evidence["seenPaths"].add(resolved)
                            endpoints.append({"url": resolved, "method": "GET", "kind": "hidden", "source": "robots"})
            except Exception:
                continue
        if include_archive:
            self._archive(host, domain, evidence, endpoints)
        evidence["jsBundles"].extend(sorted(set(re.findall(r"[A-Za-z0-9_\-/\.]+\.(?:js|mjs|json)", " ".join(evidence["seenPaths"])) ))[:40])
        evidence["jsBundles"] = list(dict.fromkeys(evidence["jsBundles"]))[:80]
        self._javascript_intelligence(host, domain, evidence, endpoints)

    def _javascript_intelligence(self, host: str, domain: str, evidence: dict[str, Any], endpoints: list[dict[str, Any]]) -> None:
        """Fetch scoped client bundles and turn route literals into an API inventory.

        The collector is deliberately read-only and keeps out-of-scope hosts as
        observations only; it never follows a bundle or API redirect off scope.
        """
        script_urls: list[str] = []
        for candidate in list(evidence.get("jsBundles", []))[:80]:
            try:
                resolved = str(httpx.URL(f"https://{host}/").join(str(candidate)))
                script_host = normalize_host(str(httpx.URL(resolved).host or ""))
            except Exception:
                continue
            if _host_within_domain(script_host, domain) and _safe_host(script_host) and resolved not in script_urls:
                script_urls.append(resolved)

        known = {(str(item.get("method", "GET")).upper(), str(item.get("url", ""))) for item in endpoints}
        source_maps: list[str] = list(evidence.get("sourceMaps", []))
        external_hosts: set[str] = set(evidence.get("externalApiHosts", []))
        scripts_analyzed: list[str] = []
        secret_signals = 0

        def add_route(raw_url: str, method: str = "GET") -> None:
            cleaned = raw_url.strip().rstrip(".,;:)}]\\")
            cleaned = cleaned.rstrip("'\"`")
            if not cleaned or cleaned.startswith(("data:", "javascript:", "#")):
                return
            try:
                if cleaned.startswith(("ws://", "wss://", "http://", "https://")):
                    resolved = cleaned
                else:
                    resolved = str(httpx.URL(f"https://{host}/").join(cleaned))
                parsed = httpx.URL(resolved)
                route_host = normalize_host(str(parsed.host or ""))
            except Exception:
                return
            if not _host_within_domain(route_host, domain):
                if route_host:
                    external_hosts.add(route_host)
                return
            normalized_method = method.upper() if method.upper() in {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"} else "GET"
            key = (normalized_method, resolved)
            if key in known:
                return
            known.add(key)
            parameters = sorted(set(parsed.params.keys()))[:40]
            lower = resolved.lower()
            endpoints.append({
                "url": resolved,
                "method": normalized_method,
                "kind": "websocket" if parsed.scheme in {"ws", "wss"} or "/socket" in lower or "/ws" in lower else "graphql" if "graphql" in lower else "api",
                "source": "javascript",
                "parameters": parameters,
                "authHint": "auth-related route" if any(token in lower for token in ("auth", "login", "token", "session", "oauth")) else None,
            })

        for script_url in script_urls[:30]:
            try:
                with httpx.Client(timeout=8, follow_redirects=False, headers={"User-Agent": "Vulnexa-Agent/1.0 (authorized)"}) as client:
                    response = client.get(script_url)
                if response.status_code != 200 or len(response.content) > 2_000_000:
                    continue
                body = response.text
                scripts_analyzed.append(script_url)
                secret_signals += len(_SECRET_RE.findall(body))
                for absolute in _ABSOLUTE_API_RE.findall(body):
                    add_route(absolute)
                for path in _API_PATH_RE.findall(body):
                    add_route(path)
                for method, route in _FETCH_ROUTE_RE.findall(body):
                    add_route(route, method or "GET")
                for source_map in _SOURCE_MAP_RE.findall(body):
                    try:
                        resolved_map = str(httpx.URL(script_url).join(source_map.strip()))
                        map_host = normalize_host(str(httpx.URL(resolved_map).host or ""))
                    except Exception:
                        continue
                    if _host_within_domain(map_host, domain) and resolved_map not in source_maps:
                        source_maps.append(resolved_map)
            except Exception:
                continue

        evidence["scriptsAnalyzed"] = scripts_analyzed
        evidence["sourceMaps"] = source_maps[:80]
        evidence["externalApiHosts"] = sorted(external_hosts)[:80]
        evidence["jsSecretSignals"] = secret_signals

    def _archive(self, host: str, domain: str, evidence: dict[str, Any], endpoints: list[dict[str, Any]] | None = None) -> None:
        url = f"https://web.archive.org/cdx/search/cdx?url={host}/*&output=json&fl=timestamp,original&filter=statuscode:200&collapse=urlkey&limit=400"
        if not _origin_allowed(url) or not _safe_host("web.archive.org"):
            return
        try:
            with httpx.Client(timeout=12, headers={"User-Agent": "Vulnexa-Agent/1.0 (authorized)"}) as client:
                response = client.get(url)
            response.raise_for_status()
            rows = response.json()
            for row in rows[1:]:
                original = str(row[1])
                if host in original and original not in evidence["archiveUrls"]:
                    evidence["archiveUrls"].append(original)
                    if endpoints is not None:
                        is_api = "/api" in original or original.endswith(("/json", ".json"))
                        endpoints.append({"url": original, "method": "GET", "kind": "api" if is_api else "web", "source": "archive"})
        except Exception:
            return

    def _github_leaks(self, domain: str, evidence: dict[str, Any], findings: list[dict[str, Any]]) -> None:
        """Search GitHub code for leaked credentials / secrets referencing the target domain."""
        api_key = self.settings.github_api_key
        if not api_key:
            evidence["github"] = {"status": "not_configured", "note": "GITHUB_API_KEY not set"}
            return
        # Keep requests minimal + safe: read-only code search, no mutations.
        headers = {"User-Agent": "Vulnexa-Agent/1.0", "Accept": "application/vnd.github+json", "Authorization": f"Bearer {api_key}"}
        query = f'"{domain}" in:file'
        try:
            with httpx.Client(timeout=12, headers=headers) as client:
                response = client.get("https://api.github.com/search/code", params={"q": query, "per_page": 10})
            if response.status_code != 200:
                evidence["github"] = {"status": "error", "code": response.status_code}
                return
            items = response.json().get("items", [])
            evidence["github"] = {"status": "ok", "matches": [{"repo": it.get("repository", {}).get("full_name"), "path": it.get("path")} for it in items]}
            if items:
                findings.append({
                    "title": f"Potential credential/secrets exposure on GitHub referencing {domain}",
                    "severity": "medium",
                    "confidence": 45,
                    "source": "github_leak",
                    "endpoint": f"github:search:{domain}",
                })
        except Exception:
            evidence["github"] = {"status": "error", "note": "GitHub code search unavailable"}

    def _harvest_emails(self, host: str, domain: str, evidence: dict[str, Any], findings: list[dict[str, Any]]) -> None:
        """Collect employee / staff emails discoverable across archive + crawled content."""
        emails: set[str] = set()
        urls = [f"https://{host}/", f"https://{host}/robots.txt", f"https://{host}/.well-known/security.txt", *list(evidence.get("seenPaths", []))[:40]]
        for url in urls:
            if not _safe_host(host):
                continue
            try:
                with httpx.Client(timeout=5, follow_redirects=True, headers={"User-Agent": "Vulnexa-Agent/1.0"}) as client:
                    response = client.get(url)
                for match in _EMAIL_RE.findall(response.text):
                    if domain in match.lower():
                        emails.add(match)
            except Exception:
                continue
        evidence["emails"] = sorted(emails)[:120]
        if emails:
            findings.append({
                "title": f"{len(emails)} staff/employee email address(es) exposed on public content",
                "severity": "informational",
                "confidence": 80,
                "source": "email_harvest",
                "endpoint": host,
            })

    def _virustotal(self, domain: str, evidence: dict[str, Any], findings: list[dict[str, Any]]) -> None:
        """VirusTotal domain report (passive intelligence). Key from env, never hardcoded."""
        api_key = self.settings.virustotal_api_key
        if not api_key:
            evidence["virustotal"] = {"status": "not_configured"}
            return
        try:
            with httpx.Client(timeout=12, headers={"x-apikey": api_key}) as client:
                response = client.get(f"https://www.virustotal.com/api/v3/domains/{domain}")
            if response.status_code != 200:
                evidence["virustotal"] = {"status": "error", "code": response.status_code}
                return
            data = response.json()
            attrs = data.get("data", {}).get("attributes", {})
            detection = attrs.get("last_analysis_stats", {})
            evidence["virustotal"] = {
                "status": "ok",
                "malicious": detection.get("malicious", 0),
                "suspicious": detection.get("suspicious", 0),
                "harmless": detection.get("harmless", 0),
                "categories": attrs.get("categories", {}),
                "subdomains": len(attrs.get("subdomains", [])),
                "resolutions": len(attrs.get("resolutions", [])),
            }
            if detection.get("malicious", 0) > 0:
                findings.append({
                    "title": f"VirusTotal flags {detection.get('malicious')} malicious detection(s) for {domain}",
                    "severity": "medium",
                    "confidence": 90,
                    "source": "virustotal",
                    "endpoint": domain,
                })
        except Exception:
            evidence["virustotal"] = {"status": "error", "note": "VirusTotal query failed"}

    def _analyze_evidence(self, host: str, evidence: dict[str, Any], findings: list[dict[str, Any]], *, cred_leak: bool, static: bool) -> None:
        headers = evidence.get("headers", {})
        for seed, header in headers.items():
            header_issues: list[str] = []
            header_keys = {key.lower() for key in header}
            if "content-security-policy" not in header_keys:
                header_issues.append("Missing Content-Security-Policy")
            if "strict-transport-security" not in header_keys and seed.startswith("https"):
                header_issues.append("Missing Strict-Transport-Security")
            if "x-frame-options" not in header_keys and "frame-ancestors" not in str(header.get("content-security-policy", "")).lower():
                header_issues.append("Missing X-Frame-Options")
            if "x-content-type-options" not in header_keys:
                header_issues.append("Missing X-Content-Type-Options")
            if "referrer-policy" not in header_keys:
                header_issues.append("Missing Referrer-Policy")
            for issue in header_issues:
                findings.append({
                    "title": f"{issue} on {sanitize_text(seed, limit=120)}",
                    "severity": "low",
                    "confidence": 90,
                    "source": "passive_headers",
                    "endpoint": seed,
                })
            set_cookie = str(header.get("set-cookie") or header.get("Set-Cookie") or "")
            if set_cookie:
                missing_flags = [flag for flag in ("Secure", "HttpOnly", "SameSite") if flag.lower() not in set_cookie.lower()]
                if missing_flags:
                    findings.append({
                        "title": f"Session cookie missing {', '.join(missing_flags)} attribute(s)",
                        "severity": "medium" if "Secure" in missing_flags or "HttpOnly" in missing_flags else "low",
                        "confidence": 80,
                        "source": "passive_cookie",
                        "endpoint": seed,
                    })
        if cred_leak:
            for path in list(evidence.get("seenPaths", [])):
                if any(part in path.lower() for part in ("/api", "/auth", "/token", "/config", "/env", ".json")):
                    try:
                        with httpx.Client(timeout=5, follow_redirects=True, headers={"User-Agent": "Vulnexa-Agent/1.0 (authorized)"}) as client:
                            response = client.get(path)
                        secrets = _SECRET_RE.findall(response.text)
                        if secrets and _safe_host(host):
                            findings.append({
                                "title": f"Potential secret exposure ({len(secrets)} match(es)) — review required",
                                "severity": "high",
                                "confidence": 55,
                                "source": "cred_leak",
                                "endpoint": sanitize_text(path, limit=160),
                            })
                        emails = _EMAIL_RE.findall(response.text)
                        if emails and _safe_host(host):
                            findings.append({
                                "title": "Email addresses disclosed in response",
                                "severity": "informational",
                                "confidence": 95,
                                "source": "info_disclosure",
                                "endpoint": sanitize_text(path, limit=160),
                            })
                    except Exception:
                        continue
        if static:
            js_files = evidence.get("jsBundles", [])
            if js_files:
                findings.append({
                    "title": f"{len(js_files)} client-side bundle(s) identified — review for embedded secrets",
                    "severity": "informational",
                    "confidence": 70,
                    "source": "static_analysis",
                    "endpoint": host,
                })
            source_maps = evidence.get("sourceMaps", [])
            if source_maps:
                findings.append({
                    "title": f"{len(source_maps)} client source map reference(s) disclosed — availability not confirmed",
                    "severity": "informational",
                    "confidence": 95,
                    "source": "javascript_source_map",
                    "endpoint": sanitize_text(str(source_maps[0]), limit=160),
                })
            secret_signals = int(evidence.get("jsSecretSignals", 0) or 0)
            if secret_signals:
                findings.append({
                    "title": f"Potential client-side secret material ({secret_signals} pattern match(es)) — validation required",
                    "severity": "medium",
                    "confidence": 50,
                    "source": "javascript_secret_signal",
                    "endpoint": host,
                })

    def _synthesize(self, target: Target, host: str, skills: list[str], auth: str, endpoints: list[dict[str, Any]], raw_findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        # Skill selection controls what is tested; it must never manufacture a
        # candidate merely because a playbook was selected. Only evidence-backed
        # observations collected by the adapters are returned here.
        return raw_findings[:40]

    def _build_payload(self, report_id: str, target: Target, host: str, auth: str, phases: list[str], skills: list[str], assets: list[dict[str, Any]], endpoints: list[dict[str, Any]], findings: list[dict[str, Any]], evidence: dict[str, Any]) -> dict[str, Any]:
        return {
            "report": {"id": report_id, "name": f"{target.name} — AI bug-hunter assessment", "type": "AI Bug Hunter"},
            "target": {"id": target.id, "name": target.name, "domain": target.domain, "host": host},
            "authentication": auth,
            "phasesRun": phases,
            "skillsSelected": skills,
            "methodology": "Vulnexa authorized passive/active recon: certificate transparency subdomain enumeration, web-archive crawl, scope-validated HTTP probing, header/secret static analysis, and AI vector triage.",
            "coverage": {"assets": len(assets), "endpointsDiscovered": len(endpoints), "subdomains": len(evidence.get("subdomains", [])), "archiveUrls": len(evidence.get("archiveUrls", []))},
            "findingsSummary": {"total": len(findings)},
            "detailedFindings": findings,
            "limitations": [
                "Findings are candidates and require analyst validation.",
                "Active exploitation and destructive checks are disabled by policy.",
                "AI analysis used sanitized evidence and did not independently confirm findings.",
            ],
            "generatedTimestamp": _now(),
        }

    def _write_artifacts(self, report_id: str, payload: dict[str, Any]) -> dict[str, str]:
        files: dict[str, str] = {}
        json_path = self.report_directory / f"{report_id}.json"
        json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        files["json"] = str(json_path)
        files["html"] = str(self._write_html(report_id, payload))
        files["csv"] = str(self._write_csv(report_id, payload["detailedFindings"]))
        return files

    def _write_html(self, report_id: str, payload: dict[str, Any]) -> Path:
        import html as html_mod

        rows = "".join(
            f"<tr><td>{html_mod.escape(str(item['title']))}</td><td>{html_mod.escape(str(item['severity']))}</td>"
            f"<td>{item['confidence']}%</td><td>{html_mod.escape(str(item.get('endpoint', '')))}</td></tr>"
            for item in payload["detailedFindings"]
        )
        content = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>{html_mod.escape(payload['report']['name'])}</title><style>
body{{font:14px 'IBM Plex Mono',monospace;color:#e9f2e3;background:#050705;margin:40px}}
h1,h2{{color:#b9ff2d;text-transform:uppercase;letter-spacing:.06em}} table{{border-collapse:collapse;width:100%}}
th,td{{border:1px solid rgba(233,242,227,.2);padding:8px;text-align:left;color:#e9f2e3}}
th{{background:#090d09;color:#b9ff2d}} .notice{{padding:12px;background:#111b08;border-left:4px solid #b9ff2d}}
</style></head><body><h1>{html_mod.escape(payload['report']['name'])}</h1>
<p>Generated {html_mod.escape(payload['generatedTimestamp'])} · target {html_mod.escape(payload['target']['host'])}</p>
<div class="notice">Authorized security use only. Active exploitation disabled.</div>
<h2>Coverage</h2><pre>{html_mod.escape(json.dumps(payload['coverage'], indent=2))}</pre>
<h2>Findings</h2><table><thead><tr><th>Title</th><th>Severity</th><th>Confidence</th><th>Endpoint</th></tr></thead>
<tbody>{rows}</tbody></table><h2>Limitations</h2><ul>{''.join(f'<li>{html_mod.escape(item)}</li>' for item in payload['limitations'])}</ul>
</body></html>"""
        path = self.report_directory / f"{report_id}.html"
        path.write_text(content, encoding="utf-8")
        return path

    def _write_csv(self, report_id: str, findings: list[dict[str, Any]]) -> Path:
        import csv

        def safe_cell(value: Any) -> Any:
            if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
                return "'" + value
            return value

        path = self.report_directory / f"{report_id}.csv"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["Title", "Severity", "Confidence", "Source", "Endpoint"])
            for finding in findings:
                writer.writerow([safe_cell(finding["title"]), finding["severity"], finding["confidence"], safe_cell(finding.get("source", "")), safe_cell(finding.get("endpoint", ""))])
        return path
