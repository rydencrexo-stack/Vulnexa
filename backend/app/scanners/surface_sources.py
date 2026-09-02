"""Passive discovery source collectors.

Every collector returns normalized JSON-safe records and never throws: on
failure it returns [] (or a partial result) so one slow source cannot kill a
run. Sources are tracked by name in every returned record so provenance is
never lost.
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

UA = "PAN-SurfaceFinder/0.1 (attack-surface discovery; authorized use only)"

DOMAIN_RE = re.compile(
    r"(?=[a-z0-9-]{1,63}\.)(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}",
    re.IGNORECASE,
)


def extract_hostnames(value: str) -> set[str]:
    out: set[str] = set()
    cleaned = value.replace("*.", "").replace("\\n", "\n").replace("\\", "").replace("\\\n", "\n")
    for match in DOMAIN_RE.finditer(cleaned):
        host = match.group(0).lower().rstrip(".")
        if "." in host:
            out.add(host)
    return out


def crtsh(domain: str, client: httpx.Client, timeout: float = 14.0) -> dict[str, Any]:
    """Certificate Transparency via crt.sh (secondary; flaky). Returns certificates + hostnames."""
    records: dict[str, Any] = {"certificates": [], "hostnames": set()}
    for attempt in range(2):
        try:
            response = client.get(
                f"https://crt.sh/?q=%25.{domain}&output=json",
                headers={"User-Agent": UA},
                timeout=timeout,
            )
            if response.status_code != 200:
                continue
            payload = response.json()
            break
        except (httpx.HTTPError, ValueError, TypeError):
            payload = None
    else:
        return records
    if not isinstance(payload, list):
        return records
    seen_certs: set[str] = set()
    for entry in payload:
        if not isinstance(entry, dict):
            continue
        certificate_id = str(entry.get("id", ""))
        if not certificate_id or certificate_id in seen_certs:
            continue
        seen_certs.add(certificate_id)
        names = entry.get("name_value", "")
        hostnames = extract_hostnames(names)
        issuer = str(entry.get("issuer_name", "") or "")
        not_before = str(entry.get("not_before", "") or "")[:10]
        not_after = str(entry.get("not_after", "") or "")[:10]
        records["certificates"].append({
            "certificateId": certificate_id,
            "issuer": issuer,
            "organization": str(entry.get("name_value", "") or ""),
            "notBefore": not_before,
            "notAfter": not_after,
            "san": sorted(hostnames),
        })
        records["hostnames"].update(hostnames)
    return records


def certspotter(domain: str, client: httpx.Client, timeout: float = 12.0) -> dict[str, Any]:
    """Certificate Transparency via CertSpotter (free tier, no key, reliable)."""
    records: dict[str, Any] = {"certificates": [], "hostnames": set()}
    try:
        response = client.get(
            "https://api.certspotter.com/v1/issuances",
            params={"domain": domain, "include_subdomains": "true", "expand": "dns_names"},
            headers={"User-Agent": UA},
            timeout=timeout,
        )
        if response.status_code != 200:
            return records
        payload = response.json()
    except (httpx.HTTPError, ValueError, TypeError):
        return records
    if not isinstance(payload, list):
        return records
    for index, entry in enumerate(payload):
        if not isinstance(entry, dict):
            continue
        dns_names = [str(name).replace("*.", "").lower().rstrip(".") for name in entry.get("dns_names", []) if name]
        dns_names = [name for name in dns_names if name]
        if not dns_names:
            continue
        not_before = str(entry.get("not_before", "") or "")[:10]
        not_after = str(entry.get("not_after", "") or "")[:10]
        records["certificates"].append({
            "certificateId": f"certspotter-{index + 1}",
            "issuer": "CertSpotter CT",
            "organization": "",
            "notBefore": not_before,
            "notAfter": not_after,
            "san": sorted(set(dns_names)),
        })
        records["hostnames"].update(dns_names)
    return records


def wayback(domain: str, client: httpx.Client, timeout: float = 25.0, limit: int = 2500) -> list[dict[str, Any]]:
    """Historical URLs from the Wayback Machine CDX API (matchType=domain)."""
    records: list[dict[str, Any]] = []
    params = {
        "url": domain,
        "matchType": "domain",
        "output": "json",
        "fl": "timestamp,original,statuscode,mimetype",
        "collapse": "urlkey",
        "limit": str(limit),
    }
    try:
        response = client.get(
            "https://web.archive.org/cdx/search/cdx",
            params=params,
            headers={"User-Agent": UA},
            timeout=timeout,
        )
        if response.status_code != 200:
            return records
        payload = response.json()
    except (httpx.HTTPError, ValueError, TypeError):
        return records
    if not isinstance(payload, list) or len(payload) < 2:
        return records
    for row in payload[1:]:
        if not isinstance(row, list) or len(row) < 4:
            continue
        timestamp, original, statuscode, mimetype = row[0], row[1], row[2], row[3]
        records.append({
            "timestamp": timestamp,
            "url": original,
            "statusCode": statuscode,
            "mimetype": mimetype,
            "source": "wayback",
        })
    return records


def otx(domain: str, client: httpx.Client, timeout: float = 15.0) -> dict[str, Any]:
    """AlienVault OTX passive DNS + subdomains (public, no key)."""
    records: dict[str, Any] = {"passiveDns": [], "hostnames": set()}
    try:
        response = client.get(
            f"https://otx.alienvault.com/api/v1/indicators/domain/{domain}/passive_dns",
            headers={"User-Agent": UA},
            timeout=timeout,
        )
        if response.status_code == 200:
            payload = response.json()
            for entry in payload.get("passive_dns", []) or []:
                hostname = str(entry.get("hostname", "") or "").lower().rstrip(".")
                address = str(entry.get("address", "") or "")
                record_type = str(entry.get("record_type", "") or "")
                first = str(entry.get("first", "") or "")[:10]
                last = str(entry.get("last", "") or "")[:10]
                records["passiveDns"].append({
                    "hostname": hostname,
                    "address": address,
                    "recordType": record_type,
                    "first": first,
                    "last": last,
                })
                if hostname:
                    records["hostnames"].add(hostname)
    except (httpx.HTTPError, ValueError, TypeError):
        pass
    try:
        sub_response = client.get(
            f"https://otx.alienvault.com/api/v1/indicators/domain/{domain}/subdomains",
            headers={"User-Agent": UA},
            timeout=timeout,
        )
        if sub_response.status_code == 200:
            for sub in (sub_response.json().get("subdomains") or []):
                if isinstance(sub, str) and sub.strip():
                    records["hostnames"].add(sub.strip().lower().rstrip("."))
    except (httpx.HTTPError, ValueError, TypeError):
        pass
    return records


def commoncrawl(domain: str, client: httpx.Client, timeout: float = 8.0, limit: int = 150) -> list[str]:
    """URLs observed in the latest Common Crawl index."""
    try:
        collection_response = client.get("https://index.commoncrawl.org/collinfo.json", headers={"User-Agent": UA}, timeout=timeout)
        collection_response.raise_for_status()
        collections = collection_response.json()
        index_id = collections[0]["id"] if isinstance(collections, list) and collections else None
        if not index_id:
            return []
        response = client.get(
            f"https://index.commoncrawl.org/{index_id}-index",
            params={"url": f"*.{domain}/*", "output": "json", "filter": "status:200", "limit": str(limit)},
            headers={"User-Agent": UA},
            timeout=timeout,
        )
        if response.status_code != 200:
            return []
        urls: list[str] = []
        for line in response.text.splitlines():
            try:
                record = json.loads(line)
            except ValueError:
                continue
            url = record.get("url")
            if url:
                urls.append(url)
        return urls
    except (httpx.HTTPError, ValueError, TypeError, IndexError):
        return []


def ipinfo(ip: str, client: httpx.Client, timeout: float = 8.0) -> dict[str, Any]:
    """ASN / organization / geo metadata for an IP (free tier, low volume)."""
    try:
        response = client.get(f"https://ipinfo.io/{ip}/json", headers={"User-Agent": UA}, timeout=timeout)
        if response.status_code != 200:
            return {}
        payload = response.json()
        return {
            "ip": ip,
            "hostname": payload.get("hostname"),
            "org": payload.get("org"),
            "asn": (payload.get("org", "") or "").split(" ", 1)[0] if payload.get("org") else None,
            "city": payload.get("city"),
            "region": payload.get("region"),
            "country": payload.get("country"),
        }
    except (httpx.HTTPError, ValueError, TypeError):
        return {}


def github_repositories(domain: str, client: httpx.Client, token: str, timeout: float = 12.0) -> list[dict[str, Any]]:
    """GitHub repository search for the domain (requires a token for code search)."""
    records: list[dict[str, Any]] = []
    if not token:
        return records
    try:
        response = client.get(
            "https://api.github.com/search/code",
            params={"q": f'"{domain}"', "per_page": 10},
            headers={"User-Agent": UA, "Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
            timeout=timeout,
        )
        if response.status_code != 200:
            return records
        for item in response.json().get("items", []) or []:
            repository = item.get("repository", {}) or {}
            records.append({
                "repository": repository.get("full_name", ""),
                "url": item.get("html_url", ""),
                "path": item.get("path", ""),
                "repositoryUrl": repository.get("html_url", ""),
            })
    except (httpx.HTTPError, ValueError, TypeError):
        return records
    return records