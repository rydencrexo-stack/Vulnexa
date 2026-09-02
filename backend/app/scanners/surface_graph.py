"""Entity/relationship graph model for the Surface Finder.

Assets, relationships, observations and evidence are first-class. Every
relationship keeps its source, confidence and observation time so the UI can
answer "why is this connected?" instead of pretending all assets are related.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

ASSET_TYPES = {
    "organization",
    "domain",
    "subdomain",
    "ip",
    "certificate",
    "url",
    "repository",
    "technology",
    "cloud_provider",
    "documentation",
    "dns_record",
}

RELATIONSHIP_TYPES = {
    "owns",
    "subdomain_of",
    "resolves_to",
    "has_certificate",
    "san_of",
    "historical_url",
    "referenced_by",
    "hosted_by",
    "belongs_to_asn",
    "uses_technology",
    "cname_to",
    "documented_at",
}

CONFIDENCE_ORDER = {"low": 0, "medium": 1, "high": 2, "historical": 1}

SENSITIVE_HINTS = (
    "login", "auth", "admin", "api", "graphql", "swagger", "openapi", "redoc",
    "vpn", "portal", "jenkins", "kibana", "grafana", "nexus", "artifactory",
    "mail", "webmail", "ftp", "sftp", "git", "gitlab", "jira", "confluence",
    "aws", "azure", "gcp", "staging", "dev", "test", "internal", "console",
    "sso", "iam", "monitor", "prometheus", "zabbix", "sonarqube", "jupyter",
)

PROVIDER_HINTS: list[tuple[str, str]] = [
    ("amazonaws.com", "AWS"),
    ("cloudfront.net", "AWS"),
    ("elasticbeanstalk.com", "AWS"),
    ("awswaf.com", "AWS"),
    ("azurewebsites.net", "Azure"),
    ("azureedge.net", "Azure"),
    ("cloudapp.azure.com", "Azure"),
    ("trafficmanager.net", "Azure"),
    ("blob.core.windows.net", "Azure"),
    ("googleusercontent.com", "GCP"),
    ("appspot.com", "GCP"),
    ("cloudfunctions.net", "GCP"),
    ("run.app", "GCP"),
    ("cloudflare", "Cloudflare"),
    ("fastly.net", "Fastly"),
    ("vercel.app", "Vercel"),
    ("now.sh", "Vercel"),
    ("netlify.app", "Netlify"),
    ("firebaseapp.com", "Firebase"),
    ("github.io", "GitHub Pages"),
    ("gitlab.io", "GitLab Pages"),
    ("pages.dev", "Cloudflare Pages"),
    ("shopify.com", "Shopify"),
    ("wordpress.com", "WordPress.com"),
    ("bigrock", "BigRock"),
    ("godaddy", "GoDaddy"),
]

# Best-effort cloud ASN inference from known published prefixes (CIDRs) —
# treated as MEDIUM-confidence evidence, never as proof of ownership.
CLOUD_CIDRS: list[tuple[str, str]] = [
    ("AWS", "13.32.0.0/15"),
    ("AWS", "15.164.0.0/15"),
    ("AWS", "18.224.0.0/14"),
    ("AWS", "52.76.0.0/15"),
    ("AWS", "3.108.0.0/14"),
    ("AWS", "65.0.0.0/14"),
    ("AWS", "15.206.0.0/15"),
    ("Azure", "13.64.0.0/11"),
    ("Azure", "20.36.0.0/14"),
    ("Azure", "40.64.0.0/10"),
    ("GCP", "34.64.0.0/10"),
    ("GCP", "35.184.0.0/13"),
    ("GCP", "142.250.0.0/15"),
    ("Cloudflare", "104.16.0.0/13"),
    ("Cloudflare", "172.64.0.0/13"),
    ("Cloudflare", "141.101.64.0/18"),
    ("Fastly", "151.101.0.0/16"),
    ("Fastly", "199.232.0.0/16"),
    ("DigitalOcean", "104.236.128.0/17"),
    ("DigitalOcean", "159.65.0.0/16"),
]


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _norm_date(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.replace("Z", "").replace("z", "")
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(cleaned, fmt).replace(tzinfo=timezone.utc).strftime("%Y-%m-%d")
        except ValueError:
            continue
    match = cleaned[:10]
    if len(match) == 10 and match.count("-") == 2:
        return match
    return None


def registrable_domain(hostname: str) -> str:
    """Very small public-suffix-lite helper for scope decisions (2nd+1 labels)."""
    parts = hostname.rstrip(".").split(".")
    if len(parts) <= 2:
        return hostname.rstrip(".")
    return ".".join(parts[-2:])


def infer_provider(hostname: str, ip: str | None = None, cname: list[str] | None = None) -> str | None:
    needle = (hostname or "").lower()
    for hint, provider in PROVIDER_HINTS:
        if hint in needle:
            return provider
    if ip:
        import ipaddress

        try:
            address = ipaddress.ip_address(ip)
            if address.is_global:
                for provider, cidr in CLOUD_CIDRS:
                    if address in ipaddress.ip_network(cidr, strict=False):
                        return provider
        except ValueError:
            return None
    return None


def infer_cidr(ip: str) -> str | None:
    import ipaddress

    try:
        address = ipaddress.ip_address(ip)
        if not address.is_global:
            return None
        for _, cidr in CLOUD_CIDRS:
            network = ipaddress.ip_network(cidr, strict=False)
            if address in network:
                return str(network)
    except ValueError:
        return None
    return None


def asset_score(asset: dict[str, Any]) -> int:
    """0..100 prioritization score — a prioritization signal, NOT a vuln claim."""
    score = 10
    asset_type = asset.get("type", "subdomain")
    value = str(asset.get("value", "")).lower()
    if asset_type == "organization":
        return 0
    if asset_type == "url":
        sensitive = any(hint in value for hint in SENSITIVE_HINTS)
        return 25 if sensitive else 5
    if asset_type in {"documentation", "repository"}:
        return 30
    if asset_type == "certificate":
        return 15
    if asset_type == "cloud_provider":
        return 10
    if asset_type == "ip":
        base = 25
        if asset.get("metadata", {}).get("cloud"):
            base += 10
        return base

    # subdomain / domain
    sensitive = any(hint in value for hint in SENSITIVE_HINTS)
    if sensitive:
        score += 30
    sources = set(asset.get("sources", []))
    if len(sources) >= 3:
        score += 25
    elif len(sources) == 2:
        score += 15
    else:
        score += 5
    last_seen = asset.get("lastSeen")
    if last_seen:
        try:
            parsed = last_seen.replace("Z", "+00:00")
            if len(parsed) == 10:
                parsed = f"{parsed}T00:00:00+00:00"
            days_ago = (datetime.now(timezone.utc) - datetime.fromisoformat(parsed)).days
            if days_ago <= 90:
                score += 20
            elif days_ago <= 365:
                score += 10
        except ValueError:
            pass
    if asset.get("resolves", False):
        score += 20
    if asset.get("confidence") == "high":
        score += 10
    history = int(asset.get("urlCount", 0) or 0)
    if history:
        score += min(10, history)
    if asset.get("httpStatus") == 200:
        score += 5
    return max(0, min(100, score))


def priority_tier(asset: dict[str, Any]) -> str:
    score = asset.get("score", 0)
    if asset.get("historical"):
        return "historical"
    if score >= 70:
        return "high"
    if score >= 40:
        return "review"
    return "informational"


@dataclass
class Graph:
    assets: dict[str, dict[str, Any]] = field(default_factory=dict)
    relationships: list[dict[str, Any]] = field(default_factory=list)
    timeline: list[dict[str, Any]] = field(default_factory=list)
    _rel_keys: set[str] = field(default_factory=set)

    def asset_id(self, asset_type: str, value: str) -> str:
        return f"{asset_type}:{value}"

    def get_or_create(
        self,
        asset_type: str,
        value: str,
        *,
        sources: list[str] | None = None,
        scope: str = "needs_review",
        confidence: str = "medium",
        first_seen: str | None = None,
        last_seen: str | None = None,
        metadata: dict[str, Any] | None = None,
        evidence: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        value = value.strip().lower().rstrip(".")
        if not value:
            raise ValueError("empty asset value")
        asset_id = self.asset_id(asset_type, value)
        existing = self.assets.get(asset_id)
        if existing:
            for source in sources or []:
                if source not in existing["sources"]:
                    existing["sources"].append(source)
            if first_seen and (not existing.get("firstSeen") or first_seen < existing["firstSeen"]):
                existing["firstSeen"] = first_seen
            if last_seen and (not existing.get("lastSeen") or last_seen > existing["lastSeen"]):
                existing["lastSeen"] = last_seen
            if metadata:
                for key, value_meta in metadata.items():
                    if value_meta not in (None, "", [], {}):
                        existing.setdefault("metadata", {})[key] = value_meta
            if evidence:
                existing.setdefault("evidence", []).extend(evidence)
            existing["confidence"] = self._merge_confidence(existing.get("confidence", "low"), confidence)
            if scope and existing.get("scope") in {"needs_review", "unknown"}:
                existing["scope"] = scope
            return existing
        record: dict[str, Any] = {
            "id": asset_id,
            "type": asset_type,
            "value": value,
            "scope": scope,
            "confidence": confidence,
            "firstSeen": first_seen,
            "lastSeen": last_seen,
            "sources": list(dict.fromkeys(sources or [])),
            "metadata": metadata or {},
            "evidence": evidence or [],
            "score": 0,
            "priority": "informational",
            "historical": False,
        }
        self.assets[asset_id] = record
        return record

    def _merge_confidence(self, current: str, incoming: str) -> str:
        order = {"low": 0, "medium": 1, "high": 2}
        return incoming if order.get(incoming, 1) > order.get(current, 1) else current

    def add_relationship(
        self,
        source: dict[str, Any],
        target: dict[str, Any],
        rel_type: str,
        *,
        sources: list[str] | None = None,
        confidence: str = "medium",
        observed_at: str | None = None,
        evidence: list[dict[str, Any]] | None = None,
    ) -> None:
        key = f"{source['id']}|{rel_type}|{target['id']}"
        if key in self._rel_keys:
            return
        self._rel_keys.add(key)
        self.relationships.append({
            "source": source["id"],
            "target": target["id"],
            "type": rel_type,
            "sources": list(dict.fromkeys(sources or [])),
            "confidence": confidence,
            "observedAt": observed_at or _now(),
            "evidence": evidence or [],
        })

    def add_timeline(self, date: str | None, event: str, asset_id: str, source: str) -> None:
        if not date:
            return
        self.timeline.append({
            "date": date,
            "event": event,
            "asset": asset_id,
            "source": source,
        })

    def finalize(self, root_domain: str) -> dict[str, Any]:
        for asset in self.assets.values():
            asset["score"] = asset_score(asset)
            asset["priority"] = priority_tier(asset)
            asset["historical"] = bool(
                asset.get("historical")
                or (
                    not asset.get("resolves", False)
                    and asset.get("type") in {"subdomain", "domain"}
                    and asset.get("sources") == ["wayback"]
                )
            )
        return self.serialize(root_domain)

    def serialize(self, root_domain: str) -> dict[str, Any]:
        return {
            "rootDomain": root_domain,
            "assets": sorted(self.assets.values(), key=lambda asset: (-asset.get("score", 0), asset["value"])),
            "relationships": self.relationships,
            "timeline": sorted(self.timeline, key=lambda item: item["date"])[-600:],
        }


def build_evidence(source: str, detail: str) -> dict[str, Any]:
    return {"source": source, "detail": detail, "observedAt": _now()}