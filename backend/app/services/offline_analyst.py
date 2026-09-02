from __future__ import annotations

"""Deterministic offline analyst.

Answers security-ops chat questions straight from live workspace data —
no model required. Used when the external model is rate-limited or down,
so Vulnexa AI keeps working everywhere (web + mobile).
"""

import re
from collections import defaultdict

_CWE_KB: dict[str, tuple[str, str, str]] = {
    "79": ("Cross-site scripting (XSS)", "Untrusted input reaches an executable browser context without safe encoding.", "Encode output for the exact context (HTML, attribute, JS, URL). Use framework escaping plus a strict CSP."),
    "89": ("SQL injection", "Untrusted input changes the structure of a database query.", "Use parameterized queries / ORM bindings. Never concatenate input into SQL."),
    "200": ("Exposure of sensitive information", "Sensitive data is exposed to unauthorized actors (introspection, debug pages, verbose errors).", "Disable introspection and debug output in production; minimize error detail."),
    "306": ("Missing authentication for critical function", "A sensitive function can be reached without authentication.", "Enforce authentication at the route/middleware layer for every sensitive action."),
    "307": ("Improper restriction of excessive authentication attempts", "Login/OTP endpoints lack throttling or lockout.", "Add rate limiting, account lockout, and monitoring on credential endpoints."),
    "352": ("Cross-site request forgery (CSRF)", "State-changing requests can be forced from another origin.", "Use CSRF tokens or SameSite cookies; validate Origin/Referer on mutations."),
    "639": ("IDOR — broken object-level authorization", "An object reference can be accessed without an authorization check.", "Check ownership/roles server-side on every object access; prefer opaque identifiers."),
    "693": ("Missing protection mechanism (e.g., CSP)", "A defensive control is absent.", "Deploy the missing control (e.g., Content-Security-Policy) and test compatibility."),
    "601": ("Open redirect", "A redirect destination is attacker-controllable.", "Validate against an allowlist; reject or warn on external destinations."),
    "918": ("Server-side request forgery (SSRF)", "The server fetches an attacker-selected destination.", "Allowlist destinations, block private/metadata ranges, revalidate redirects."),
}

_SEV_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "informational": 4}

_NOTE = "\n\n---\n*Vulnexa AI is answering from your live workspace data (the language model is paused on weekly quota).*"


def _fmt_pct(x: float) -> str:
    return f"{int(x * 100)}%"


def _safe_get(repos, name: str) -> list:
    try:
        return list(repos[name].get_all())
    except Exception:  # noqa: BLE001
        return []


def _gather(repos):
    targets = _safe_get(repos, "targets")
    assets = _safe_get(repos, "assets")
    endpoints = _safe_get(repos, "endpoints")
    scans = sorted(_safe_get(repos, "scans"), key=lambda s: getattr(s, "created_at"), reverse=True)
    findings = _safe_get(repos, "findings")
    workers = _safe_get(repos, "scan_workers")
    tmap = {t.id: t.name for t in targets}
    return targets, assets, endpoints, scans, findings, workers, tmap


def _answer_overview(targets, assets, endpoints, scans, findings, workers, tmap) -> str:
    running = [s for s in scans if getattr(s, "status", "") == "running"]
    queued = [s for s in scans if getattr(s, "status", "") == "queued"]
    completed = [s for s in scans if getattr(s, "status", "") == "completed"]
    sev = defaultdict(int)
    for f in findings:
        sev[getattr(f, "severity", "low")] += 1
    busy = [w for w in workers if getattr(w, "current_scan_id", None)]
    risk_targets = sorted(targets, key=lambda t: (sev.get("critical", 0) if False else 0), reverse=True)
    top = max(targets, key=lambda t: sum(1 for f in findings if f.target_id == t.id), default=None)

    lines = [
        "## Attack surface overview",
        "",
        f"- **Targets:** {len(targets)}",
        f"- **Assets:** {len(assets)}",
        f"- **Endpoints:** {len(endpoints)}",
        f"- **Scans:** {len(scans)} total — {len(running)} running, {len(queued)} queued, {len(completed)} completed",
        f"- **Findings:** {len(findings)} total — {sev.get('critical', 0)} critical, {sev.get('high', 0)} high, {sev.get('medium', 0)} medium, {sev.get('low', 0)} low",
        f"- **Workers:** {len(workers)} registered, {len(busy)} busy",
    ]
    if running:
        lines.append("\n### Scans running right now")
        for s in running[:5]:
            lines.append(f"- {getattr(s, 'name', '?')} — {getattr(s, 'current_phase', '').replace('_', ' ')} · {getattr(s, 'progress', 0)}%")
    if top:
        lines.append(f"\n**Highest-exposure target:** {top.name} ({getattr(top, 'domain', '?')})")
    return "\n".join(lines) + _NOTE


def _answer_priorities(findings, tmap) -> str:
    ranked = sorted(
        findings,
        key=lambda f: (_SEV_ORDER.get(getattr(f, "severity", "low"), 9), -getattr(f, "confidence", 0)),
    )
    if not ranked:
        return "No findings recorded yet — nothing to prioritize. Run a scan to populate the queue."
    lines = ["## Prioritized findings (severity, then confidence)", ""]
    for i, f in enumerate(ranked[:8], 1):
        cvss = getattr(getattr(f, "cvss", None), "score", None) or 0
        lines.append(
            f"{i}. **[{getattr(f, 'severity', '?').upper()}] {f.title}** — {tmap.get(f.target_id, '?')} "
            f"· CVSS {cvss} · {getattr(f, 'confidence', 0)}% confidence · state: {getattr(f, 'verification_state', '?')}"
        )
    return "\n".join(lines) + _NOTE


