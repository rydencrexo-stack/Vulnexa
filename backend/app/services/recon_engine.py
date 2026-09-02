from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from urllib.parse import urlparse

import httpx

UA = {"User-Agent": "Vulnexa-Recon/1.0 (authorized)"}


def normalize_domain(url: str) -> str:
    host = url.strip().lower()
    if "://" in host:
        parsed = urlparse(host)
        host = parsed.netloc or parsed.path
    host = host.split("/")[0].split(":")[0].strip()
    return host.rstrip(".")


def enum_subdomains(domain: str, limit: int = 80) -> list[str]:
    """Subdomain enumeration via HackerTarget hostsearch, with crt.sh fallback."""
    names: set[str] = {domain}
    try:
        resp = httpx.get(f"https://api.hackertarget.com/hostsearch/?q={domain}", timeout=20, headers=UA)
        if resp.status_code == 200:
            for line in resp.text.splitlines():
                host = line.split(",")[0].strip().lower()
                if host and host.endswith(domain) and "*" not in host:
                    names.add(host)
    except Exception:  # noqa: BLE001
        pass
    if len(names) <= 1:
        try:
            resp = httpx.get(f"https://crt.sh/?q=%25.{domain}&output=json", timeout=20, headers=UA)
            data = resp.json()
            for entry in data:
                for name in str(entry.get("name_value", "")).split("\n"):
                    name = name.strip().lower()
                    if name and name.endswith(domain) and "*" not in name:
                        names.add(name)
        except Exception:  # noqa: BLE001
            pass
    return sorted(names)[:limit]


def probe_host(host: str) -> dict[str, Any]:
    """Probe a host over HTTPS and return fingerprints."""
    try:
        with httpx.Client(timeout=8, follow_redirects=True, headers=UA) as client:
            resp = client.get(f"https://{host}/")
        tech: list[str] = []
        server = resp.headers.get("server")
        if server:
            tech.append(server)
        for header in ("x-powered-by", "x-generator"):
            value = resp.headers.get(header)
            if value:
                tech.append(value)
        title = None
        match = re.search(r"<title[^>]*>(.*?)</title>", resp.text, re.I | re.S)
        if match:
            title = match.group(1).strip()[:90]
        return {"hostname": host, "status": resp.status_code, "title": title, "tech": tech, "live": True}
    except Exception:  # noqa: BLE001
        return {"hostname": host, "status": None, "title": None, "tech": [], "live": False}


def probe_hosts(hosts: list[str], limit: int = 80) -> list[dict[str, Any]]:
    targets = list(dict.fromkeys(hosts))[:limit]
    with ThreadPoolExecutor(max_workers=min(12, max(1, len(targets)))) as pool:
        return list(pool.map(probe_host, targets))


def probe_url(target: str) -> dict[str, Any]:
    """Probe a single URL/domain and return whether it is active (live) plus fingerprints."""
    target = target.strip()
    if not target.startswith(("http://", "https://")):
        target = f"https://{target}/"
    try:
        with httpx.Client(timeout=10, follow_redirects=True, headers=UA) as client:
            resp = client.get(target)
        tech: list[str] = []
        server = resp.headers.get("server")
        if server:
            tech.append(server)
        for header in ("x-powered-by", "x-generator"):
            value = resp.headers.get(header)
            if value:
                tech.append(value)
        title = None
        match = re.search(r"<title[^>]*>(.*?)</title>", resp.text, re.I | re.S)
        if match:
            title = match.group(1).strip()[:90]
        return {"url": target, "status": resp.status_code, "title": title, "tech": tech, "live": True}
    except Exception:  # noqa: BLE001
        return {"url": target, "status": None, "title": None, "tech": [], "live": False}


def probe_urls(targets: list[str], limit: int = 80) -> list[dict[str, Any]]:
    unique_targets = list(dict.fromkeys(targets))[:limit]
    with ThreadPoolExecutor(max_workers=min(12, max(1, len(unique_targets)))) as pool:
        return list(pool.map(probe_url, unique_targets))


def wayback_urls(domain: str, limit: int = 300) -> list[str]:
    """Historical URLs via the Wayback Machine CDX index (wildcard over the domain + subdomains)."""
    try:
        resp = httpx.get(
            f"https://web.archive.org/cdx/search/cdx?url=*.{domain}/*&output=json&fl=original&collapse=urlkey&limit={limit}",
            timeout=45,
            headers=UA,
        )
        data = resp.json()
        if isinstance(data, list) and data:
            urls = [row[0] for row in data[1:] if isinstance(row, list) and row]
            return [u for u in urls if domain in u][:limit]
        return []
    except Exception:  # noqa: BLE001
        return []


def robots_paths(domain: str, limit: int = 25) -> list[str]:
    """Extract disallowed/allowed paths from robots.txt."""
    try:
        with httpx.Client(timeout=8, follow_redirects=True, headers=UA) as client:
            resp = client.get(f"https://{domain}/robots.txt")
        if resp.status_code != 200:
            return []
        paths = []
        for line in resp.text.splitlines():
            line = line.strip()
            if line.lower().startswith(("disallow:", "allow:")):
                path = line.split(":", 1)[1].strip()
                if path and not path.startswith("*") and len(path) > 1:
                    paths.append(path)
        return paths[:limit]
    except Exception:  # noqa: BLE001
        return []


def crawl_links(domain: str, limit: int = 30) -> list[str]:
    """Active discovery: extract in-page links from the homepage."""
    try:
        with httpx.Client(timeout=10, follow_redirects=True, headers=UA) as client:
            resp = client.get(f"https://{domain}/")
        if resp.status_code != 200:
            return []
        links: set[str] = set()
        for href in re.findall(r'<a[^>]+href=["\']([^"\']+)["\']', resp.text, re.I):
            href = href.strip()
            if href.startswith(("http://", "https://")):
                if domain in href:
                    links.add(href)
            elif href.startswith("/"):
                links.add(f"https://{domain}{href}")
        return sorted(links)[:limit]
    except Exception:  # noqa: BLE001
        return []
