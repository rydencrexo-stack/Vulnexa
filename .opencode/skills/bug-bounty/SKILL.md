---
name: bug-bounty
description: Complete authorized bug bounty hunting workflow for opencode — recon, learning/disclosed-report research, vulnerability hunting (IDOR, SSRF, XSS, auth bypass, CSRF, race conditions, SQLi, XXE, file upload, business logic, GraphQL, HTTP smuggling, cache poisoning, OAuth/OIDC, SSTI, subdomain takeover, cloud misconfig, ATO chains, LLM/AI), A-to-B bug chaining, bypass tables, and report writing (validation gates, CVSS 3.1, PoC generation). Use for ANY bug bounty task — starting a new target, recon, hunting, auditing source code, testing AI features, validating findings, or writing a report. Trigger keywords: bug bounty, recon, subdomain enumeration, pentest, vulnerability hunting, IDOR, SSRF, XSS, report writing, hackerone, bugcrowd.
---

# Bug Bounty Master Workflow

Full pipeline: **Recon -> Learn -> Hunt -> Validate -> Report**. One skill for everything, split into modular reference docs so you only load what you need.

## THE ONLY QUESTION THAT MATTERS

> "Can an attacker do this RIGHT NOW against a real user who has taken NO unusual actions — and does it cause real harm (stolen money, leaked PII, account takeover, code execution)?"

If the answer is NO — **STOP. Do not write. Do not explore further. Move on.**

### Kill These Immediately (Theoretical Bugs = Wasted Time)

| Pattern | Kill Reason |
|---|---|
| "Could theoretically allow..." | Not exploitable = not a bug |
| "An attacker with X, Y, Z conditions could..." | Too many preconditions |
| "Wrong implementation but no practical impact" | Wrong but harmless = not a bug |
| Dead code with a bug in it | Not reachable = not a bug |
| Source maps without secrets | No impact |
| SSRF with DNS-only callback | Need data exfil or internal access |
| Open redirect alone | Need ATO or OAuth chain |
| "Could be used in a chain if..." | Build the chain first, THEN report |

**You must demonstrate actual harm. "Could" is not a bug. Prove it works or drop it.**

## CRITICAL RULES

1. **READ FULL SCOPE FIRST** — verify every asset/domain is owned by the target org. Stay strictly in-scope per program policy. **Authorized targets only.**
2. **NO THEORETICAL BUGS** — "Can an attacker steal funds, leak PII, takeover account, or execute code RIGHT NOW?" If no, STOP.
3. **KILL WEAK FINDINGS FAST** — run the 7-Question Gate BEFORE writing any report.
4. **Validate before writing** — check CHANGELOG, design docs, deployment scripts FIRST.
5. **One bug class at a time** — go deep, don't spray.
6. **Verify data isn't already public** — check web UI in incognito before reporting API "leaks".
7. **5-MINUTE RULE** — if a target shows nothing after 5 min probing (all 401/403/404), MOVE ON.
8. **IMPACT-FIRST HUNTING** — ask "what's the worst thing if auth was broken?" If nothing valuable, skip target.
9. **CREDENTIAL LEAKS need exploitation proof** — finding keys isn't enough, must PROVE what they access.
10. **STOP SHALLOW RECON SPIRALS** — don't probe 403s, don't grep for analytics keys, don't chase staging domains that lead nowhere.
11. **BUSINESS IMPACT over vuln class** — severity depends on CONTEXT, not just vuln type.
12. **UNDERSTAND THE TARGET DEEPLY** — before hunting, learn the app like a real user.
13. **DON'T OVER-RELY ON AUTOMATION** — automated scans hit WAFs, trigger rate limits, find the same bugs everyone else finds.
14. **HUNT LESS-SATURATED VULN CLASSES** — cache poisoning, mobile vulns, business logic, race conditions, OAuth/OIDC chains, CI/CD pipeline attacks.
15. **ONE-HOUR RULE** — stuck on one target for an hour with no progress? SWITCH CONTEXT.
16. **TEST EVERY PARAMETER, EVERY TIME (param-coverage-discipline)** — the #1 way bugs get missed is testing only the "obvious" params (q/search/sort/file/url/name) and skipping IDs, booleans, counts, page/limit, timestamps, nested JSON keys, headers, and cookies. For every endpoint, enumerate the FULL input set, then sweep EACH parameter with the full payload ladder for the class in scope (SQLi/BSQLi, NoSQLi, SSTI, CMDi, LFI, SSRF, XSS, XXE, mass assignment, wrong-type, IDOR). Log `endpoint → param → class → result`; a skipped param = a lost bug. Re-sweep per auth context and content-type.
17. **TWO-EYE APPROACH** — combine systematic testing (checklist) with anomaly detection (watch for unexpected behavior).
18. **T-SHAPED KNOWLEDGE** — go DEEP in one area and BROAD across everything else.
19. **NO DESTRUCTIVE ACTIONS** — only test on accounts you own. Don't modify other users' data, don't DoS, don't exfil beyond what proves impact.

