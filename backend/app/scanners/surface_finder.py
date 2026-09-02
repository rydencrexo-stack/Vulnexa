"""Surface Finder — recursive, graph-based, passive attack-surface discovery.

Layers:
  A. Identity      organization + root domain assets
  B. Domains       crt.sh (CT) + AlienVault OTX subdomains
  C. Certificates  certificate entities + SAN relationships (recursive)
  D. DNS graph     A/AAAA/CNAME/MX/NS/TXT/CAA per hostname -> IP assets
  E. Network       reverse DNS + ipinfo ASN/org/geo + cloud-provider inference
  F. URL intel     Wayback CDX + Common Crawl -> parsed URL assets + docs/API
  G. Code          GitHub code search (token-gated)
  H. Technology    lightweight HTTP probe per resolved host (headers/HTML)
  I. Findings      full passive checks on the root domain (reuses passive_engine)

Recursion is bounded: per-hostname dedup, candidate caps, URL caps, IP caps.
"""

from __future__ import annotations

import concurrent.futures as futures
import re
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit

import httpx

from app.scanners import dns_client, surface_sources
from app.scanners.surface_graph import (
    Graph,
    build_evidence,
    infer_cidr,
    infer_provider,
    registrable_domain,
)

MAX_CANDIDATES = 300
MAX_URLS_TOTAL = 600
MAX_URLS_PER_HOST = 120
MAX_IP_GEO = 16
MAX_PROBES = 10
MAX_HOST_WAYBACK = 30
HOST_WAYBACK_LIMIT = 150
MAX_TIMELINE = 600

SENSITIVE_HINTS = (
    "login", "auth", "admin", "api", "graphql", "swagger", "openapi", "redoc",
    "vpn", "portal", "jenkins", "kibana", "grafana", "mail", "webmail", "ftp",
    "git", "gitlab", "jira", "confluence", "staging", "dev", "test", "console",
    "sso", "monitor", "prometheus", "sonarqube", "sftp",
)

DOC_PATTERNS = re.compile(r"(swagger|openapi|graphql|redoc|postman|\.json$|/docs|/api-docs|/api/|graphql\.php|/v[0-9]+/)", re.IGNORECASE)
JS_EXTENSIONS = (".js", ".mjs", ".cjs")


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _host_interest(hostname: str) -> int:
    value = hostname.lower()
    return sum(1 for hint in SENSITIVE_HINTS if hint in value)


