---
name: ketanhack
description: Master orchestration skill. When the user says "use ketanhack", run a full engagement on the given target — fingerprint the target, then LOAD EVERY applicable hunt skill from the inventory below (injection, auth/SSO, frameworks, cloud, mobile, OSINT, etc.), run recon and hunting per the loaded skills, and pass EVERY finding through the false-positive-checker gate before anything is reported. Only validated, non-false-positive findings reach the report. Use for any bug bounty target, from recon to report. Trigger keywords: ketanhack, use ketanhack, full engagement, hunt everything, all skills.
---

# ketanhack — Full-Stack Orchestrator

## CONTRACT (when "use ketanhack" is invoked)
1. Confirm the target + program scope (authorized targets only).
2. **Load the master workflow**: `bug-bounty` skill (recon→learn→hunt→validate→report), plus `recon-scope-triage` + `bb-methodology` for the plan.
3. **Fingerprint the target** (tech stack, auth, CMS/framework, cloud, mobile, APIs) — this decides which hunt-* skills to load.
4. **Load EVERY applicable skill from the inventory** for the fingerprint (below). Do not skip a category because it's hard or the surface looks small.
5. **Load `param-coverage-discipline` and apply it during EVERY class sweep**: enumerate the full parameter set of each endpoint (query/path/body recursive/headers/cookies/GraphQL/WS) and test EVERY parameter with the full payload ladder for that class — never skip IDs, booleans, counts, page/limit, timestamps, nested keys, or headers. Track `endpoint → param → class → result` in the journal; unlogged params are gaps.
6. **Hunt per the loaded skills' checklists.** Use the funnel (Notes → Leads → Primitives → Findings) and the engagement journal.
7. **MANDATORY final gate**: pass every finding through `false-positive-checker` (all 7 gates) + `triage-validation`. Only KEEP-list findings survive.
8. **Report** survivors via `report-writing` with `evidence-hygiene` standards.

## THE FULL SKILL INVENTORY — load the matching ones per target
> The agent must invoke the `skill` tool for each applicable skill. "Load" = actually load its content into context before hunting that class.

### 0. Always-on orchestration / meta
- `bug-bounty` — master workflow + A→B chains + funnel
- `recon-scope-triage` — pick the crown jewel before touching the target
- `bb-methodology` — the 5-step engagement loop
- `redteam-mindset` — DO-NOT-STOP directive, blocker trees, cadence per host
- `offensive-osint` — recon arsenal (subdomain sources, secret catalog, endpoint scoring)
- `osint-methodology` — org-level pivot (creds, identity fabric, dorking)
- `param-coverage-discipline` — **MANDATORY per-parameter testing protocol** (enumerate EVERY param on EVERY endpoint, then sweep each with the full payload ladder for each bug class; forbid skipping "safe-looking" params)
- `hunt-access-control` **403/401 BYPASS CATALOGUE** — MANDATORY on every gated URL (method fuzz → path-normalization → trust-proxy headers → parameter/HPP → version downgrade → protocol/origin tricks)
- `hunt-brute-force` **RATE-LIMIT BYPASS MATRIX** — MANDATORY on every rate-limited action (header spoof, path/case/encoding desync, equivalent endpoints, identity mutation, protocol/H2 multiplexing, session reset, counter race)
- `false-positive-checker` — FINAL GATE on every finding
- `triage-validation` — 7-Question Gate + layer-ordering trap
- `evidence-hygiene` — PoC redaction + capture discipline
- `report-writing` — CVSS 3.1, PoC etiquette, self-review

### 1. RECON phase skills (load at start)
- `offensive-osint` — subdomain source stack, CT fallback, favicon/JARM, ASN, endpoint scoring
- `recon-scope-triage` — crown jewel, asset triage, prioritization
- `hunt-source-leak` — .env/.git/.js.map/swagger exposure checks
- `hunt-shadow-api` — version diff, deprecated endpoints, old API surfaces
- `hunt-spa-api` — SPA bundle harvesting, route discovery, unauth API tests

