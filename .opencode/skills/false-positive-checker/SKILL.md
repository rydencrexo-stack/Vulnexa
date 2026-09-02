---
name: false-positive-checker
description: Gate every finding before you waste a report. Detects false positives including INTENTIONAL/BY-DESIGN behavior (default headers, baseline configs, documented features, test/honeypot data, expected framework output), kills noise (weak evidence, missing preconditions, no real impact, single-technique, self-inflicted), and keeps ONLY the important, validated findings. Findings MUST pass every gate to survive. Run at VALIDATE time on every candidate. Trigger keywords: false positive, FP, is this a bug, by design, intentional, kill finding, validate finding, keep only important.
---

# False-Positive Checker — The Gate Every Finding Must Pass

Your job is to be the FINAL FILTER. Anything that fails any gate below is a false positive or an intentional behavior — drop it. Only findings that pass **every** gate survive to be reported. Do not be lenient. The target's triager WILL apply these same gates; beat them to it.

## THE GATE (every finding must pass ALL 7 — in order, one NO = kill)

1. **REAL-IMPACT GATE** — Can an attacker do this RIGHT NOW against a real user who took NO unusual actions, causing real harm (money stolen, PII leaked, account takeover, code execution, service down)? If the impact requires a chain you haven't proven, or the harm is nonexistent → **KILL**.
2. **INTENTIONAL / BY-DESIGN GATE** — Is this expected, documented, or baseline behavior? If YES → **KILL** (see intentional list below). This is the one most hunters miss.
3. **EVIDENCE GATE** — Confirmed by ≥2 distinct techniques (time-based + boolean SQLi; reflected + OOB callback; error + differential)? Single observation, non-deterministic result, or "it seems" → **KILL**. Reproduce cleanly from scratch before passing.
4. **EXPLOITABILITY GATE** — No missing preconditions (wrong auth level, unusual user action required, race that doesn't reproduce, requires victim cooperation beyond a normal click)? Too many "could/can/would/may" → **KILL**.
5. **SCOPE GATE** — In-scope asset, authorized target, matches program rules (no DoS-only, no automation-only, allowed asset types)? Not in scope or on excluded path → **KILL**.
6. **DATA GATE** — Data is NOT already public, NOT intentionally shared, NOT test/sandbox/staging data, NOT your own data you fed in? Public/test/self-inflicted → **KILL**.
7. **SEVERITY GATE** — After adjustment, is this genuinely report-worthy (not Info/Low noise: header-missing with no exploit, self-XSS, open-redirect-alone, rate-limit alone, CORS without creds, non-state-changing CSRF)? → If it's noise, **KILL**.

## INTENTIONAL / BY-DESIGN list (Gate 2 — check every candidate)
- Default/baseline framework behavior: default headers (X-Powered-By, Server, version banners), default cookie flags missing with no exploit path, default CSP, default error pages, default framework endpoints.
- Documented features: rate limits that exist (even if weak), intended preview/report/view-as functionality, public statistics endpoints, "known issue" pages, documented API limits.
- Config-by-design: caching on public content, redirects that are the product, verbose errors only for logged-in admins, staging/sandbox/test environments, honeypots, canary tokens, deliberately exposed decoy endpoints.
- Expected product behavior: password rotation requirements, session expiry, logout behavior, pagination limits, file size limits.
- Data the vendor intentionally exposes: public profiles, public order tracking, marketing assets, license/version metadata.
- If a reviewer would answer "that's how it works / that's normal / that's default" → it is INTENTIONAL. Kill it.

## FALSE-POSITIVE CATEGORIES (Gate 3-6 killers)
| Category | Why it dies | Example |
|---|---|---|
| Single-technique | Not reproducible / confabulated | One time-based delay that doesn't repeat |
| Non-deterministic | Can't be rerun | "Sometimes 500s" |
| Missing auth precondition | Attacker must already be admin | Admin-only endpoint "unauth" but gated upstream |
| Victim cooperation | Requires unusual action | Clicking an attacker-controlled file + approving |
| Already-public data | No disclosure | User data visible in incognito web UI |
| Test/honeypot data | Not real | Fake users, lorem-ipsum records, canary tokens |
| Self-inflicted | You caused it | You uploaded the malicious file, you fed the data |
| Ambiguous evidence | Confused cause | "Response changed" without payload control |
| Baseline config | Default, not a bug | Weak TLS on non-sensitive endpoint, SPF without strict policy |
| Not exploitable | No reachable sink | "Could theoretically..." |
| Non-state-changing CSRF | No impact | CSRF on a GET-only informational endpoint |
| CORS without creds | ACAO:* can't carry creds; ACAC alone proves nothing | Reflected origin, no credentials mode |
| Open redirect alone | Phishing potential isn't proof | Needs OAuth/SSO chain to be a finding |
| Rate-limit "bypass" via rotation | Still limited per-IP, no lockout context | IP rotate ≠ account lockout bypass |

## CONDITIONALLY-VALID (valid ONLY when the chain is proven — otherwise kill)
- Open redirect → VALID only as OAuth redirect_uri code theft / credential phishing with a real page.
- SSRF with DNS-only callback → VALID only if internal access or data exfil is shown.
- Verbose error → VALID only if it leaks secrets/keys/credentials or drives a working injection.
- Weak cookie flags → VALID only with a working session-hijack/XSS path.
- Token in URL → VALID only if a referer/leak path leads to compromise.
- CORS misconfig → VALID only credentialed read of sensitive data demonstrably works in a real browser.
- Info-disclosure endpoint → VALID only if it exposes secrets/PII/keys, not just existence.

## WORKFLOW for a batch of findings
1. List every candidate finding with its raw evidence.
2. Run each through the 7 gates IN ORDER. First NO = killed. Record the killing gate + reason.
3. For survivors, do a cold re-repro (fresh session, fresh requests) and re-run gates 3-4.
4. Output a verdict table: finding | gates passed | verdict (KEEP / KILL / CHAIN-REQUIRED) | one-line reason.
5. KEEP only findings that passed all gates AND that a triager would rate ≥ Medium after adjustment.
6. For anything CHAIN-REQUIRED: either build the full chain now (then re-gate) or drop it.

## THE KILL-DOUBLE-CHECK (before a finding survives)
Ask out loud, in order:
- "Would the vendor call this a feature?" → if yes, kill.
- "Is this just how the framework/runtime behaves?" → if yes, kill.
- "Does real, authenticated, non-admin exploitation reach real harm?" → if no, kill.
- "Could I publish this to a skeptic and have them reproduce in 5 minutes?" → if no, kill.
- "Am I reporting a severity I'd be embarrassed about if triaged as Informational?" → if yes, kill or downgrade honestly.
- "Is this the root cause, or a symptom of a bug someone else already reported?" → if symptom, reframe or kill.

## OUTPUT FORMAT (strict)
```
VERDICT TABLE
┌ finding ──────┬──────────────────────────────────────────┬─────────┐
│ candidate     │ gate result                              │ verdict │
└───────────────┴──────────────────────────────────────────┴─────────┘
KEEP   → findings that passed ALL 7 gates (submit these)
KILL   → finding + killing gate + one-line reason (do NOT submit)
CHAIN  → finding + the exact chain still required (build it or drop it)
```
Final deliverable: **only the KEEP list**. If nothing passes, say so — an empty report list is a win, not a failure.

## Do NOT
Let a finding pass because you "found it first" or because it's "interesting". Interesting is not important. By-design is not a bug. The triager already has these gates — if you don't apply them, they will, and your ratio (and reputation) pays for it.