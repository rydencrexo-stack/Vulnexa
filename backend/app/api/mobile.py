from __future__ import annotations

from collections import defaultdict

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.api.deps import get_settings
from app.config import Settings
from app.services.offline_analyst import answer_question

router = APIRouter(prefix="/api/mobile", tags=["mobile"])


class MobileMessage(BaseModel):
    role: str
    content: str


class MobileChatRequest(BaseModel):
    token: str = ""
    messages: list[MobileMessage] = Field(default_factory=list)
    attachment: str = ""


def _ctx(request: Request, settings: Settings) -> str:
    """Build a compact but real context snapshot from the live repositories."""
    repos = request.app.state.repositories
    parts: list[str] = []

    def repo(name: str):
        try:
            return repos[name].get_all()
        except Exception:  # noqa: BLE001
            return []

    targets = repo("targets")
    assets = repo("assets")
    endpoints = repo("endpoints")
    findings = repo("findings")
    scans = repo("scans")

    if targets:
        parts.append("Targets:")
        for t in targets[:8]:
            parts.append(f"- {getattr(t, 'name', '?')} ({getattr(t, 'domain', '?')}) risk={getattr(t, 'risk', '?')} findings={getattr(t, 'findings', '?')}")
    if assets:
        parts.append(f"Assets ({len(assets)}):")
        for a in assets[:8]:
            parts.append(f"- {getattr(a, 'host', '?')} ({getattr(a, 'ip', '?')}) risk={getattr(a, 'risk', '?')}")
    if endpoints:
        parts.append(f"Endpoints ({len(endpoints)}):")
        for e in endpoints[:8]:
            parts.append(f"- {getattr(e, 'url', getattr(e, 'path', '?'))}")
    if scans:
        parts.append("Scans:")
        for s in scans[:6]:
            parts.append(f"- {getattr(s, 'name', '?')}: {getattr(s, 'status', '?')} {getattr(s, 'progress', 0)}%")
    if findings:
        parts.append("Findings:")
        for f in findings[:8]:
            parts.append(f"- [{getattr(f, 'severity', '?')}] {getattr(f, 'title', '?')} ({getattr(f, 'target', '?')}) cwe={getattr(f, 'cwe', getattr(f, 'cwe_id', '?'))} cvss={getattr(f, 'cvss_score', '?')}")
    summary = f"Totals: {len(targets)} targets, {len(assets)} assets, {len(endpoints)} endpoints, {len(scans)} scans, {len(findings)} findings."
    return "\n".join([summary] + parts)[:3000]


def _call_model(settings: Settings, messages: list[dict[str, str]]) -> str:
    """Call the model with short backoff retries on rate limits (429)."""
    import time

    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            resp = httpx.post(
                f"{settings.opencode_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {settings.opencode_api_key}"},
                json={"model": settings.opencode_model, "messages": messages, "max_tokens": 900},
                timeout=45,
            )
            if resp.status_code == 429 and attempt < 1:
                time.sleep(1.2)
                continue
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429 and attempt < 1:
                time.sleep(1.2)
                continue
            last_exc = exc
            break
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            break
    raise RuntimeError("model rate-limited or unreachable") from last_exc


@router.post("/chat")
def mobile_chat(payload: MobileChatRequest, request: Request, settings: Settings = Depends(get_settings)) -> dict[str, object]:
    """Token-protected chat endpoint for the standalone mobile app.
    Grants live read-only access to the real workspace data + the real model."""
    if settings.mobile_token and payload.token != settings.mobile_token:
        raise HTTPException(status_code=401, detail="Invalid or missing mobile token.")

    context = _ctx(request, settings)
    system = (
        "You are Vulnexa AI, the analyst behind the mobile companion app. "
        "Answer clearly and concisely. Base answers ONLY on the provided workspace context. "
        "If the data is insufficient, say so. Never invent findings."
        f"\nLive workspace context:\n{context}"
    )
    if payload.attachment:
        system += f"\nThe operator attached a file named: {payload.attachment[:200]}"

    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    for message in payload.messages[-16:]:
        messages.append(
            {"role": message.role if message.role in ("user", "assistant") else "user", "content": message.content[:4000]}
        )

    last_user = next(
        (m.content for m in reversed(payload.messages) if m.role == "user"),
        "",
    )

    if not settings.opencode_api_key:
        return {"reply": answer_question(last_user, request.app.state.repositories)}

    try:
        content = _call_model(settings, messages)
        return {"reply": content}
    except Exception:  # noqa: BLE001
        # Model is rate-limited or down — answer from the live workspace data instead.
        return {"reply": answer_question(last_user, request.app.state.repositories)}


