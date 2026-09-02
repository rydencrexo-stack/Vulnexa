---
name: hunt-http-smuggling
description: HTTP request smuggling hunting — CL.TE / TE.CL / H2.CL / H2.TE primitives, 2026 suitability matrix (which stacks still vulnerable), H2-downgrade as the modern vector (Burp Request Smuggler, h2csmuggler), detection ladder (timing probe, differential), impact chains (cache poisoning, credential theft, auth bypass, stored XSS), separate-client validation. Use when CDN+origin topology, legacy proxies, or ambiguous server banners are present. Trigger keywords: request smuggling, CL.TE, TE.CL, H2.CL, desync, HTTP/2 downgrade.
---

# HTTP Request Smuggling — Deep Hunting

## THE GATE
Core primitives: CL.TE (`POST /` with `CL: 13` + `TE: chunked` + body `0\r\n\r\nSMUGGLED`), TE.CL, H2.CL/H2.TE via HTTP/2→HTTP/1.1 downgrade. Modern dominant vector is H2-downgrade (CDN+origin topology) — use Burp HTTP Request Smuggler/h2csmuggler, never curl against h2-fronted targets.

## 2026 Suitability Matrix (fingerprint before investing)
| Stack | Status |
|---|---|
| Nginx ≥1.21, Caddy 2, Envoy ≥1.20 | RFC-strict; classic CL.TE/TE.CL dead → pivot H2.CL/H2.TE or legacy upstream |
| HAProxy ≤2.4 | Vulnerable (CVE-2021-40346) |
| AWS ALB, older F5/Citrix/Squid/ATS | Testable |
| Custom Python/Go proxies | Frequently miss RFC enforcement |

Quick check: `curl -sI` Server banner; if no Server header, run a single `space-before-colon` probe — if it 400s, move on.

## Detection Ladder
Timing probe (smuggled GET with ~30s timeout — next request slow = desync works); differential probes; then prove real impact.

## Impact Chains
Cache poisoning (smuggled response cached for victims); credential theft (smuggled `GET /api/me` grabs next user's cookies); auth bypass (smuggle `/admin/*` past front-end ACL); reflected XSS-at-scale.

## Validation
Effect MUST land on a request from a *different* client/session, not your own follow-up — a self-only timing delta is parser disagreement, not exploitable smuggling. OAST-confirm.

## Common Mistakes
Testing classic CL.TE on hardened 2026 stacks; claiming from timing alone; using HTTP/1.1 tools on h2 front-ends.

## PARAMETER COVERAGE — every front-end/back-end pair (MANDATORY)
The #1 miss: testing only the main `POST /` entry and one known proxy pair
and skipping the rest. Smuggling primitives live per-route, per-method, and
per proxy chain.

1. **Enumerate the proxy+origin topology** (every CDN/edge/LB/legacy proxy in
   front of origin) and the routes they differ on.
2. **Sweep every primitive per route and method** — CL.TE, TE.CL, H2.CL,
   H2.TE (via HTTP/2 downgrade), TE-obfuscation variants (`xchunked`, tab/
   space prefixes) on POST AND GET (GET smuggling poisons caches), on each
   route (static, API, login, upload).
3. **For each desync, enumerate the follow-up surfaces** and prove impact on
   a DIFFERENT client: cache poisoning per cacheable route, credential theft
   via smuggled `/api/me`-style requests, auth bypass via smuggled `/admin/*`
   past the ACL, stored-XSS-at-scale via cache.
4. **Fingerprint each stack first** (2026 matrix) so you pivot to H2-downgrade
   on RFC-strict nginx/Envoy instead of wasting time on classic CL.TE.
5. **Re-sweep per content-type and per header set** — some desyncs trigger
   only with a particular header ordering.
6. **Track** `route → method → primitive → desync? → impact` in the journal;
   every unlogged route/method = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: http-smuggling — 85 disclosed H1 reports (36 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `name`
- `id`
- `type`
- `lang`
- `authenticity_token`
- `textdomain`
- `password`
- `product`
- `account_id`
- `username`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Multiple HTTP Smuggling reports** (HTTP Request Smuggling)
  - Signal: Theses reports spreads other several years and are all about **HTTP Smuggling issues** (HTTP Requests or Responses splitting, Cache Poisoning, Security filter bypass). I've made re
- **[critical] Stealing Zomato X-Access-Token: in Bulk using HTTP Request Smuggling on api.zomato.com** (HTTP Request Smuggling)
  - Signal: # Intro Hi Zomato Security Team! My name is Evan Custodio and this is my first time evaluating your platform. I specialize in looking for server-side vulnerabilities. Recently I've
- **[critical] HTTP Smuggling multiple issues in Squid 3.x & squid 4.x** (HTTP Response Splitting)
  - Signal: Hello, as can be seen on a recent public security update by Squid I reported several smuggling issues. If you want some background on impact of Smuggling issues You can check the c
- **[critical] Cache Manager ACL Bypass** (Authentication Bypass Using an Alternate Path or Channel)
  - Signal: ## Summary: ACL Manager can be bypassed giving non authorized users to squid-internal-mgr. Possible to bypass other url_regex, but only focused on manager. with the hostname of the