class SurfaceFinder:
    def __init__(
        self,
        *,
        github_token: str | None = None,
        timeout: float = 8.0,
        probe_subdomains: bool = True,
        on_log: Any | None = None,
    ) -> None:
        self.github_token = github_token
        self.timeout = timeout
        self.probe_subdomains = probe_subdomains
        self.on_log = on_log
        self.graph = Graph()
        self.log_lines: list[str] = []
        self.sources_used: set[str] = set()
        self._client = httpx.Client(
            headers={"User-Agent": surface_sources.UA},
            follow_redirects=True,
            verify=True,
            timeout=timeout,
        )
        self.root_checks: list[dict[str, Any]] = []
        self.root_findings: list[dict[str, Any]] = []
        self.root_technologies: list[str] = []
        self.root_tls: dict[str, Any] | None = None
        self.root_errors: list[str] = []
        self.root_risk_score: int | None = None

    def _log(self, message: str) -> None:
        self.log_lines.append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {message}")
        if self.on_log is not None:
            try:
                self.on_log(self.log_lines[-1])
            except Exception:  # noqa: BLE001 - a streaming callback must never break discovery
                pass

    def close(self) -> None:
        self._client.close()

    # ------------------------------------------------------------------ #
    def find(self, domain: str) -> dict[str, Any]:
        started = time.monotonic()
        domain = domain.strip().lower().rstrip(".")
        result: dict[str, Any] = {
            "domain": domain,
            "scannedAt": _now(),
            "durationSeconds": 0,
            "errors": [],
            "sourcesUsed": [],
            "sourceCounts": {},
        }
        self._log(f"surface discovery started for {domain}")

        # A — Identity
        org_label = registrable_domain(domain).split(".")[0]
        org = self.graph.get_or_create("organization", org_label, sources=["input"], scope="in_scope", confidence="high", evidence=[build_evidence("input", "Root domain label")])
        root = self.graph.get_or_create("domain", domain, sources=["input"], scope="in_scope", confidence="high", evidence=[build_evidence("input", "User-provided root domain")])
        self.graph.add_relationship(org, root, "owns", sources=["input"], confidence="high")
        self.sources_used.add("input")

        candidates: dict[str, dict[str, Any]] = {domain: root}

        # B + C — parallel passive web sources (CT + OTX + Wayback + Common Crawl)
        self._log("collecting passive internet intelligence (CT / OTX / Wayback) ...")
        web = self._collect_passive_web(domain)

        for source, certificates in (("certspotter", web["certspotter"]["certificates"]), ("crt.sh", web["crtsh"]["certificates"])):
            if not certificates:
                continue
            self.sources_used.add(source)
            for entry in certificates:
                cert = self.graph.get_or_create(
                    "certificate",
                    entry["certificateId"],
                    sources=[source],
                    scope="in_scope",
                    confidence="high",
                    first_seen=entry.get("notBefore"),
                    last_seen=entry.get("notAfter"),
                    metadata={"issuer": entry.get("issuer", ""), "san": entry.get("san", []), "notBefore": entry.get("notBefore"), "notAfter": entry.get("notAfter")},
                    evidence=[build_evidence(source, f"SAN list includes {', '.join(entry.get('san', [])[:8])}")],
                )
                self.graph.add_relationship(root, cert, "has_certificate", sources=[source], confidence="high", observed_at=entry.get("notBefore"))
                for san in entry.get("san", []):
                    if san == domain:
                        continue
                    kind = "domain" if san == registrable_domain(san) else "subdomain"
                    scope = "in_scope" if san.endswith(domain) else "needs_review"
                    sub = self.graph.get_or_create(kind, san, sources=[source], scope=scope, confidence="medium", first_seen=entry.get("notBefore"), last_seen=entry.get("notAfter"), evidence=[build_evidence(source, f"SAN on certificate {entry['certificateId']}")])
                    self.graph.add_relationship(sub, cert, "has_certificate", sources=[source], confidence="high", observed_at=entry.get("notBefore"))
                    self.graph.add_relationship(cert, sub, "san_of", sources=[source], confidence="high", observed_at=entry.get("notBefore"))
                    self.graph.add_timeline(entry.get("notBefore"), "certificate SAN discovered", sub["id"], source)
                    candidates.setdefault(san, sub)

        otx = web["otx"]
        if otx.get("hostnames") or otx.get("passiveDns"):
            self.sources_used.add("otx")
            for hostname in otx.get("hostnames", []):
                if hostname == domain:
                    continue
                kind = "domain" if hostname == registrable_domain(hostname) else "subdomain"
                scope = "in_scope" if hostname.endswith(domain) else "needs_review"
                sub = self.graph.get_or_create(kind, hostname, sources=["otx"], scope=scope, confidence="medium", evidence=[build_evidence("otx", "Passive DNS hostname observation")])
                self.graph.add_relationship(sub, root, "subdomain_of", sources=["otx"], confidence="medium")
                candidates.setdefault(hostname, sub)
            for record in otx.get("passiveDns", []):
                hostname = record.get("hostname", "")
                if not hostname or not record.get("address"):
                    continue
                kind = "domain" if hostname == registrable_domain(hostname) else "subdomain"
                scope = "in_scope" if hostname.endswith(domain) else "needs_review"
                host_asset = self.graph.get_or_create(kind, hostname, sources=["otx"], scope=scope, confidence="medium", first_seen=record.get("first"), last_seen=record.get("last"), evidence=[build_evidence("otx", f"Passive DNS {record.get('recordType')} -> {record.get('address')}")])
                ip_asset = self.graph.get_or_create("ip", record["address"], sources=["otx"], confidence="medium", evidence=[build_evidence("otx", f"{record.get('recordType')} record for {hostname}")])
                self.graph.add_relationship(host_asset, ip_asset, "resolves_to", sources=["otx"], confidence="medium")
                self.graph.add_timeline(record.get("first"), "passive DNS observed", host_asset["id"], "otx")
                candidates.setdefault(hostname, host_asset)

        # F — domain-wide historical URLs (from the parallel phase)
        for record in web["wayback"]:
            self._ingest_url(record, candidates)

        # bound candidates
        if len(candidates) > MAX_CANDIDATES:
            self._log(f"candidate cap reached ({len(candidates)} -> {MAX_CANDIDATES})")
            candidates = dict(list(candidates.items())[:MAX_CANDIDATES])

        # D — live DNS for each candidate hostname
        self._log(f"resolving DNS for {len(candidates)} hostnames ...")
        self._resolve_all(candidates, domain)

        # E — network metadata for a bounded set of unique IPs
        self._network_metadata()

        # F — per-host historical URL expansion (parallel, bounded)
        self._expand_host_urls(domain, candidates)

        # G — GitHub code references (token-gated)
        self._collect_github(domain)

        # H — lightweight HTTP probes for interesting in-scope hosts
        if self.probe_subdomains:
            self._probe_http(candidates, domain)

        # I — full passive checks on the root domain
        self._run_root_checks(domain)

        # finalize + serialize
        graph_payload = self.graph.finalize(domain)
        result["durationSeconds"] = round(time.monotonic() - started, 2)
        result["graph"] = graph_payload
        result["assets"] = graph_payload["assets"]
        result["relationships"] = graph_payload["relationships"]
        result["timeline"] = graph_payload["timeline"]
        result["sourcesUsed"] = sorted(self.sources_used)
        result["sourceCounts"] = self._source_counts()
        result["summary"] = self._summary(domain, len(result["assets"]), len(result["relationships"]))
        result["checks"] = getattr(self, "root_checks", [])
        result["findings"] = getattr(self, "root_findings", [])
        result["technologies"] = getattr(self, "root_technologies", [])
        result["tls"] = getattr(self, "root_tls", None)
        result["errors"].extend(getattr(self, "root_errors", []))
        result["log"] = self.log_lines
        self._log(f"done — {len(result['assets'])} assets, {len(result['relationships'])} relationships")
        return result

    # ------------------------------------------------------------------ #
    def _resolve_all(self, candidates: dict[str, dict[str, Any]], root_domain: str) -> None:
        with futures.ThreadPoolExecutor(max_workers=8) as pool:
            future_map = {pool.submit(dns_client.resolve, host, self.timeout): host for host in candidates}
            for future in futures.as_completed(future_map):
                host = future_map[future]
                try:
                    records = future.result()
                except Exception:  # noqa: BLE001
                    continue
                asset = candidates[host]
                in_scope = host.endswith(root_domain)
                asset["resolves"] = bool(records["a"] or records["aaaa"] or records["cname"])
                asset["metadata"]["dns"] = records
                asset["metadata"]["provider"] = infer_provider(host, (records["a"] or [None])[0], records["cname"])
                for source in ("a", "aaaa", "cname"):
                    if records[source]:
                        asset["sources"] = list(dict.fromkeys(asset["sources"] + ["dns"]))
                        self.sources_used.add("dns")
                        break
                if asset.get("lastSeen") is None and asset["resolves"]:
                    asset["lastSeen"] = _now()
                for ip in records["a"] + records["aaaa"]:
                    ip_asset = self.graph.get_or_create("ip", ip, sources=["dns"], confidence="high", evidence=[build_evidence("dns", f"A/AAAA record for {host}")])
                    self.graph.add_relationship(asset, ip_asset, "resolves_to", sources=["dns"], confidence="high")
                    ip_asset["resolves"] = True
                for cname in records["cname"]:
                    provider = infer_provider(cname)
                    if provider:
                        provider_asset = self.graph.get_or_create("cloud_provider", provider, sources=["dns"], confidence="medium", evidence=[build_evidence("dns", f"CNAME target {cname} is a {provider} endpoint")])
                        self.graph.add_relationship(asset, provider_asset, "hosted_by", sources=["dns"], confidence="medium")
                    if cname and not cname.endswith(root_domain):
                        kind = "domain" if cname == registrable_domain(cname) else "subdomain"
                        target = self.graph.get_or_create(kind, cname, sources=["dns"], scope="needs_review", confidence="medium", evidence=[build_evidence("dns", f"CNAME target of {host}")])
                        self.graph.add_relationship(asset, target, "cname_to", sources=["dns"], confidence="high")
                for mx in records["mx"]:
                    exchange = mx.get("exchange", "")
                    if exchange and exchange.endswith(root_domain) and exchange not in candidates:
                        mail = self.graph.get_or_create("subdomain", exchange, sources=["dns"], scope="in_scope", confidence="medium", evidence=[build_evidence("dns", f"MX exchange of {host}")])
                        self.graph.add_relationship(asset, mail, "subdomain_of", sources=["dns"], confidence="medium")
                # wire subdomain_of edge for in-scope subdomains
                if asset["type"] == "subdomain" and host.endswith(root_domain):
                    root_asset = candidates.get(root_domain)
                    if root_asset:
                        self.graph.add_relationship(asset, root_asset, "subdomain_of", sources=asset["sources"], confidence="medium")

    def _network_metadata(self) -> None:
        unique_ips: list[str] = []
        for asset in self.graph.assets.values():
            if asset["type"] == "ip" and asset["value"] not in unique_ips:
                unique_ips.append(asset["value"])
        unique_ips = unique_ips[:MAX_IP_GEO]
        if not unique_ips:
            return
        self._log(f"resolving network metadata for {len(unique_ips)} IP(s) ...")
        with futures.ThreadPoolExecutor(max_workers=8) as pool:
            future_map = {pool.submit(surface_sources.ipinfo, ip, self._client, 6.0): ip for ip in unique_ips}
            for future in futures.as_completed(future_map):
                ip = future_map[future]
                try:
                    info = future.result()
                except Exception:  # noqa: BLE001
                    continue
                asset = self.graph.assets.get(f"ip:{ip}")
                if not asset:
                    continue
                if info:
                    asset["metadata"]["asn"] = info.get("asn")
                    asset["metadata"]["org"] = info.get("org")
                    asset["metadata"]["geo"] = f"{info.get('city', '')}, {info.get('region', '')}, {info.get('country', '')}".strip(", ")
                    asset["metadata"]["reverseDns"] = info.get("hostname")
                    asset["sources"] = list(dict.fromkeys(asset["sources"] + ["ipinfo"]))
                    self.sources_used.add("ipinfo")
                    asset["evidence"].append(build_evidence("ipinfo", f"{info.get('org', '')} · {asset['metadata']['geo']}"))
                    if info.get("org"):
                        org = self.graph.get_or_create("organization", info["org"].split(" ", 1)[-1] if " " in info["org"] else info["org"], sources=["ipinfo"], scope="needs_review", confidence="medium", evidence=[build_evidence("ipinfo", f"Org for {ip}")])
                        self.graph.add_relationship(asset, org, "belongs_to_asn", sources=["ipinfo"], confidence="medium")
                else:
                    asset["metadata"]["reverseDns"] = dns_client.reverse_dns(ip)
                cidr = infer_cidr(ip)
                if cidr:
                    asset["metadata"]["cidr"] = cidr

    def _collect_passive_web(self, domain: str) -> dict[str, Any]:
        def run_crtsh():
            return surface_sources.crtsh(domain, self._client, timeout=14.0)

        def run_certspotter():
            return surface_sources.certspotter(domain, self._client, timeout=12.0)

        def run_otx():
            return surface_sources.otx(domain, self._client, timeout=9.0)

        def run_wayback():
            return surface_sources.wayback(domain, self._client, timeout=20.0)

        def run_commoncrawl():
            return surface_sources.commoncrawl(domain, self._client, timeout=7.0)

        with futures.ThreadPoolExecutor(max_workers=5) as pool:
            crtsh_future = pool.submit(run_crtsh)
            certspotter_future = pool.submit(run_certspotter)
            otx_future = pool.submit(run_otx)
            wayback_future = pool.submit(run_wayback)
            commoncrawl_future = pool.submit(run_commoncrawl)
            crtsh = crtsh_future.result()
            certspotter = certspotter_future.result()
            otx = otx_future.result()
            wayback = wayback_future.result()
            commoncrawl = commoncrawl_future.result()
        if crtsh.get("hostnames") or crtsh.get("certificates"):
            self.sources_used.add("crt.sh")
        if certspotter.get("hostnames") or certspotter.get("certificates"):
            self.sources_used.add("certspotter")
        if otx.get("hostnames") or otx.get("passiveDns"):
            self.sources_used.add("otx")
        if wayback:
            self.sources_used.add("wayback")
        if commoncrawl:
            self.sources_used.add("commoncrawl")
        for url in commoncrawl:
            self._ingest_url({"timestamp": "", "url": url, "statusCode": "200", "mimetype": "", "source": "commoncrawl"}, {})
        return {"crtsh": crtsh, "certspotter": certspotter, "otx": otx, "wayback": wayback, "commoncrawl": commoncrawl}

    def _expand_host_urls(self, domain: str, candidates: dict[str, dict[str, Any]]) -> None:
        interesting = sorted(
            [host for host, asset in candidates.items() if asset.get("resolves") or _host_interest(host)],
            key=lambda host: (-_host_interest(host), host),
        )
        selected = interesting[:MAX_HOST_WAYBACK]
        if not selected:
            return
        self._log(f"expanding historical URLs for {len(selected)} host(s) ...")

        def fetch(host: str):
            return surface_sources.wayback(host, self._client, timeout=16.0, limit=HOST_WAYBACK_LIMIT)

        with futures.ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(fetch, selected))
        for host, host_urls in zip(selected, results):
            for record in host_urls:
                self._ingest_url(record, candidates)

    def _ingest_url(self, record: dict[str, Any], candidates: dict[str, dict[str, Any]]) -> None:
        raw_url = record.get("url", "")
        if not raw_url:
            return
        try:
            parsed = urlsplit(raw_url)
        except ValueError:
            return
        hostname = (parsed.hostname or "").lower().rstrip(".")
        if not hostname:
            return
        if len(self.graph.assets) > MAX_URLS_TOTAL:
            return
        host_asset_pre = candidates.get(hostname) if candidates else None
        if host_asset_pre and int(host_asset_pre.get("urlCount", 0)) >= MAX_URLS_PER_HOST:
            return
        timestamp = record.get("timestamp", "")
        date = f"{timestamp[:4]}-{timestamp[4:6]}-{timestamp[6:8]}" if len(timestamp) >= 8 else None
        status_code = record.get("statusCode", "")
        path = parsed.path or "/"
        parameters = [pair.split("=", 1)[0] for pair in parsed.query.split("&") if pair] if parsed.query else []
        source = record.get("source", "wayback")

        url_asset = self.graph.get_or_create(
            "url",
            raw_url,
            sources=[source],
            scope="needs_review",
            confidence="medium",
            first_seen=date,
            last_seen=date,
            metadata={
                "hostname": hostname,
                "path": path,
                "queryParameters": parameters[:10],
                "extension": parsed.path.rsplit(".", 1)[-1].lower() if "." in parsed.path.rsplit("/", 1)[-1] else "",
                "statusCode": status_code,
            },
            evidence=[build_evidence(source, f"Historical {record.get('mimetype') or 'URL'} observation")],
        )
        host_asset = candidates.get(hostname) or self.graph.get_or_create(
            "subdomain" if not hostname == registrable_domain(hostname) else "domain",
            hostname,
            sources=[source],
            scope="in_scope" if hostname.endswith(registrable_domain(hostname)) else "needs_review",
            confidence="medium",
            evidence=[build_evidence(source, f"URL observed under {hostname}")],
        )
        if source == "commoncrawl":
            self.sources_used.add("commoncrawl")
        self.graph.add_relationship(host_asset, url_asset, "historical_url", sources=[source], confidence="medium", observed_at=date)
        self.graph.add_timeline(date, "historical URL observed", url_asset["id"], source)
        host_asset.setdefault("urlCount", 0)
        host_asset["urlCount"] += 1

        if DOC_PATTERNS.search(path + (parsed.query or "")):
            doc_asset = self.graph.get_or_create(
                "documentation",
                f"{hostname}{path}",
                sources=[source],
                scope="in_scope" if hostname.endswith(registrable_domain(hostname)) else "needs_review",
                confidence="medium",
                first_seen=date,
                last_seen=date,
                metadata={"hostname": hostname, "path": path},
                evidence=[build_evidence(source, f"API documentation endpoint {path}")],
            )
            self.graph.add_relationship(host_asset, doc_asset, "documented_at", sources=[source], confidence="medium", observed_at=date)

    def _collect_github(self, domain: str) -> None:
        if not self.github_token:
            return
        self._log("searching GitHub code references ...")
        refs = surface_sources.github_repositories(domain, self._client, self.github_token)
        if not refs:
            return
        self.sources_used.add("github")
        for ref in refs:
            repo_name = ref.get("repository", "")
            if not repo_name:
                continue
            repo = self.graph.get_or_create("repository", repo_name, sources=["github"], scope="needs_review", confidence="medium", evidence=[build_evidence("github", f"Code reference at {ref.get('path', '')}")])
            self.graph.add_relationship(repo, candidates.get(domain) or next(iter(self.graph.assets.values())), "referenced_by", sources=["github"], confidence="medium")

    def _probe_http(self, candidates: dict[str, dict[str, Any]], root_domain: str) -> None:
        probeable = sorted(
            [host for host, asset in candidates.items() if asset.get("resolves") and host.endswith(root_domain)],
            key=lambda host: (-_host_interest(host), host),
        )[:MAX_PROBES]
        if root_domain in candidates and root_domain not in probeable:
            probeable = [root_domain] + probeable
        probeable = probeable[:MAX_PROBES]
        self._log(f"HTTP fingerprinting {len(probeable)} host(s) ...")

        def probe(host: str) -> tuple[str, dict[str, Any]]:
            for scheme in ("https", "http"):
                try:
                    response = self._client.get(f"{scheme}://{host}", timeout=self.timeout)
                    title_match = re.search(r"<title[^>]*>(.*?)</title>", response.text, re.IGNORECASE | re.DOTALL)
                    return host, {
                        "statusCode": response.status_code,
                        "finalUrl": str(response.url),
                        "headers": {key.lower(): value for key, value in response.headers.items()},
                        "title": title_match.group(1).strip()[:160] if title_match else "",
                        "text": response.text[:6000],
                    }
                except httpx.HTTPError:
                    continue
            return host, {"statusCode": 0, "headers": {}, "text": "", "title": ""}

        with futures.ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(probe, probeable))
        for host, info in results:
            asset = candidates.get(host)
            if not asset:
                continue
            if info["statusCode"]:
                asset["httpStatus"] = info["statusCode"]
                asset["metadata"]["finalUrl"] = info.get("finalUrl", "")
                asset["metadata"]["headers"] = {k: v for k, v in info.get("headers", {}).items() if k in {"server", "x-powered-by", "x-generator", "x-aspnet-version", "content-type", "set-cookie"}}
                asset["evidence"].append(build_evidence("http", f"HTTP {info['statusCode']} at {info.get('finalUrl', '')}"))
                asset["sources"] = list(dict.fromkeys(asset["sources"] + ["http"]))
                self.sources_used.add("http")
                tech = self._fingerprint(info)
                asset["metadata"]["technologies"] = tech
                for technology in tech:
                    tech_asset = self.graph.get_or_create("technology", technology, sources=["http"], scope="needs_review", confidence="medium", evidence=[build_evidence("http", f"Fingerprint on {host}")])
                    self.graph.add_relationship(asset, tech_asset, "uses_technology", sources=["http"], confidence="medium")

    def _fingerprint(self, info: dict[str, Any]) -> list[str]:
        tech: list[str] = []
        headers = info.get("headers", {})
        for header in ("server", "x-powered-by", "x-generator", "x-aspnet-version"):
            if headers.get(header):
                tech.append(f"{header}: {headers[header]}")
        if headers.get("set-cookie"):
            cookie = headers["set-cookie"]
            for marker, label in (("laravel_session", "Laravel"), ("XSRF-TOKEN", "Laravel"), ("PHPSESSID", "PHP"), ("__VIEWSTATE", "ASP.NET"), ("JSESSIONID", "Java")):
                if marker in cookie:
                    tech.append(label)
                    break
        text = info.get("text", "")
        for marker, label in (("wp-content", "WordPress"), ("__NEXT_DATA__", "Next.js"), ("_next/static", "Next.js"), ("ng-version", "Angular"), ("__vue__", "Vue.js"), ("drupal", "Drupal"), ("react", "React")):
            if marker in text:
                tech.append(label)
                break
        return list(dict.fromkeys(tech))

    def _run_root_checks(self, domain: str) -> None:
        try:
            from app.scanners.passive_engine import PassiveEngine

            self._log(f"running passive checks on {domain} ...")
            engine = PassiveEngine(timeout=self.timeout, probe_subdomains=False)
            report = engine.scan(domain)
            self.root_checks = report.get("checks", [])
            self.root_findings = report.get("findings", [])
            self.root_technologies = report.get("technologies", [])
            self.root_tls = report.get("tls")
            self.root_errors = report.get("errors", [])
            self.root_risk_score = report.get("summary", {}).get("riskScore")
            for technology in self.root_technologies:
                tech_asset = self.graph.get_or_create("technology", technology, sources=["http"], scope="needs_review", confidence="medium", evidence=[build_evidence("http", "Root response fingerprint")])
                root_asset = self.graph.assets.get(f"domain:{domain}")
                if root_asset:
                    self.graph.add_relationship(root_asset, tech_asset, "uses_technology", sources=["http"], confidence="medium")
        except Exception as exc:  # noqa: BLE001
            self.root_checks, self.root_findings, self.root_technologies, self.root_tls, self.root_errors = [], [], [], None, [str(exc)]

    # ------------------------------------------------------------------ #
    def _source_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for asset in self.graph.assets.values():
            for source in asset["sources"]:
                counts[source] = counts.get(source, 0) + 1
        return dict(sorted(counts.items(), key=lambda item: -item[1]))

    def _summary(self, domain: str, asset_count: int, relationship_count: int) -> dict[str, Any]:
        by_type: dict[str, int] = {}
        for asset in self.graph.assets.values():
            by_type[asset["type"]] = by_type.get(asset["type"], 0) + 1
        tiers: dict[str, list[str]] = {"high": [], "review": [], "historical": [], "informational": []}
        in_scope = 0
        high_confidence = 0
        resolving = 0
        for asset in self.graph.assets.values():
            if asset["type"] not in {"subdomain", "domain", "ip"}:
                continue
            tiers[asset.get("priority", "informational")].append(asset["value"])
            if asset.get("scope") == "in_scope":
                in_scope += 1
            if asset.get("confidence") == "high":
                high_confidence += 1
            if asset.get("resolves"):
                resolving += 1
        tiers = {key: value[:60] for key, value in tiers.items()}
        finding_counts = {sev: 0 for sev in ("critical", "high", "medium", "low", "informational")}
        for finding in getattr(self, "root_findings", []):
            finding_counts[finding.get("severity", "informational")] = finding_counts.get(finding.get("severity", "informational"), 0) + 1
        return {
            "riskScore": getattr(self, "root_risk_score", None) if getattr(self, "root_risk_score", None) is not None else 60,
            "assetCounts": by_type,
            "assetTotal": asset_count,
            "relationshipCount": relationship_count,
            "inScopeAssets": in_scope,
            "highConfidenceAssets": high_confidence,
            "resolvingHosts": resolving,
            "priorityTiers": tiers,
            "findingCounts": finding_counts,
            "sourcesUsed": sorted(self.sources_used),
            "rootDomain": domain,
        }


def find_surface(
    domain: str,
    *,
    github_token: str | None = None,
    timeout: float = 8.0,
    probe_subdomains: bool = True,
    on_log: Any | None = None,
) -> dict[str, Any]:
    finder = SurfaceFinder(
        github_token=github_token,
        timeout=timeout,
        probe_subdomains=probe_subdomains,
        on_log=on_log,
    )
    try:
        return finder.find(domain)
    finally:
        finder.close()