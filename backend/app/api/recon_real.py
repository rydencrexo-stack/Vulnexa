from __future__ import annotations

from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser
from app.services import recon_engine

router = APIRouter(prefix="/api/recon/modules", tags=["recon"])


class ReconTarget(BaseModel):
    url: str = Field(min_length=3, max_length=300)


class LiveHostRequest(BaseModel):
    url: str = Field(default="", max_length=2000)
    urls: list[str] = Field(default_factory=list)


@router.post("/subdomains")
def module_subdomains(payload: ReconTarget, user: CurrentUser) -> dict[str, object]:
    domain = recon_engine.normalize_domain(payload.url)
    subs = recon_engine.enum_subdomains(domain)
    return {
        "target": domain,
        "items": [{"hostname": sub, "live": False, "tech": []} for sub in subs],
        "summary": f"{len(subs)} subdomains (HackerTarget + crt.sh)",
    }


@router.post("/live-hosts")
def module_live_hosts(payload: LiveHostRequest, user: CurrentUser) -> dict[str, object]:
    targets = payload.urls or ([payload.url] if payload.url else [])
    targets = [t.strip() for t in targets if t.strip()]
    if not targets:
        return {"target": "", "items": [], "summary": "0 hosts probed"}
    items = recon_engine.probe_urls(targets)
    return {"target": targets[0], "items": items, "summary": f"{len(items)} hosts probed · {sum(1 for i in items if i.get('live'))} active"}


@router.post("/url-discovery")
def module_url_discovery(payload: ReconTarget, user: CurrentUser) -> dict[str, object]:
    domain = recon_engine.normalize_domain(payload.url)
    urls = recon_engine.wayback_urls(domain)
    links = recon_engine.crawl_links(domain)
    paths = recon_engine.robots_paths(domain)
    items = list(urls) + list(links)
    for path in paths:
        items.append(f"https://{domain}{path}")
    items = list(dict.fromkeys(items))
    return {"target": domain, "items": items, "summary": f"{len(items)} URLs (Wayback + active crawl + robots.txt)"}


@router.post("/web-archive")
def module_web_archive(payload: ReconTarget, user: CurrentUser) -> dict[str, object]:
    domain = recon_engine.normalize_domain(payload.url)
    urls = recon_engine.wayback_urls(domain)
    return {"target": domain, "items": urls, "summary": f"{len(urls)} historical URLs (Wayback CDX)"}


@router.post("/ports")
def module_ports(payload: ReconTarget, user: CurrentUser) -> dict[str, object]:
    domain = recon_engine.normalize_domain(payload.url)
    # Minimal, safe TCP service check against the host itself.
    import socket

    from app.services.recon_engine import probe_host

    info = probe_host(domain)
    return {"target": domain, "items": [{"port": 443, "service": "https", "state": "open" if info.get("live") else "closed"}], "summary": f"probed {domain} (443/https)"}


@router.post("/technologies")
def module_technologies(payload: ReconTarget, user: CurrentUser) -> dict[str, object]:
    from app.services.recon_engine import probe_host

    domain = recon_engine.normalize_domain(payload.url)
    hosts = [domain, f"www.{domain}"] + recon_engine.enum_subdomains(domain)
    seen: set[str] = set()
    hosts = [h for h in hosts if not (h in seen or seen.add(h))][:20]
    items: list[dict[str, object]] = []
    total = 0
    for host in hosts:
        info = probe_host(host)
        techs = info.get("tech") or []
        if techs:
            items.append({"host": host, "status": info.get("status"), "title": info.get("title"), "techs": techs})
            total += len(techs)
    return {"target": domain, "items": items, "summary": f"{len(items)} hosts fingerprinted · {total} technologies observed"}
