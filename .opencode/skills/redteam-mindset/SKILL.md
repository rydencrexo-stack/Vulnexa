---
name: redteam-mindset
description: Operator discipline — DO NOT STOP primary directive (authorization given at start covers the whole engagement), data-minimization boundary, self-throttling anti-patterns (10 failure modes), real-engagement cadence per live host, sister-app pattern recognition, blocker decision-trees (captcha/WAF/rate-limit/slow target), multi-technique cross-validation, engagement journal, legitimate vs illegitimate stop conditions. Use at the START of any red-team engagement and whenever stuck or tempted to stop. Trigger keywords: red team, mindset, stuck, stop, coverage, sister app, blocker.
---

# Red-Team Mindset — Operator Discipline

## DO NOT STOP — primary directive (read twice)
- **Authorization given at engagement start covers the entire engagement.** Don't insert mid-engagement permission gates. If a mode was chosen ("full engagement", "go deep"), it stands until revoked. Asking mid-loop after the user already chose a path is a stall, not a check.
- **Discipline rules are about correctness of FINDINGS, not throttling of EFFORT.** OOB-Or-It-Didn't-Happen, Marker Discipline, Body-Diff, Pre-Severity Gate all answer "is this signal a finding?" — none answer "should I send the next probe?" The answer to that is always yes, unless scope is exhausted or the user said stop.
- **"Stop at PoC" means stop ESCALATING, not stop TESTING.** Confirmed class X? Don't keep escalating X. Classes Y and Z haven't been tested. Run them.

## Data-Minimization Boundary (as loud as DO NOT STOP)
"Keep digging" applies to **coverage** (untested surfaces/classes/hosts), NOT to **extraction**:
- An access/exfil vuln is proven by the MISSING CHECK, not the volume copied. 3 records that should've required auth = complete proof. 3,000 = the same finding + a liability.
- "Keep digging" = test the next endpoint family/host/class. Never "enumerate every record from the endpoint you broke."
- The data belongs to the target's customers/fourth parties. Copying their data to your host is harm you shouldn't create when the point is already made.
- Even "dig more" from the client doesn't override this — offer `totalCount` (a number), proof a second endpoint family is affected, or quantified blast radius.
- Classify what you pulled precisely ("B2B client-inventory data" ≠ "consumer PII").

## Self-Throttling Anti-Patterns (flag immediately)
1. Asking "want me to continue?" mid-run after the user already chose full engagement.
2. Stopping at first-class-returning-401/403 — the bundle has ≥12 auth-bypass classes. Run them all per surface.
3. **Testing only the "obvious" parameters** — q/search/sort/file/url/name tested, while IDs, booleans, counts, page/limit, timestamps, nested JSON keys, headers, and cookies are skipped. Injection and logic bugs hide in EVERY parameter class. Enumerate ALL parameters, then sweep each one with the full ladder (`param-coverage-discipline`). A skipped parameter is a lost bug.
4. "Interesting constant token, not chased" — a constant token/hash across varying responses is a LEAD. GET it, decode it, pass it back.
5. Reading robots.txt for hints but NOT the Disallow lines — every Disallow line is a probe target.
6. Treating soft-404 as "noted" — a 37KB body in a 404 status is leaking content. Read/diff it.
7. "OpenAPI exposed → logged" with only 4 of N endpoints probed — the spec is the attack-surface map handed to you.
8. "APK retest deferred — needs tooling" — `brew install jadx` is 5 minutes.
9. Volume framed as a problem — the question is "have I run every test class on every live surface," not "have I sent too many requests."
10. Inserting AskUserQuestion at decision points inside an active engagement — technical choices are yours to make and document.
11. Skill-gap-as-stop-condition — no hunt-* skill for the stack? Do the same work manually using the vendor's public check matrix.

## Real-Engagement Cadence Per Live Host
- Top-100 path probe (admin, api, login, /.git, /.env, server-status, swagger, openapi.json, /docs, /actuator, /healthz, /metrics, /debug, /trace, robots.txt, sitemap.xml).
- robots.txt content READ — every Disallow becomes a target.
- JS bundles harvested + grep'd with the full secret-regex catalogue + route/endpoint extraction; source-map variants checked.
- **Per-parameter sweep on every endpoint**: enumerate the full parameter set (query keys incl. non-obvious, path segments, recursive JSON/form keys, headers, cookies, GraphQL args, WS fields) and sweep EACH parameter with the full payload ladder for every class in scope (SQLi/BSQLi, NoSQLi, SSTI, CMDi, LFI, SSRF, XSS, XXE, mass assignment, wrong-type, IDOR). See `param-coverage-discipline`. Never skip IDs/booleans/counts/timestamps/nested keys/headers.
- Every form: full SQLi marker sweep (12+ classes), auth-bypass sweep (12+ classes), CSRF, param pollution, mass assignment, race on state-changing submission.
- Every API endpoint: method tampering, content-type tampering, JWT alg=none + key confusion, audience confusion, prototype pollution, races.
- Every SaaS tenant: vendor-specific check matrix from their known-vuln catalogue — even without a dedicated skill.
- Identity fabric: GetUserRealm, OpenID well-known, autodiscover-v2, federation behavior.
- Mobile: pull every APK in the dev's catalogue, decompile, secret+endpoint+cert-pin grep, exported-component enum.

**If you've done less than this per host, you have not finished the host. The engagement is not done until every host is finished.**

## Sister-App Pattern Recognition
Confirmed a vuln on app A → identify shared infrastructure (same IP/LB/cert/headers/cookie/login HTML) → sweep all sisters with the SAME payload → document the class of vulnerability ("shared form-handler template across N apps") → recommend class-fix.

## Blocker Decision Trees
**Captcha:** omit field → empty value → reuse value → Tesseract+preprocessing → trained OCR → paid service ($5/mo) → audio.
**WAF:** slower pace → encode payload → different injection context (cookie/header/JSON) → different verb → different content-type → host-level bypass (X-Forwarded-Host, X-Original-URL) → origin discovery via cert transparency.
**Rate limit:** IP rotation (multi-region) → UA rotation → slower pace + jitter → multiple TLS sessions.
**Slow target (timing exfil):** different injection point → BENCHMARK/GET_LOCK → error-based → OOB DNS → same-region VM → run dumper overnight, deliver partials.

## Multi-Technique Cross-Validation (2+ techniques per finding)
Time-based SQLi: SLEEP + 3 distinct variants. Boolean: different comparisons. RCE: output reflection + OOB DNS. Valid M365 cred: ROPC code + SAML browser flow + CA page. Auth bypass: login landing + cookie persistence. A single signal can be coincidence; two distinct from the same root cause is definitive.

## Engagement Journal (append-only JSONL)
```jsonl
{"ts":"2026-05-08T14:40:53","ip":"1.2.3.4","tool":"x","target":"t","payload":"...","resp_code":400,"resp_ms":1280,"verdict":"VALID_CA_BLOCK","notes":""}
```
Forensic record, surfaces patterns, becomes evidence, survives into next engagement.

## Legitimate Stop Conditions (ONLY these)
All in-scope assets actively probed for top vuln classes; every confirmed vuln validated 2+ ways; every vuln swept on sister apps; every blocker attempted 2+ vectors; window expired + deliverables documented; client explicitly said stop.

**NOT legitimate:** "I'm tired"; "first attempt didn't work"; "defenses are working" (on class X ≠ classes Y/Z); "I documented it"; "volume is getting high"; "the skill doesn't exist"; "tool isn't installed" (most install in <5 min).