def _answer_findings(findings, tmap) -> str:
    sev = defaultdict(int)
    for f in findings:
        sev[getattr(f, "severity", "low")] += 1
    lines = [
        "## Findings breakdown",
        "",
        f"critical: {sev.get('critical', 0)} · high: {sev.get('high', 0)} · medium: {sev.get('medium', 0)} · low: {sev.get('low', 0)}",
        "",
    ]
    for f in sorted(findings, key=lambda f: _SEV_ORDER.get(getattr(f, "severity", "low"), 9))[:8]:
        lines.append(f"- **[{getattr(f, 'severity', '?').upper()}] {f.title}** ({tmap.get(f.target_id, '?')}) — CWE-{getattr(f, 'cwe', '')} · {getattr(f, 'confidence', 0)}%")
    if not findings:
        lines.append("No findings recorded yet.")
    return "\n".join(lines) + _NOTE


def _answer_scans(scans, tmap) -> str:
    if not scans:
        return "No scans recorded yet."
    lines = ["## Scans", ""]
    for s in scans[:8]:
        lines.append(
            f"- **{getattr(s, 'name', '?')}** ({tmap.get(getattr(s, 'target_id', ''), '?')}) — "
            f"{getattr(s, 'status', '?')} · {getattr(s, 'progress', 0)}% · {getattr(s, 'current_phase', '').replace('_', ' ')}"
        )
    return "\n".join(lines) + _NOTE


def _answer_targets(targets, assets, endpoints, findings) -> str:
    if not targets:
        return "No targets recorded yet."
    lines = ["## Targets", ""]
    counts = defaultdict(int)
    for a in assets:
        counts[getattr(a, "target_id", "")] += 1
    for t in targets:
        n = sum(1 for f in findings if f.target_id == t.id)
        lines.append(f"- **{t.name}** ({t.domain}) — {counts.get(t.id, 0)} assets · {n} findings · risk: {getattr(t, 'risk', 'unknown')}")
    return "\n".join(lines) + _NOTE


def _answer_assets(assets) -> str:
    if not assets:
        return "No assets recorded yet."
    lines = ["## Assets", ""]
    for a in assets[:10]:
        lines.append(f"- {a.hostname} — {getattr(a, 'page_title', '') or 'web'} · risk: {getattr(a, 'risk_state', 'unknown')}")
    return "\n".join(lines) + _NOTE


def _answer_workers(workers) -> str:
    if not workers:
        return "No scan workers registered."
    lines = ["## Scan workers", ""]
    for w in workers[:10]:
        busy = "busy" if getattr(w, "current_scan_id", None) else getattr(w, "status", "healthy")
        lines.append(f"- **{w.name}** — {busy} · {getattr(w, 'jobs_completed', 0)} jobs completed")
    return "\n".join(lines) + _NOTE


def _answer_cwe(cwe_id: str) -> str:
    entry = _CWE_KB.get(cwe_id)
    if not entry:
        return f"I don't have a knowledge entry for CWE-{cwe_id} yet. Ask for the finding's full record instead."
    title, desc, fix = entry
    return f"## CWE-{cwe_id} — {title}\n\n{desc}\n\n**Remediation:** {fix}" + _NOTE


def _answer_help() -> str:
    return (
        "## I can answer from your live workspace data\n\n"
        "Try asking:\n"
        "- \"Summarize my attack surface\"\n"
        "- \"Prioritize my open findings\"\n"
        "- \"List all findings / scans / targets / assets / workers\"\n"
        "- \"What is CWE-639?\"\n"
        "- On mobile, type **/** for data commands."
    ) + _NOTE


def answer_question(question: str, repos) -> str:
    targets, assets, endpoints, scans, findings, workers, tmap = _gather(repos)
    q = (question or "").strip()
    ql = q.lower()
    m = re.search(r"cwe[- ]?(\d{1,4})", ql)
    if m:
        return _answer_cwe(m.group(1))
    if any(k in ql for k in ("summar", "overview", "attack surface", "status", "how is", "how are", "what's the state", "inventory")):
        return _answer_overview(targets, assets, endpoints, scans, findings, workers, tmap)
    if any(k in ql for k in ("priorit", "top ", "most important", "biggest", "risk", "urgent")):
        return _answer_priorities(findings, tmap)
    if any(k in ql for k in ("finding", "vulnerab", "bug", "cve")):
        return _answer_findings(findings, tmap)
    if any(k in ql for k in ("scan", "progress", "phase")):
        return _answer_scans(scans, tmap)
    if any(k in ql for k in ("worker", "agent", "cpu")):
        return _answer_workers(workers)
    if any(k in ql for k in ("asset", "host", "subdomain")):
        return _answer_assets(assets)
    if any(k in ql for k in ("target", "workspace", "scope")):
        return _answer_targets(targets, assets, endpoints, findings)
    if any(k in ql for k in ("help", "what can you", "capabilit")):
        return _answer_help()
    # Default: give a live overview so the answer is still useful.
    return _answer_overview(targets, assets, endpoints, scans, findings, workers, tmap)
