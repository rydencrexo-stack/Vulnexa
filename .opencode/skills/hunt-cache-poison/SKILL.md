---
name: hunt-cache-poison
description: Web cache poisoning hunting — unkeyed header candidates, cache-key probing with ?cb=$RANDOM, separate-client reproduction discipline, password-reset poisoning via Host/X-Forwarded-Host, WCD path tricks, defense bypass ladder (HPP, Fat GET, method cloaking), blast-radius assessment. Use when X-Cache/CDN headers, Age>0, or shared-cache topology detected. Trigger keywords: cache poisoning, cache deception, unkeyed header, X-Cache, WCD, password reset poisoning.
---

# Web Cache Poisoning — Deep Hunting

## THE GATE
Two families — target simplest first: (1) password-reset poisoning via `Host`/`X-Forwarded-Host`/`X-Host` (proof = injected host in email link or reflected reset link in body); (2) web cache poisoning via unkeyed headers reflected into cached body.

## Cache Signals
`X-Cache: HIT`, `CF-Cache-Status`, `Age>0`, `Via: varnish/fastly/cloudfront`, `Surrogate-Control`.

## Unkeyed Header Candidates
`X-Forwarded-Host`, `X-Host`, `X-Forwarded-Server`, `X-HTTP-Host-Override`, `Forwarded: host=`, `X-Original-URL`, `X-Rewrite-URL`, `X-Forwarded-Scheme`, `True-Client-IP`.

## WCD Path Tricks
`/account/profile.css`, `/dashboard/settings.jpg`, `;.css`, `%2e%2ecss`, `.avif` (Cloudflare Armor allowlist omission), `/account/me.avif`.

## Key Technique — Cache-Busting Probe
Use `?cb=$RANDOM` to land on a fresh MISS key (client `Cache-Control: no-cache` is ignored per RFC 7234 — it requests revalidation not skip-storage).

## Validation (the discipline)
Poison once, then fetch the same URL **without** the header from a **second IP/incognito** — if you still get the payload, shared-cache poisoning proven; self-only = N/A. Measure `max-age`/TTL for persistence; test error-response caching (4xx/5xx → DoS); method-cloaking (`X-HTTP-Method-Override: HEAD` → empty HEAD body overwrites GET entry — GitLab/GCS case).

## Defense Bypass Ladder
WAF blocks poison headers → try `X-Host`, `X-Forwarded-Server`, `%2e` encoding, case variation; edge strips headers → HTTP/2 pseudo-header downgrade or request smuggling to hit cache backend; auth before caching → WCD; keyed full-URL → HPP (`?legit=1&param=evil`) or Fat GET bodies.

## Common Mistakes
Claiming when only your own browser sees the effect; "weird response headers" as impact; poisoning without confirming separate-client reproduction in ~10 min; ignoring blast radius (global vs single-edge).

## PARAMETER COVERAGE — every unkeyed input (MANDATORY)
The #1 miss: testing only the two or three "known" unkeyed headers and skipping
the rest of the input surface. Poisoning hides in EVERY unkeyed header AND in
query/body/path inputs the cache key ignores.

1. **Enumerate** the cacheable endpoints (static-ish, CDN-fronted, `Age`/
   `X-Cache`/`CF-Cache-Status` present) and their FULL input set: every header
   (`X-Forwarded-Host`, `X-Host`, `X-Forwarded-Server`, `X-HTTP-Host-Override`,
   `Forwarded:`, `X-Original-URL`, `X-Rewrite-URL`, `X-Forwarded-Scheme`,
   `True-Client-IP`, `User-Agent`, `Accept`, cookies) and every query/body key.
2. **Probe each input for keyed-vs-unkeyed**: send it with a cache-busting
   `?cb=$RANDOM`, see if it reflects in the stored response; check `Vary` on
   every response.
3. **Sweep each unkeyed input with a poison payload** (host → evil URL,
   scheme → https/attacker, original-url → admin path), then verify
   **separate-client reproduction** (fetch from a 2nd IP/incognito WITHOUT the
   header; must still receive the poisoned body) — self-only = N/A.
4. **WCD path tricks on EVERY cacheable route**: append `.css`/`.avif`/`;.css`/
   `%2e%2ecss` to sensitive paths and check whether the private response gets
   cached (per-route, not just the one known trick).
5. **Method cloaking on each cacheable route**: `X-HTTP-Method-Override`,
   HEAD-vs-GET body overwrite, Fat GET bodies, HPP (`?legit=1&evil=x`).
6. **Re-sweep per cache layer** (edge CDN vs origin) and per auth context.
7. **Track** `route → input → keyed/unkeyed → poison → 2nd-client?` in the
   journal; every unlogged input = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: cache-poisoning — 81 disclosed H1 reports (29 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `for`
- `cb`
- `cachebust`
- `dontpoisoneveryone`
- `name`
- `yeettest`
- `xyzxyz`
- `qwKzzSR`
- `token`
- `CPDoS`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Multiple HTTP Smuggling reports** (HTTP Request Smuggling)
  - Signal: Theses reports spreads other several years and are all about **HTTP Smuggling issues** (HTTP Requests or Responses splitting, Cache Poisoning, Security filter bypass). I've made re
- **[critical] HTTP Smuggling multiple issues in Squid 3.x & squid 4.x** (HTTP Response Splitting)
  - Signal: Hello, as can be seen on a recent public security update by Squid I reported several smuggling issues. If you want some background on impact of Smuggling issues You can check the c
- **[critical] HTTP request smuggling on Basecamp 2 allows web cache poisoning** (HTTP Request Smuggling)
  - Signal: It is found that an authenticated Basecamp 2 user can desync front and backend servers and poison the socket with harmful response for the next visitor. During redirect probe, It a
- **[critical] The Microsoft Store Uber App Does Not Implement Certificate Pinning** (Improper Certificate Validation)
  - Signal: ## Summary The Microsoft Store Uber App (Windows Phone Architecture) does not properly implement certificate pinning. ## Security Impact Layer-2+ network traffic transmitted from a

