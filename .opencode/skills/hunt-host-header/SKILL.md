---
name: hunt-host-header
description: Host header injection hunting — password-reset poisoning → ATO (crown jewel), unkeyed Host reflected into absolute URLs → mass poison, routing-based SSRF vs path-override ACL bypass (do NOT conflate), OAuth/OIDC issuer poisoning, payload ladder (dual-Host, absolute-URL, userinfo), false-positive killers (Vary check, second-egress, Age:0). Use when Host-derived URLs, reset links, or edge ACLs are present. Trigger keywords: host header, X-Forwarded-Host, password reset poisoning, routing SSRF, issuer poisoning.
---

# Host Header Injection — Deep Hunting

## THE GATE
Crown jewels: password-reset poisoning → ATO (build reset link from `Host`); unkeyed `Host`/`X-Forwarded-Host` reflected into absolute URLs (script src, link, redirect) + cacheable → mass poison; routing-based SSRF; path-override ACL bypass; OAuth/OIDC issuer poisoning.

## Payload Ladder
`Host: evil.com`; `X-Forwarded-Host: evil.com`; `X-Host`; dual-Host (second wins — `Host: target` + `Host: evil.com` via raw socket); absolute-URL injection (`Host: target.evil.com`); trailing-port/userinfo (`Host: target:1@evil.com`). Use a Collaborator host so token capture is OOB proof.

## Two SSRF Mechanisms — Do NOT Conflate
**Routing-based SSRF**: *path on the request line*, `Host: 169.254.169.254` → `curl /latest/meta-data/ -H "Host: 169.254.169.254"`; GCP `Host: metadata.google.internal` + `Metadata-Flavor: Google`; Azure + `Metadata: true`; blind = point Host at Collaborator.
**Path-override**: real Host stays, `X-Original-URL: /admin` / `X-Rewrite-URL:` (IIS/ASP.NET/Spring Cloud Gateway) — bypasses edge ACL, never composes with routing SSRF.

## False-Positive Killers
Reflected ≠ cached (check `Vary`; if Vary lists the header it's keyed = not poisonable); cached-for-you ≠ cached-for-others (second egress IP); `Age:0`+MISS = no shared cache; 200 echoing your Host ≠ SSRF unless body is from internal target or Collaborator fired; some mailers rewrite to fixed `SITE_URL` — verify the email body, not the HTTP response. OAuth: auth code/token must actually arrive at attacker host.

## PARAMETER COVERAGE — every host-derived input (MANDATORY)
The #1 miss: testing only the primary `Host` header and skipping the rest of
the host/forwarding surface. Poisoning hides in `X-Forwarded-Host`,
`X-Forwarded-Server`, `X-Host`, `X-Original-URL`, `X-Rewrite-URL`,
`X-Forwarded-For` (mailers/URL builders), and query params like `?redirect=`
that inherit the host.

1. **Enumerate** every host/forwarding input: `Host`, `X-Forwarded-Host`,
   `X-Host`, `X-Forwarded-Server`, `X-Forwarded-Proto`, `X-Original-URL`,
   `X-Rewrite-URL`, `Forwarded`, absolute-form request line, and Host-derived
   query/redirect params.
2. **Sweep each** with the payload ladder: plain evil, dual-Host (raw socket),
   absolute-URL, userinfo `target:1@evil`, port variants, and scheme swaps —
   on EVERY host-derived surface (reset links, redirects, absolute URL
   generation, cache keys, OAuth issuer).
3. **Routing SSRF**: test `Host: 169.254.169.254` / `metadata.google.internal`
   (+`Metadata-Flavor`) / Azure (+`Metadata: true`) and blind Collaborator on
   EACH host input, not just `Host`.
4. **Path-override ACL bypass**: `X-Original-URL`/`X-Rewrite-URL: /admin` on
   every edge-protected route.
5. **Observe all dimensions per test**: reflected-into-URL vs not, `Vary`
   headers (keyed vs not), cache status (`Age`/`X-Cache`/`CF-Cache-Status`),
   and actual email body (not HTTP response) for reset poisoning.
6. **Re-sweep per route** (login, reset, callback, redirect, static) and per
   auth context.
7. **Track** `route → header → payload → result` in the journal; every
   unlogged header = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: host-header — 234 disclosed H1 reports (100 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `_m`
- `name`
- `content`
- `state`
- `rcnum`
- `url`
- `start`
- `config`
- `callCount`
- `c0-scriptName`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Multiple HTTP Smuggling reports** (HTTP Request Smuggling)
  - Signal: Theses reports spreads other several years and are all about **HTTP Smuggling issues** (HTTP Requests or Responses splitting, Cache Poisoning, Security filter bypass). I've made re
- **[critical] [meemo-app] Denial of Service via LDAP Injection** (LDAP Injection)
  - Signal: I would like to report `Denial of service via LDAP Injection` vulnerability in `meemo-app` module. It allows a malicious attacker to send a crafted input that is interpreted as an 
- **[critical] [cloudron-surfer] Denial of Service via LDAP Injection** (LDAP Injection)
  - Signal: I would like to report `Denial of service via LDAP Injection` vulnerability in `cloudron-surfer` module. It allows a malicious attacker to send a malformed input that is interprete
- **[critical] Authentication bypass on auth.uber.com via subdomain takeover of saostatic.uber.com** (Improper Authentication - Generic)
  - Signal: ## Summary This is not a standard vulnerability, but a chain of two more exotic vulnerabilities leading to a full authentication bypass of your SSO login system at auth.uber.com (v