### 2. Fingerprint → load matching FAMILY skills
| Fingerprint signal | Load these skills |
|---|---|
| Any object-ID / tenant / user data | `hunt-access-control` (IDOR/BOLA) |
| Forms/search/sort/export/filter params | `hunt-sqli` · `hunt-nosqli` |
| File/template/theme/page/view params | `hunt-lfi` · `hunt-ssti` |
| XML/SOAP/SAML/DOCX/SVG uploads | `hunt-xxe` · `hunt-saml` |
| Java/rO0A/pickle/O:8/serialized blobs | `hunt-deserialization` |
| exec-style/command/child_process endpoints | `hunt-rce` |
| Directory/people/search endpoints | `hunt-ldap` |
| Reflection/search/profile/markdown/XSS sinks | `hunt-xss-csrf` · `hunt-dom` |
| OAuth/SSO/login buttons/redirect_uri | `hunt-oauth` · `hunt-ato` · `hunt-auth-bypass` · `hunt-ssrf-oauth` |
| URL-fetching features (webhooks, import-from-URL, link previews, PDF/screenshot gen, avatar/proxy) | `hunt-ssrf-oauth` |
| JWT/JWKS/token APIs | `hunt-jwt` · `hunt-session` |
| MFA/OTP/2FA/backup codes | `hunt-mfa-bypass` · `hunt-brute-force` |
| Reset/forgot-password flows | `hunt-forgot-password` · `hunt-ato` · `hunt-host-header` |
| CAPTCHA-protected forms | `hunt-captcha-bypass` |
| Login/OTP/reset rate limits | `hunt-brute-force` |
| WebSocket/wss/socket.io/SignalR | `hunt-websocket` |
| gRPC/protobuf/Connect/grpc-gateway | `hunt-grpc` |
| CORS headers reflected | `hunt-cors` |
| CDN/X-Cache/Age>0 headers | `hunt-cache-poison` · `hunt-http-smuggling` |
| Proxy+origin topology / legacy proxies | `hunt-http-smuggling` |
| Host/X-Forwarded-Host reflected | `hunt-host-header` · `hunt-cache-poison` |
| Coupons/checkout/payment/wallet/webhooks | `hunt-business-logic` · `hunt-race-condition` · `hunt-file-upload` |
| File upload endpoints | `hunt-file-upload` · `hunt-race-condition` |
| Redirect-style params (next/return/go) | `hunt-open-redirect` · `hunt-oauth` |
| Frameable pages + sensitive actions | `hunt-clickjacking` |
| NTLM/Negotiate/WWW-Authenticate | `hunt-ntlm` |
| JSON merge/update endpoints | `hunt-nodejs` · `hunt-api-misconfig` (prototype pollution, mass assignment) |
| Swagger/OpenAPI/OData | `hunt-api-misconfig` · `hunt-graphql-api` |
| GraphQL endpoints | `hunt-graphql-api` |
| Unexpected types/malformed input/verbose errors | `hunt-exceptional` |
| LLM/chat/summarizer/RAG/agents/MCP | `hunt-ai-llm` |

### 3. Framework / stack skills (fingerprint-matching)
| Detected | Load |
|---|---|
| Spring Boot (Whitelabel, actuator, X-Application-Context) | `hunt-springboot` |
| Laravel (laravel_session, Ignition, .env, APP_KEY) | `hunt-laravel` |
| Next.js (_next, __NEXT_DATA__, Next-Action, server actions) | `hunt-nextjs` |
| Node/Express (X-Powered-By: Express) | `hunt-nodejs` |
| ASP.NET (ViewState, .ASPXAUTH, X-AspNet-Version, trace.axd) | `hunt-aspnet` |
| SharePoint (_layouts, _vti_bin, SPRequestGuid) | `hunt-sharepoint` |