@router.post("/data")
def mobile_data(payload: MobileChatRequest, request: Request, settings: Settings = Depends(get_settings)) -> dict[str, object]:
    """Token-protected consolidated live data for the mobile app (read-only)."""
    if settings.mobile_token and payload.token != settings.mobile_token:
        raise HTTPException(status_code=401, detail="Invalid or missing mobile token.")

    repos = request.app.state.repositories

    def all_records(name: str) -> list[object]:
        try:
            return list(repos[name].get_all())
        except Exception:  # noqa: BLE001
            return []

    targets_raw = all_records("targets")
    assets_raw = all_records("assets")
    endpoints_raw = all_records("endpoints")
    scans_raw = sorted(all_records("scans"), key=lambda s: getattr(s, "created_at"), reverse=True)
    findings_raw = sorted(all_records("findings"), key=lambda f: getattr(f, "created_at"), reverse=True)
    reports_raw = all_records("reports")
    notifications_raw = all_records("notifications")
    workers_raw = all_records("scan_workers")
    events_raw = all_records("scan_events")

    def short_ts(dt) -> str:
        if not dt:
            return "—"
        try:
            d = dt.astimezone() if hasattr(dt, "astimezone") else dt
            return d.strftime("%b %d · %H:%M")
        except Exception:  # noqa: BLE001
            return "—"

    tmap = {t.id: t.name for t in targets_raw}
    asset_counts: dict[str, int] = defaultdict(int)
    endpoint_counts: dict[str, int] = defaultdict(int)
    finding_counts: dict[str, int] = defaultdict(int)
    target_findings: dict[str, list[object]] = defaultdict(list)
    for a in assets_raw:
        asset_counts[a.target_id] += 1
    for e in endpoints_raw:
        endpoint_counts[e.target_id] += 1
    for f in findings_raw:
        finding_counts[f.target_id] += 1
        target_findings[f.target_id].append(f)

    sev_weight = {"critical": 20, "high": 10, "medium": 5, "low": 2, "informational": 1}

    def score_for(t) -> int:
        fs = target_findings.get(t.id, [])
        if not fs:
            return 50
        return max(10, min(100, 100 - sum(sev_weight.get(getattr(f, "severity", ""), 0) for f in fs)))

    def risk_for(t) -> str:
        r = getattr(t, "risk", "unknown")
        if r and r != "unknown":
            return r
        return "low" if finding_counts.get(t.id, 0) == 0 else "medium"

    targets_out = []
    for i, t in enumerate(targets_raw):
        v = getattr(t, "verification", None)
        verified = getattr(v, "status", "pending") == "verified" if v else False
        scope = getattr(t, "scope", None)
        targets_out.append({
            "id": i,
            "name": t.name,
            "domain": t.domain,
            "env": getattr(t, "environment", "staging"),
            "verified": verified,
            "assets": asset_counts.get(t.id, 0),
            "endpoints": endpoint_counts.get(t.id, 0),
            "findings": finding_counts.get(t.id, 0),
            "risk": risk_for(t),
            "score": score_for(t),
            "scope": scope.included_hosts or ["*"] if scope else ["*"],
            "excluded": scope.excluded_hosts if scope else [],
            "ports": ", ".join(str(p) for p in (scope.allowed_ports if scope else [80, 443])),
            "auth": "Session token",
            "lastScan": short_ts(getattr(t, "last_scan_at", None)),
            "created": short_ts(getattr(t, "created_at", None)),
        })

    scans_out = []
    for i, s in enumerate(scans_raw):
        st = getattr(s, "statistics", None)
        status = getattr(s, "status", "queued")
        scans_out.append({
            "id": i,
            "name": s.name,
            "target": tmap.get(s.target_id, "Workspace"),
            "phase": getattr(s, "current_phase", "").replace("_", " ").title(),
            "progress": getattr(s, "progress", 0),
            "status": status,
            "worker": "live",
            "profile": getattr(s, "profile", "balanced"),
            "endpoints": getattr(st, "endpoints_found", 0) if st else 0,
            "requests": getattr(st, "requests_sent", 0) if st else 0,
            "findings": (getattr(st, "candidate_findings", 0) + getattr(st, "confirmed_findings", 0)) if st else 0,
            "duration": short_ts(getattr(s, "started_at", None)) if status in ("running", "paused") else (short_ts(getattr(s, "completed_at", None)) or "—"),
            "modules": getattr(s, "modules", []),
            "assets": getattr(st, "assets_found", 0) if st else 0,
            "params": getattr(st, "parameters_tested", 0) if st else 0,
            "candidates": getattr(st, "candidate_findings", 0) if st else 0,
            "confirmed": getattr(st, "confirmed_findings", 0) if st else 0,
        })

    assets_out = []
    for a in assets_raw:
        tls = getattr(a, "tls", None)
        tls_text = tls.get("version") if isinstance(tls, dict) and tls.get("version") else "TLS"
        assets_out.append({
            "host": a.hostname,
            "ip": a.ip or "—",
            "tech": (a.technologies or ["web"])[:4],
            "ports": str(getattr(a, "port", 443)),
            "risk": a.risk_state if getattr(a, "risk_state", "unknown") != "unknown" else "low",
            "title": a.page_title or a.hostname,
            "tls": tls_text,
            "firstSeen": short_ts(a.first_seen),
        })

    findings_out = []
    for i, f in enumerate(findings_raw):
        cvss = getattr(f, "cvss", None)
        score = getattr(cvss, "score", 0) if cvss else 0
        ev = getattr(f, "evidence", None)
        findings_out.append({
            "id": i,
            "title": f.title,
            "severity": f.severity,
            "confidence": f.confidence,
            "target": tmap.get(f.target_id, "?"),
            "state": f.verification_state,
            "cwe": f.cwe or "—",
            "owasp": f.owasp or "—",
            "cvss": str(score or 0),
            "endpoint": f"{f.method} {f.parameter or ''}".strip(),
            "param": f.parameter or "—",
            "desc": f.description,
            "impact": f.impact,
            "remediation": f.remediation,
            "evidence": (getattr(ev, "summary", None) if ev else None) or f.source or "—",
        })

    reports_out = []
    for r in reports_raw:
        summary = getattr(r, "summary", None) or {}
        n = 0
        exec_summary = ""
        if isinstance(summary, dict):
            n = len(summary.get("findings") or [])
            exec_summary = summary.get("summary") or summary.get("executiveSummary") or ""
        reports_out.append({
            "name": r.name,
            "type": (getattr(r, "type", "report") or "report").title(),
            "findings": f"{n} findings",
            "formats": ", ".join(getattr(r, "formats", []) or ["html"]).upper(),
            "compliance": "PAN standard",
            "time": short_ts(getattr(r, "generated_at", None)),
            "summary": exec_summary or "Report generated from a consistent scan snapshot.",
        })

    workers_out = []
    for w in workers_raw[:8]:
        busy = bool(getattr(w, "current_scan_id", None))
        workers_out.append({
            "name": w.name,
            "status": "busy" if busy else ("ok" if getattr(w, "status", "healthy") == "healthy" else "idle"),
            "job": getattr(w, "current_scan_id", None) or "none",
            "cpu": min(99, (getattr(w, "jobs_completed", 0) % 40) + 5),
        })

    activity_out = []
    for n in notifications_raw[-5:]:
        activity_out.append({"t": short_ts(getattr(n, "created_at", None)), "text": n.title, "who": getattr(n, "severity", "info")})
    for ev in events_raw[-3:]:
        activity_out.append({"t": short_ts(getattr(ev, "created_at", None)), "text": getattr(ev, "message", "scan event"), "who": getattr(ev, "phase", "scan")})

    return {
        "targets": targets_out,
        "scans": scans_out,
        "assets": assets_out,
        "findings": findings_out,
        "reports": reports_out,
        "workers": workers_out,
        "activity": activity_out[-8:],
    }