## THE FUNNEL — Note-Taking System (Never Hunt Without This)

Persist across sessions. Each level filters down from the previous one. This survives context compaction and keeps multi-session hacking organized.

| Level | Purpose |
|---|---|
| **Notes** | Raw observations, anything interesting during recon |
| **Leads** | Promising attack vectors that warrant further investigation |
| **Primitives/Gadgets** | Confirmed building blocks — IDOR patterns, auth bypasses, useful endpoints |
| **Findings** | Validated vulnerabilities with full reproduction steps |
| **Reports** | Polished write-ups ready for submission |

**Storage convention**: per-target folder, e.g. `~/bugbounty/<target>/NOTES.md` with a `SESSION_LOG.md` in each target folder containing scope + context. Keep the funnel sections in NOTES.md. After any session, ask the user where notes should live.

## WORKFLOW — When to Load Which Doc

Follow the phases in order. Load each reference doc **only when entering its phase** to conserve context.

### Phase 0 — Session Setup (always)
1. Ask for / confirm the target program + scope (HackerOne/Bugcrowd/Intigriti handle or URL).
2. Pull scope via the HackerOne GraphQL snippet in `references/recon.md`.
3. Read at least 3 disclosed reports for the program (see `references/learning.md`).
4. Set up the notes funnel file.
5. Define ONE crown jewel as today's primary target.

### Phase 1 — RECON
Load `references/recon.md`. Pipeline: subdomains → resolve/live → URL collection → nuclei → JS secrets → cloud assets → API endpoints → fingerprinting → quick wins. Source code recon if repos are available.

### Phase 2 — LEARN
Load `references/learning.md`. Disclosed reports, "What Changed" method, threat modeling, top-reporter patterns.

### Phase 3 — HUNT
First, if the target tech is clear, load the **specialized hunt skill** for that class to get its deep checklist:

- `hunt-access-control` — IDOR, broken access control, authz bypass
- `hunt-web-injection` — SQLi, SSTI, XXE, LFI/RFI, command injection
- `hunt-xss-csrf` — XSS (reflected/stored/DOM/mXSS), CSRF, open redirect, clickjacking
- `hunt-ssrf-oauth` — SSRF (with bypass tables), OAuth/OIDC, JWT, ATO chains
- `hunt-file-upload` — file upload bypass, race conditions, business logic
- `hunt-graphql-api` — GraphQL, API abuse, cache poisoning, request smuggling
- `hunt-ai-llm` — prompt injection, RAG poisoning, LLM/agentic AI security (ASI01-ASI10)
- `hunt-cloud-infra` — S3/cloud misconfig, subdomain takeover, CI/CD, mobile
- `hunt-web3` — smart contracts, DeFi, Solidity, meme-coin/Token-2022 audits

**Deep one-class-per-endpoint skills** (load when the target maps to that class — fastest path to a real finding):