### 4. Cloud / platform / enterprise skills
| Detected | Load |
|---|---|
| S3/GCS/Blob/Firebase/cloud assets | `hunt-cloud-misconfig` · `hunt-cloud-infra` |
| K8s ports (6443/10250/2379), docker.sock | `hunt-k8s` |
| Cloud creds/roles/metadata/Cognito | `hunt-iam` |
| CI/CD, GitHub Actions, Jenkins, runners | `hunt-cicd` · `hunt-supply-chain` |
| Dangling CNAMEs / NXDOMAIN | `hunt-subdomain` |
| Microsoft 365 / Entra / autodiscover | `hunt-m365` |
| Okta tenant / api/v1/authn | `hunt-okta` |
| SSL VPN cookies (webvpn, SVPNCOOKIE, NSC_AAA, global-protect) | `hunt-vpn-appliance` |
| vCenter/ESXi/VMware | `hunt-vcenter` |
| Mobile apps in scope | `hunt-mobile` |
| Public package registries / dependencies | `hunt-supply-chain` |
| Old crypto/TLS/DMARC/mTLS headers | `hunt-tls-network` |

### 5. Cross-cutting skills (apply where relevant)
- `hunt-race-condition` — single-packet attacks on coupons/OTP/limits
- `hunt-subdomain` — takeover chains (OAuth/CSP/CORS/email)
- `hunt-supply-chain` — dependency confusion, typosquat leads
- `hunt-misc` — invitation flows, PAT scopes, CRLF, webhooks, soft-delete
- `hunt-web-injection` — consolidated server-side injection sweep (SQLi, SSTI, XXE, LFI/RFI, CMDi, prototype pollution, deserialization) when a single injection pass over all inputs is wanted
- `hunt-web3` — ONLY if smart contracts/DeFi are in scope

## EXECUTION RULES
1. **No skipping categories** — a target with only one login page still gets: `hunt-auth-bypass`, `hunt-brute-force`, `hunt-forgot-password`, `hunt-mfa-bypass`, `hunt-session`, `hunt-jwt`, `hunt-oauth`, `hunt-ato`, `hunt-captcha-bypass`, `hunt-ntlm` if NTLM, plus injection skills on every parameter.
2. **No skipping parameters** — within every class sweep, EVERY parameter of EVERY endpoint gets the full payload ladder (`param-coverage-discipline`). Enumerate first, sweep each param one at a time, log every `param → class → result`. A param that looks safe (numeric ID, boolean, count, timestamp, nested key, header) is tested, not assumed clean. Re-sweep on auth-context and content-type changes.
3. **No skipping GATES** — a 401/403 or 429 response is not a stop, it is a coverage target: run the **403/401 BYPASS CATALOGUE** on every gated URL and the **RATE-LIMIT BYPASS MATRIX** on every rate-limited action (per `hunt-access-control` + `hunt-brute-force`). Sweep the same route under every auth context.
4. **Load order per phase**: recon skills → fingerprint → family skills → framework/cloud skills → cross-cutting. Load each skill's content when you enter its phase (don't load everything into context at once — but DO load every APPLICABLE one before hunting that surface).
5. **Funnel + journal discipline**: persist Notes→Leads→Primitives→Findings per target. Log every probe (engagement journal).
6. **Every finding ends at the gate**: nothing is reported without passing `false-positive-checker` (all 7 gates) and `triage-validation`. Kill by-design and intentional behaviors ruthlessly.
7. **One crown jewel per engagement**; A→B chain hunting once a primitive is found.
8. **If you're stuck**: `redteam-mindset` — the authorization stands, the engagement continues. Rotate classes, use sister-app patterns, attempt blockers 2+ ways.

## OUTPUT
- Verdict table per candidate finding (KEEP / KILL / CHAIN) from the false-positive-checker.
- Final report only for KEEP items, per `report-writing` + `evidence-hygiene`.
- If no finding passes the gates, state that plainly — an honest empty run beats a false-positive report.