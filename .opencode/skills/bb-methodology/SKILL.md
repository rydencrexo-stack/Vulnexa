---
name: bb-methodology
description: End-to-end bug bounty engagement methodology — 5-step framework (Recon, Learn, Hunt, Validate, Report), passive→active recon expansion, endpoint mapping, entry point generation, attack-path selection, multi-technique validation, engagement journaling, context budgeting across long hunts. Use to structure any engagement start-to-finish. Trigger keywords: methodology, engagement, workflow, recon to report, hunting framework, five step.
---

# Bug Bounty Methodology — End-to-End

## The 5-Step Framework
```
RECON → LEARN → HUNT → VALIDATE → REPORT
```
Every engagement runs this loop. Never report before VALIDATE. Never skip LEARN on an unfamiliar target. Never let RECON spiral.

### 1. RECON (expand, don't spiral)
- **Asset discovery**: subdomains (crt.sh + CT fallback chain + subfinder -all -recursive), live-host probing (httpx), tech fingerprinting (Wappalyzer/httpx), ASN/IP-scan, IPv6, favicon/JARM clustering, source-code /mobile-app presence.
- **Entry points**: URL collection (gau/waybackurls), crawl (katana), parameter discovery (arjun/paramspider), API surface (swagger/OpenAPI/Postman-collections/gRPC reflection), JS bundles (jsluice/SecretFinder + route extraction).
- **Environment**: auth systems (SSO/OAuth/ADFS), cookies, CDN/WAF in front, cache behavior.
- **Stop condition**: you have a map of (host → tech → auth → entry points). That's enough — move on. Don't scrape the whole internet.

### 2. LEARN (target-context, not just vulns)
- Read 3+ disclosed reports for the program — know what triagers accept and what they mark N/A.
- Read docs/help-center/changelog — "What Changed" method: new features = new bugs.
- Use the app as a real user for 15+ minutes with 2 test accounts (attacker + victim).
- Map the business model: money flows, permission model, tenant model, trust boundaries.

### 3. HUNT (feature-first, then class)
- Pick ONE feature at a time; test ALL its endpoints (including the API the mobile app calls).
- **PARAMETER COVERAGE IS MANDATORY (see `param-coverage-discipline`)**: for every endpoint, enumerate the FULL parameter set — query keys (incl. page/limit/format/_/callback), path segments, every JSON/form key recursively through nested objects/arrays, headers, cookies, GraphQL args, WS fields — then sweep EVERY parameter with the full payload ladder for the class being hunted. Never skip IDs, booleans, counts, timestamps, or headers. Log `endpoint → param → class → result` in the journal; a skipped param = a skipped bug.
- For each endpoint run the relevant class checklists (see hunt-* skills). One class at a time, go deep.
- Hunt authz inconsistencies: same endpoint through different API versions, web vs mobile, free vs paid.
- Note primitives/gadgets in the funnel; when you find one, use the A→B method to find its sibling.
- Stay honest with the 7-Question Gate: kill weak findings immediately.

### 4. VALIDATE (2+ techniques per finding)
- Confirm the same root cause with ≥2 distinct techniques (e.g. time-based + boolean; reflected + OOB).
- Confirm no duplicate against Hacktivity; confirm data isn't already public (check incognito web UI).
- Reproduce cleanly from scratch with real HTTP requests. Capture the exact payload + response.

### 5. REPORT (one report per chain, human tone)
- Impact-first narrative, full repro steps, CVSS 3.1, minimal PoC (no scraping, redact PII).
- Reference only in-scope assets. State blast radius honestly. See reporting.md for templates.

## Engagement Journal
Append-only JSONL: timestamp, target, tool, payload, response code/ms, verdict. It's your forensic record, surface-pattern finder, and the fastest path to re-verification.

## Context Budgeting Across Long Hunts
- Persist the funnel (Notes → Leads → Primitives → Findings → Reports) to a file per target so compaction never loses the state.
- Load reference docs phase-by-phase (recon.md only during recon; reporting.md only at report time).
- When context is tight, work from the journal: resume = re-open funnel + last journal entries + current plan line.

## Two-Eye Approach
Combine systematic checklists (thorough, misses nothing) with anomaly watching (spot the weird response, the constant token, the 37KB 404). Both eyes on at all times — that's how deep hunts find the class nobody else sees.