- `param-coverage-discipline` — **MANDATORY before/through every class sweep**: enumerate EVERY parameter on every endpoint (query/path/JSON-body recursive/headers/cookies/GraphQL/WS), then test EACH with the full payload ladder for the class. A skipped parameter is a lost bug.
- `hunt-sqli` · `hunt-nosqli` · `hunt-lfi` · `hunt-ssti` · `hunt-xxe` · `hunt-deserialization` · `hunt-rce` · `hunt-ldap` — injection family with bypass tables + gates
- `hunt-cors` · `hunt-cache-poison` · `hunt-http-smuggling` · `hunt-host-header` · `hunt-race-condition` · `hunt-websocket` · `hunt-grpc` · `hunt-dom` · `hunt-subdomain` · `hunt-open-redirect` · `hunt-tls-network` · `hunt-clickjacking` — web/infra primitives
- `hunt-mfa-bypass` · `hunt-ato` · `hunt-session` · `hunt-jwt` · `hunt-saml` · `hunt-oauth` · `hunt-brute-force` · `hunt-forgot-password` · `hunt-captcha-bypass` · `hunt-ntlm` · `hunt-auth-bypass` — auth/session/SSO (the highest-payout family)
- `hunt-springboot` · `hunt-laravel` · `hunt-nextjs` · `hunt-nodejs` · `hunt-aspnet` · `hunt-sharepoint` · `hunt-shadow-api` · `hunt-spa-api` · `hunt-api-misconfig` · `hunt-business-logic` · `hunt-exceptional` · `hunt-misc` — framework/stack-specific
- `hunt-k8s` · `hunt-cicd` · `hunt-cloud-misconfig` · `hunt-iam` · `hunt-source-leak` · `hunt-supply-chain` · `hunt-m365` · `hunt-okta` · `hunt-vpn-appliance` · `hunt-vcenter` · `hunt-mobile` — cloud/platform/enterprise
- `offensive-osint` — recon arsenal (subdomain sources, secret catalog, dork corpus, endpoint scoring)
- `redteam-mindset` — operator discipline, DO-NOT-STOP directive, blocker decision trees
- `recon-scope-triage` · `bb-methodology` — pre-hunt target selection + end-to-end engagement workflow
- `osint-methodology` — org-level pivot: credential exposure, identity fabric, dorking
- `triage-validation` · `evidence-hygiene` — find validation gates + evidence standards before reporting
- `report-writing` — report drafting, CVSS 3.1, PoC etiquette, self-review checklist

**Master orchestration** (single entry point):
- `ketanhack` — "use ketanhack" = load every applicable hunt skill for the target + run the full pipeline
- `false-positive-checker` — mandatory final gate: kills false positives AND intentional/by-design behavior, keeps only findings that pass all 7 gates

Each skill references its own `hunting.md` checklist. The general checklists also live in this skill's `references/hunting.md` and `references/mobile-api-cicd.md`. The generic per-vuln priority order: **RCE → SQLi → SSRF → LFI → Auth Bypass → IDOR → Stored XSS → CSRF → Open Redirect → Info Disclosure**.

### Phase 4 — VALIDATE
Run the **7-Question Gate** and **4 Pre-Submission Gates** in `references/reporting.md`. Verify no duplicates against Hacktivity. Confirm PoC with real HTTP requests.

### Phase 5 — REPORT
Load `references/reporting.md`. Write human-tone reports with full reproduction steps, CVSS 3.1, and clean PoCs. One report per chain, not per bug. Templates, title formulas, always-rejected list, conditionally-valid chains, and severity-escalation counters all live there.

## FALLBACK ARCHITECTURE (Design Principle)

Design every workflow with layered abstraction. When executing a task:
1. **Primary tool** — use the skill's prescribed commands/binaries (ffuf, httpx, etc.).
2. **SDK/library layer** — if the primary tool fails, invoke the underlying library directly.
3. **Raw API** — as a last resort, use raw REST/GraphQL calls to control the tool at protocol level.

**If this workflow fails or doesn't cover the situation, use your own exploration and creativity to keep going.** Don't limit yourself to the prescribed workflow.

## A→B BUG SIGNAL METHOD (Cluster Hunting)

When you find bug A, systematically hunt for B and C nearby. Single bugs pay. Chains pay 3-10x more.

