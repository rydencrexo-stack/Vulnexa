"""Passive web-analysis engine.

Bug-bounty-informed, NON-DESTRUCTIVE checks that send no attack payloads:

* DNS + common-subdomain resolution (passive)
* HTTP/HTTPS fingerprinting (status, redirects, server/tech headers)
* Security-header posture (CSP, HSTS, XFO, nosniff, Referrer-Policy, ...)
* Cookie flags (Secure, HttpOnly, SameSite)
* TLS posture (version, certificate issuer, expiry)
* CORS policy probe (reflection + credentials)
* Information disclosure patterns in body/headers (emails, keys, internal IPs)
* Clickjacking / frame-ancestor protections
* Safe endpoint probes (robots.txt, security.txt, sitemap, and a small,
  read-only set of well-known exposure paths -- GET only, no payloads)

The module is standalone: run it directly from a shell or import it from the
FastAPI service.

    python -m app.scanners.passive_engine example.com --json out.json
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import re
import socket
import ssl
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit

import httpx

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

COMMON_SUBDOMAINS = [
    "www", "mail", "api", "app", "m", "dev", "staging", "test", "demo",
    "admin", "portal", "cdn", "static", "blog", "shop", "store", "vpn",
    "remote", "webmail", "ftp", "autodiscover", "mx", "ns1", "ns2",
]

PROBE_PATHS = [
    ("/.git/config", "git", "Git repository metadata is exposed"),
    ("/.env", "env", "Environment configuration file is exposed"),
    ("/server-status", "apache_status", "Apache server-status page is exposed"),
    ("/actuator", "spring_actuator", "Spring Boot actuator endpoint is exposed"),
    ("/actuator/env", "spring_env", "Spring Boot actuator environment is exposed"),
    ("/actuator/health", "spring_health", "Spring Boot actuator health endpoint is exposed"),
    ("/phpinfo.php", "phpinfo", "PHP phpinfo() page is exposed"),
    ("/swagger-ui/index.html", "swagger", "Swagger UI is exposed"),
    ("/swagger/index.html", "swagger", "Swagger UI is exposed"),
    ("/openapi.json", "openapi", "OpenAPI specification is exposed"),
    ("/api/docs", "api_docs", "Interactive API documentation is exposed"),
    ("/.DS_Store", "ds_store", "macOS .DS_Store metadata is exposed"),
    ("/.svn/entries", "svn", "SVN metadata directory is exposed"),
    ("/backup.zip", "backup", "Backup archive is exposed"),
    ("/backup.sql", "backup", "Backup SQL dump is exposed"),
]

SEVERITY_WEIGHT = {"critical": 30, "high": 16, "medium": 8, "low": 3, "informational": 0}

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
INTERNAL_IP_RE = re.compile(
    r"\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|"
    r"172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2})\b"
)
SECRET_PATTERNS: list[tuple[str, str, str]] = [
    (r"\bAKIA[0-9A-Z]{16}\b", "aws_key", "AWS access key"),
    (r"\bgh[pousr]_[A-Za-z0-9]{36,}\b", "github_token", "GitHub token"),
    (r"\bAIza[0-9A-Za-z_\-]{35}\b", "google_api_key", "Google API key"),
    (r"\b(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}\b", "stripe_key", "Stripe API key"),
    (r"\bxox[baprs]\-[0-9A-Za-z\-]{10,}\b", "slack_token", "Slack token"),
    (r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----", "private_key", "Private key block"),
    (r"\bBearer\s+[A-Za-z0-9\-._~+/]{20,}", "bearer_token", "Bearer authorization token"),
]

FRAMEWORK_MARKERS: list[tuple[str, str]] = [
    ("wp-content", "WordPress"),
    ("__NEXT_DATA__", "Next.js"),
    ("_next/static", "Next.js"),
    ("ng-version", "Angular"),
    ("/assets/index", "React/Vite"),
    ("__vue__", "Vue.js"),
    ("laravel_session", "Laravel"),
    ("XSRF-TOKEN", "Laravel"),
    ("__VIEWSTATE", "ASP.NET"),
    ("/media/system/js", "Joomla"),
    ("drupal", "Drupal"),
    ("shopify", "Shopify"),
    ("cloudflare", "Cloudflare"),
]

SECURITY_HEADERS: list[dict[str, Any]] = [
    {"header": "Content-Security-Policy", "kind": "recommended", "why": "Restrict content sources and mitigate XSS injection."},
    {"header": "Strict-Transport-Security", "kind": "recommended", "why": "Force HTTPS and prevent protocol-downgrade attacks."},
    {"header": "X-Content-Type-Options", "kind": "required", "why": "Prevent MIME-type sniffing.", "want": "nosniff"},
    {"header": "X-Frame-Options", "kind": "required", "why": "Prevent clickjacking when CSP frame-ancestors is absent."},
    {"header": "Referrer-Policy", "kind": "recommended", "why": "Control referrer leakage to third parties."},
    {"header": "Permissions-Policy", "kind": "recommended", "why": "Restrict browser feature access (camera, geolocation, ...)."},
    {"header": "Cross-Origin-Opener-Policy", "kind": "recommended", "why": "Isolate the browsing context from cross-origin popups."},
    {"header": "Cross-Origin-Resource-Policy", "kind": "recommended", "why": "Restrict cross-origin resource embedding."},
]


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _safe_hostname(host: str) -> str:
    return host.strip().lower().rstrip(".")


def _is_valid_domain(domain: str) -> bool:
    if not re.fullmatch(r"(?=.{1,253}\.?$)(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\.?", domain, re.IGNORECASE):
        return False
    return True


def _resolve(host: str) -> list[str]:
    try:
        return sorted({info[4][0] for info in socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)})
    except socket.gaierror:
        return []


def _resolve_cname(host: str) -> str | None:
    try:
        _, aliases, _ = socket.gethostbyname_ex(host)
        return aliases[0] if aliases else None
    except socket.gaierror:
        return None


def _tls_info(host: str, port: int = 443) -> dict[str, Any]:
    ctx = ssl.create_default_context()
    ctx.check_hostname = True
    ctx.verify_mode = ssl.CERT_REQUIRED
    info: dict[str, Any] = {}
    try:
        with socket.create_connection((host, port), timeout=8) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as tls:
                info["tlsVersion"] = tls.version()
                info["cipher"] = tls.cipher()[0] if tls.cipher() else None
                cert = tls.getpeercert()
                if cert:
                    info["issuer"] = cert.get("issuer")
                    info["subject"] = cert.get("subject")
                    info["notBefore"] = cert.get("notBefore")
                    info["notAfter"] = cert.get("notAfter")
    except (ssl.SSLError, socket.error, OSError) as exc:
        info["error"] = f"{type(exc).__name__}: {exc}"
    return info


def _cert_days_left(not_after: str | None) -> int | None:
    if not not_after:
        return None
    try:
        expires = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        return (expires - datetime.now(timezone.utc)).days
    except ValueError:
        return None


class PassiveEngine:
    def __init__(self, timeout: float = 8.0, probe_subdomains: bool = True) -> None:
        self.timeout = timeout
        self.probe_subdomains = probe_subdomains
        self.log_lines: list[str] = []
        self.findings: list[dict[str, Any]] = []
        self.checks: list[dict[str, Any]] = []
        self.assets: list[dict[str, Any]] = []
        self.technologies: list[str] = []
        self._seen_ids: set[str] = set()

    def _log(self, message: str) -> None:
        self.log_lines.append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {message}")

    def _finding(self, title: str, severity: str, category: str, description: str, evidence: str, recommendation: str, url: str = "") -> None:
        finding_id = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:64]
        base = finding_id
        counter = 2
        while finding_id in self._seen_ids:
            finding_id = f"{base}-{counter}"
            counter += 1
        self._seen_ids.add(finding_id)
        self.findings.append({
            "id": finding_id,
            "title": title,
            "severity": severity,
            "category": category,
            "description": description,
            "evidence": evidence[:1200],
            "recommendation": recommendation,
            "url": url,
        })

    def _check(self, category: str, name: str, status: str, evidence: str, recommendation: str = "") -> None:
        self.checks.append({
            "category": category,
            "name": name,
            "status": status,
            "evidence": evidence[:600],
            "recommendation": recommendation,
        })

    # -- analysis helpers -------------------------------------------------

    def _analyze_headers(self, headers: httpx.Headers, url: str, protocol: str) -> None:
        lowered = {key.lower(): value for key, value in headers.items()}
        for definition in SECURITY_HEADERS:
            name = definition["header"]
            present = lowered.get(name.lower())
            if not present:
                status = "fail" if definition["kind"] == "required" else "warn"
                self._check(
                    "headers", name, status,
                    f"Missing {name} response header on {protocol}.",
                    definition["why"],
                )
                continue
            want = definition.get("want")
            if want and want not in present.lower():
                self._check("headers", name, "fail", f"{name}: {present} (expected {want}).", definition["why"])
                continue
            self._check("headers", name, "pass", f"{name}: {present}")

        csp = lowered.get("content-security-policy")
        frame_ancestors = bool(csp and re.search(r"frame-ancestors\s+", csp, re.IGNORECASE))
        xfo = lowered.get("x-frame-options")
        if not xfo and not frame_ancestors:
            self._finding(
                "Missing clickjacking protection",
                "medium",
                "clickjacking",
                "The application does not send X-Frame-Options and the Content-Security-Policy "
                "(if present) does not define frame-ancestors, so the page can be framed by an "
                "attacker-controlled origin.",
                f"{url} returned neither X-Frame-Options nor CSP frame-ancestors.",
                "Set X-Frame-Options: DENY (or SAMEORIGIN) and/or a CSP frame-ancestors directive.",
                url,
            )
        elif xfo and xfo.strip().upper() not in {"DENY", "SAMEORIGIN"}:
            self._finding(
                "Weak X-Frame-Options value",
                "low",
                "clickjacking",
                "X-Frame-Options is present but uses an ineffective value.",
                f"X-Frame-Options: {xfo}",
                "Use X-Frame-Options: DENY or SAMEORIGIN.",
                url,
            )

    def _analyze_cookies(self, headers: httpx.Headers, url: str) -> None:
        for cookie_header in headers.get_list("set-cookie"):
            first = cookie_header.split(";", 1)[0]
            name = first.split("=", 1)[0].strip()
            flags = cookie_header.lower()
            problems: list[str] = []
            if "secure" not in flags:
                problems.append("missing Secure")
            if "httponly" not in flags and name.lower() not in {"csrftoken", "xsrf-token", "__requestverificationtoken"}:
                problems.append("missing HttpOnly")
            same_site = re.search(r"SameSite=(None|Lax|Strict)", cookie_header, re.IGNORECASE)
            if same_site and same_site.group(1).lower() == "none" and "secure" not in flags:
                problems.append("SameSite=None without Secure")
            if problems:
                self._finding(
                    f"Cookie {name} missing security flags",
                    "medium",
                    "cookies",
                    "The session-affecting cookie is set without recommended security flags.",
                    f"Set-Cookie: {cookie_header}  ->  {', '.join(problems)}",
                    "Set Secure, HttpOnly (for session cookies) and SameSite=Lax/Strict.",
                    url,
                )
            else:
                self._check("cookies", f"{name}", "pass", f"Set-Cookie flags OK: {cookie_header}")

    def _probe_cors(self, base: str) -> None:
        try:
            with httpx.Client(timeout=self.timeout, headers={"User-Agent": UA}) as client:
                response = client.request("OPTIONS", base, headers={"Origin": "https://evil.example.com"})
        except httpx.HTTPError:
            return
        acao = response.headers.get("access-control-allow-origin")
        acac = response.headers.get("access-control-allow-credentials", "").lower()
        if acao == "https://evil.example.com" and acac == "true":
            self._finding(
                "CORS trusts arbitrary origins with credentials",
                "high",
                "cors",
                "The server reflects any Origin and allows credentialed requests. A malicious "
                "page can read authenticated responses cross-origin.",
                f"Access-Control-Allow-Origin: {acao}  Access-Control-Allow-Credentials: {acac}",
                "Restrict Access-Control-Allow-Origin to a fixed allow-list and never combine "
                "a reflected origin with Access-Control-Allow-Credentials: true.",
                base,
            )
        elif acao == "https://evil.example.com":
            self._check("cors", "CORS reflection", "warn", f"Origin reflected but no credentials allowed: {acao}")
        else:
            self._check("cors", "CORS policy", "pass", f"ACAO: {acao or 'not present'}")

    def _analyze_info_disclosure(self, text: str, headers: httpx.Headers, url: str) -> None:
        for match in sorted(set(EMAIL_RE.findall(text))):
            if match.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp")):
                continue
            if match.split("@")[1].lower() in {"sentry.io", "wixpress.com", "example.com"}:
                continue
            self._finding(
                "Email address disclosed in response",
                "informational",
                "information_disclosure",
                "A public email address is present in the page or headers, useful for phishing.",
                f"Found: {match}",
                "Review whether the address needs to be public; strip from internal pages.",
                url,
            )
            break
        internal_ips = sorted(set(INTERNAL_IP_RE.findall(text)))
        for ip in internal_ips[:5]:
            self._finding(
                "Internal IP address disclosed",
                "medium",
                "information_disclosure",
                "An internal/RFC1918 IP address is exposed in the response, useful for network mapping.",
                f"Found: {ip}",
                "Remove internal addresses from client-reachable responses.",
                url,
            )
        for pattern, key, label in SECRET_PATTERNS:
            matches = sorted(set(re.findall(pattern, text)))
            for match in matches[:3]:
                self._finding(
                    f"{label} exposed in response",
                    "critical" if key in {"aws_key", "private_key"} else "high",
                    "secrets",
                    f"A likely {label} was found in the response body.",
                    f"Pattern {key}: {match[:48]}...",
                    "Rotate the credential immediately and stop serving it to clients.",
                    url,
                )

    def _fingerprint_tech(self, headers: httpx.Headers, text: str) -> None:
        lowered = {key.lower(): value for key, value in headers.items()}
        for header, label in [
            ("server", None), ("x-powered-by", None), ("x-aspnet-version", None),
            ("x-generator", None), ("x-drupal-cache", None), ("x-vercel-id", None),
            ("x-azure-ref", None), ("x-served-by", None),
        ]:
            value = lowered.get(header)
            if value:
                self.technologies.append(f"{header}: {value}")
        for header in ("cf-ray", "x-amz-cf-id", "x-amz-request-id", "x-cache", "x-varnish", "via"):
            if lowered.get(header):
                self.technologies.append(f"{header}")
        generator = re.search(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']([^"\']+)', text, re.IGNORECASE)
        if generator:
            self.technologies.append(f"generator: {generator.group(1)}")
        for marker, label in FRAMEWORK_MARKERS:
            if marker.lower() in text.lower() and label not in self.technologies:
                self.technologies.append(label)

    def _check_robots(self, base: str) -> None:
        try:
            with httpx.Client(timeout=self.timeout, headers={"User-Agent": UA}, follow_redirects=True) as client:
                response = client.get(base + "/robots.txt")
        except httpx.HTTPError:
            return
        if response.status_code != 200:
            self._check("exposure", "robots.txt", "info", "robots.txt not present or not readable.")
            return
        disallowed = [line.split(":", 1)[1].strip() for line in response.text.splitlines() if line.lower().startswith("disallow:") and line.split(":", 1)[1].strip()]
        self._check("exposure", "robots.txt", "info", f"robots.txt present; {len(disallowed)} Disallow rule(s).", "Review whether any Disallow path leaks sensitive directories.")
        for rule in disallowed:
            if rule and rule != "/" and not any(seed in rule.lower() for seed in ("image", "css", "js", "assets", "media", "static")):
                self._check("exposure", "robots disallow", "warn", f"robots.txt Disallow: {rule}", "Verify the path does not expose sensitive data to unauthenticated users.")

    def _probe_exposures(self, base: str) -> None:
        with httpx.Client(timeout=self.timeout, headers={"User-Agent": UA}, follow_redirects=True) as client:
            for path, key, label in PROBE_PATHS:
                try:
                    response = client.get(base + path)
                except httpx.HTTPError:
                    continue
                if response.status_code != 200:
                    continue
                body = response.text.lower()
                found = False
                if key == "git" and "[core]" in body:
                    found = True
                elif key == "env" and "=" in body and any(s in body for s in ("key", "secret", "password", "token", "database_url", "api_key")):
                    found = True
                elif key == "apache_status" and "apache server status" in body:
                    found = True
                elif key in {"spring_actuator", "spring_env", "spring_health"} and body.startswith("{") and ('"status"' in body or '"_links"' in body or '"propertySources"' in body):
                    found = True
                elif key == "phpinfo" and "phpinfo()" in body:
                    found = True
                elif key in {"swagger", "openapi", "api_docs"} and (("swagger" in body and "paths" in body) or '"swagger":' in body or '"openapi":' in body or "swagger-ui" in body):
                    found = True
                elif key == "ds_store" and b"Bud1" in response.content[:16]:
                    found = True
                elif key == "svn" and "dir" in body and "svn" in body:
                    found = True
                elif key == "backup" and len(response.content) > 0:
                    found = True
                if found:
                    severity = "high" if key in {"git", "env", "backup", "phpinfo", "spring_env"} else ("medium" if key in {"spring_actuator", "svn", "apache_status"} else "low")
                    self._finding(label, severity, "exposure", label + " and returned content suggesting data leakage.", f"GET {base + path} -> {response.status_code}", "Remove or restrict the exposed path; disable debug/metadata endpoints in production.", base + path)

    # -- main flow ---------------------------------------------------------

    def scan(self, domain: str) -> dict[str, Any]:
        started = time.monotonic()
        domain = _safe_hostname(domain)
        result: dict[str, Any] = {
            "domain": domain,
            "scannedAt": _now(),
            "durationSeconds": 0,
            "errors": [],
        }
        if not _is_valid_domain(domain):
            result["errors"].append("Invalid domain name.")
            result["summary"] = {"riskScore": 0, "counts": {"critical": 0, "high": 0, "medium": 0, "low": 0, "informational": 0}, "severityBreakdown": {}}
            result["findings"] = []
            result["checks"] = []
            result["assets"] = []
            result["log"] = self.log_lines
            return result

        self._log(f"passive analysis started for {domain}")
        self._log("resolving A/AAAA records ...")
        ips = _resolve(domain)
        cname = _resolve_cname(domain)
        if not ips:
            result["errors"].append(f"Could not resolve {domain}.")
            self._log(f"! {domain} did not resolve")
            result.update(self._package(domain, started))
            return result
        self._log(f"resolved {domain} -> {', '.join(ips)}")

        assets = [{"hostname": domain, "ip": ips[0], "ips": ips, "kind": "root", "cname": cname}]
        if self.probe_subdomains:
            self._log("resolving common subdomains (passive) ...")
            for sub in COMMON_SUBDOMAINS:
                host = f"{sub}.{domain}"
                sub_ips = _resolve(host)
                if sub_ips:
                    assets.append({"hostname": host, "ip": sub_ips[0], "ips": sub_ips, "kind": "subdomain"})
                    self._log(f"found {host} ({sub_ips[0]})")
        self.assets = assets

        base = f"https://{domain}"
        response = None
        protocol = "https"
        try:
            with httpx.Client(timeout=self.timeout, headers={"User-Agent": UA}, follow_redirects=True, verify=True) as client:
                response = client.get(base)
        except httpx.HTTPError:
            try:
                base = f"http://{domain}"
                protocol = "http"
                with httpx.Client(timeout=self.timeout, headers={"User-Agent": UA}, follow_redirects=True) as client:
                    response = client.get(base)
            except httpx.HTTPError as exc:
                result["errors"].append(f"Could not fetch {domain}: {exc}")
                self._log(f"! fetch failed for {domain}")

        final_url = response.url if response is not None else base
        headers = response.headers if response is not None else httpx.Headers({})
        body = response.text if response is not None else ""
        status_code = response.status_code if response is not None else 0

        if response is not None:
            self._log(f"GET {final_url} -> {status_code}")
            self._analyze_headers(headers, str(final_url), protocol)
            self._analyze_cookies(headers, str(final_url))
            self._probe_cors(base)
            self._analyze_info_disclosure(body + "\n" + "\n".join(f"{k}: {v}" for k, v in headers.items()), headers, str(final_url))
            self._fingerprint_tech(headers, body)
            self._check("http", "final URL", "info", f"{status_code} {final_url}")
            self.assets[0]["httpStatus"] = status_code
            self.assets[0]["url"] = str(final_url)
            self.assets[0]["technologies"] = list(self.technologies)

        if protocol == "https":
            self._log("inspecting TLS certificate ...")
            tls = _tls_info(domain)
            days_left = _cert_days_left(tls.get("notAfter"))
            if tls.get("tlsVersion"):
                self._check("tls", "TLS version", "pass" if tls["tlsVersion"] >= "1.2" else "warn", f"{tls['tlsVersion']} · {tls.get('cipher')}")
                if tls["tlsVersion"] < "1.2":
                    self._finding("Outdated TLS version", "medium", "tls", "The server negotiates an outdated TLS version.", f"TLS {tls['tlsVersion']}", "Disable TLS 1.0/1.1 and require TLS 1.2+.", base)
            if tls.get("error"):
                self._check("tls", "certificate", "fail", tls["error"])
            elif days_left is not None:
                if days_left < 0:
                    self._finding("TLS certificate expired", "high", "tls", "The TLS certificate is expired.", f"Expired {days_left * -1} day(s) ago; notAfter {tls.get('notAfter')}", "Renew the certificate immediately.", base)
                elif days_left < 30:
                    self._finding("TLS certificate expiring soon", "medium", "tls", "The TLS certificate expires within 30 days.", f"{days_left} day(s) left; notAfter {tls.get('notAfter')}", "Renew the certificate before expiry.", base)
                else:
                    self._check("tls", "certificate expiry", "pass", f"{days_left} day(s) until expiry · issuer {tls.get('issuer')}")
            result["tls"] = {"version": tls.get("tlsVersion"), "daysLeft": days_left, "issuer": tls.get("issuer"), "error": tls.get("error")}

        self._log("checking security.txt and robots.txt ...")
        self._check_robots(base)
        try:
            with httpx.Client(timeout=self.timeout, headers={"User-Agent": UA}, follow_redirects=True) as client:
                sec_resp = client.get(base + "/.well-known/security.txt")
                if sec_resp.status_code != 200:
                    sec_resp = client.get(base + "/security.txt")
                if sec_resp.status_code == 200 and ("contact:" in sec_resp.text.lower() or "expires:" in sec_resp.text.lower()):
                    self._check("exposure", "security.txt", "pass", "security.txt present with security contact.")
                else:
                    self._check("exposure", "security.txt", "warn", "security.txt is not exposed.", "Publish a security.txt file describing your disclosure policy.")
        except httpx.HTTPError:
            pass

        self._log("probing well-known exposure paths ...")
        self._probe_exposures(base)

        self._log("correlating findings ...")
        result.update(self._package(domain, started, final_url=str(final_url)))
        return result

    def _package(self, domain: str, started: float, final_url: str = "") -> dict[str, Any]:
        counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "informational": 0}
        for finding in self.findings:
            counts[finding["severity"]] = counts.get(finding["severity"], 0) + 1
        score = 100 - sum(SEVERITY_WEIGHT.get(s, 0) * counts[s] for s in counts)
        score = max(0, min(100, score))
        return {
            "url": final_url or f"https://{domain}",
            "durationSeconds": round(time.monotonic() - started, 2),
            "summary": {
                "riskScore": score,
                "counts": counts,
                "severityBreakdown": counts,
                "checksPassed": sum(1 for c in self.checks if c["status"] == "pass"),
                "checksFailed": sum(1 for c in self.checks if c["status"] == "fail"),
                "checksWarned": sum(1 for c in self.checks if c["status"] == "warn"),
                "assets": len(self.assets),
                "technologies": len(self.technologies),
            },
            "findings": self.findings,
            "checks": self.checks,
            "assets": self.assets,
            "technologies": self.technologies,
            "log": self.log_lines,
        }


def scan_domain(domain: str, timeout: float = 8.0, probe_subdomains: bool = True) -> dict[str, Any]:
    return PassiveEngine(timeout=timeout, probe_subdomains=probe_subdomains).scan(domain)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="PAN passive web-analysis engine")
    parser.add_argument("domain", help="Target domain (no scheme)")
    parser.add_argument("--json", metavar="FILE", help="Write the full result JSON to FILE")
    parser.add_argument("--timeout", type=float, default=8.0, help="Per-request timeout in seconds")
    parser.add_argument("--no-subdomains", action="store_true", help="Skip passive subdomain resolution")
    args = parser.parse_args(argv)

    result = scan_domain(args.domain, timeout=args.timeout, probe_subdomains=not args.no_subdomains)

    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(result, handle, indent=2)
    else:
        print(json.dumps(result, indent=2))
    return 0 if not result.get("errors") else 2


if __name__ == "__main__":
    sys.exit(main())