| Bug A (Signal) | Hunt for Bug B | Escalate to C |
|---|---|---|
| IDOR (read) | PUT/DELETE on same endpoint | Full account data manipulation |
| SSRF (any) | Cloud metadata 169.254.169.254 | IAM credential exfil → RCE |
| XSS (stored) | Check if HttpOnly set on session cookie | Session hijack → ATO |
| Open redirect | OAuth redirect_uri accepts your domain | Auth code theft → ATO |
| S3 bucket listing | Enumerate JS bundles | Grep for OAuth client_secret → OAuth chain |
| Rate limit bypass | OTP brute force | Account takeover |
| GraphQL introspection | Missing field-level auth | Mass PII exfil |
| Debug endpoint | Leaked environment variables | Cloud credential → infra access |
| CORS reflects origin | Test with credentials: include | Credentialed data theft |
| Host header injection | Password reset poisoning | ATO via reset link |

### Cluster Hunt Protocol (6 Steps)
```
1. CONFIRM A     Verify bug A is real with an HTTP request
2. MAP SIBLINGS  Find all endpoints in the same controller/module/API group
3. TEST SIBLINGS Apply the same bug pattern to every sibling
4. CHAIN         If sibling has different bug class, try combining A + B
5. QUANTIFY      "Affects N users" / "exposes $X value" / "N records"
6. REPORT        One report per chain (not per bug). Chains pay more.
```

## TOP 1% MINDSET

**Hunt the feature, not the endpoint.** Find all endpoints that serve a feature, then test the INTERACTION between them.

- **Authorization inconsistency is your friend** — if the app checks auth in 9 places but not the 10th, that's your bug.
- **New == unreviewed** — features launched in the last 30 days have lowest security maturity.
- **Think second-order** — second-order SSRF: URL saved in DB, fetched by cron job. Second-order XSS: stored clean, rendered unsafely in admin panel.
- **Follow the money** — any feature touching payments, billing, credits, refunds is where developers make the most shortcuts.
- **The API the mobile app uses** — mobile apps often call older/different API versions. Same company, different attack surface, lower maturity.
- **Diffs find bugs** — compare old API docs vs new. Compare mobile API vs web API. Compare free vs paid user responses.

### Pre-Hunt Mental Checklist
- I know the app's core business model
- I've used the app as a real user for 15+ minutes
- I know the tech stack (language, framework, auth system, caching)
- I've read at least 3 disclosed reports for this program
- I have 2 test accounts ready (attacker + victim)
- I've defined my primary target: ONE crown jewel I'm hunting for today

## TOOLBOX (Verify installed before use; install via go install / pip / brew)

| Tool | Use |
|---|---|
| subfinder / assetfinder | Passive subdomain enum |
| httpx | Probe live hosts |
| dnsx | DNS resolution |
| nuclei | Template scanner |
| katana | Crawl |
| waybackurls / gau | Known/archive URLs |
| ffuf | Fuzzer (always `-ac`) |
| anew | Dedup append |
| qsreplace | Replace param values |
| gf | Grep patterns (xss, sqli, ssrf, redirect) |
| interactsh-client | OOB callbacks |
| arjun / paramspider | Hidden parameter discovery |
| kiterunner | API endpoint brute |
| sqlmap | SQL injection |
| subzy / subjack | Subdomain takeover |
| gitleaks / trufflehog | Secret scanning |
| SecretFinder / jsluice | JS secret extraction |
| semgrep | Static analysis (p/security-audit, p/owasp-top-ten) |

## DUAL-AGENT METHODOLOGY (for long/deep hunts)

When the user wants maximum coverage, recommend two parallel sessions:
- **Agent A (Guided)**: follows this full skill deterministically — front-end analysis, source map enumeration, endpoint fuzzing, ensuring nothing gets missed.
- **Agent B (Free-roaming)**: minimal guidance, just target URL + auth, explores creatively for vectors outside the standard methodology.

Tell both: "Keep detailed notes on what you tried, what worked, what didn't." Then cross-compare results and fold Agent B's novel techniques back into the skill/workflow.
