---
name: hunt-api-misconfig
description: API misconfiguration hunting — mass assignment, prototype pollution hunt sequence, server-side parameter pollution (SSPP) with encoded traversal, OData attack surface ($filter oracle, $batch hiding, CVE-2019-17554 XXE), Swagger/OpenAPI exposure chains (configUrl takeover), CORS reflect-alone discipline. Use when REST APIs, OData, Swagger, or JSON-processing endpoints are present. Trigger keywords: mass assignment, prototype pollution, SSPP, OData, swagger, API misconfig.
---

# API Misconfiguration — Deep Hunting

## Attack Vectors
- **Mass assignment**: `{is_admin:true, role:admin, verified:true}` on profile/account/reset — server blindly applies `req.body`. DTO schema from swagger feeds this.
- **JWT (non-crypto)**: alg:none (empty signature), RS256→HS256 confusion (sign with server's public key from `/.well-known/jwks.json` as HMAC secret).
- **Prototype pollution hunt sequence**: find merge/object-update endpoint → pollute harmless marker `{"__proto__":{"polluted":"pp-1337"}}` → trigger separate sink → escalate via learned properties (`isAdmin:true`, `shell:/bin/bash, argv0:node, NODE_OPTIONS:--inspect`, `execArgv:["--eval","..."]`).
- **Server-side parameter pollution (SSPP)**: input interpolated into backend URL. Send `# ? & / ..` + encoded forms (`%23 %3f %26 %2f %2e%2e%2f`); then traverse/append route fragments: `administrator%23`, `administrator/../victimuser`. Errors (`Invalid route`) are routing feedback — map the internal API.
- **OData**: blind extraction via `$filter=startswith(adx_identity_passwordhash,'a')` (response cardinality / `@odata.count` is the oracle); `$orderby`/`$select` column-ACL bypass; `$batch` multipart/mixed hides inner ops from WAFs; encoded `%24filter` bypasses signatures; `$expand` navigation-property IDOR (PowerApps Portals class). CVEs: **CVE-2019-17554** (Apache Olingo 4.0.0–4.6.0 XXE), **CVE-2018-8269** (deep `$filter` recursion DoS).
- **Swagger/OpenAPI exposure**: `/swagger/v1/swagger.json`, Spring `/v2/api-docs`,`/v3/api-docs`, FastAPI `/docs`,`/openapi.json`, Quarkus `/q/openapi`, GraphQL `/graphiql`. Chains: spec→mass IDOR/BOLA, hidden `/internal/*` routes, **`?configUrl=` takeover** (attacker spec, victim's "Try It Out" fires same-origin authenticated requests). CVEs: **CVE-2018-25031** (Swagger UI ≤4.1.2 spec injection), DOM XSS 3.14.1→3.38.0.

## Config Worth Stealing
JWKS public key, OpenAPI `components.schemas`, OData `$metadata` full schema.

## Fingerprinting
`OData-Version: 4.0` / `DataServiceVersion: 3.0`; paths `/_api/`, `/odata/`, `/api/data/v9.x/`, `/sap/opu/odata/`; Swagger UI version banner.

## Validation
Pollution must reach a later operation (not just 200); OData oracle needs demonstrable data extraction; CORS reflect-alone is informational — prove actual credentialed cross-origin read; spec exposure is a *primitive* — chain to a working attack.

## Common Mistakes
Stopping at 200 on `__proto__`; treating swagger disclosure as the finding itself; assuming SQLi keyword WAFs block OData.

## PARAMETER COVERAGE — EVERY endpoint, EVERY key (MANDATORY)
The #1 miss: testing mass assignment only on the "obvious" profile/reset
endpoint and pollution only on the one merge endpoint you found. API
misconfigs hide on every write endpoint and in every nested key.

1. **Mass assignment — EVERY object write**: on each POST/PUT/PATCH body, add
   `role`, `is_admin`, `admin`, `verified`, `approved`, `balance`, `price`,
   `status`, `owner_id`, `org_id`, `group_id`, `permissions` to the payload —
   including nested objects (`user[role]=admin`) and unexpected top-level keys.
2. **Prototype pollution — EVERY object-merge/update endpoint**: inject
   `{"__proto__":{"polluted":"pp-1337"}}`, `{"constructor":{"prototype":{...}}}`
   and query-string `?__proto__[x]=1`/`constructor[prototype][x]=1` on each,
   then TRIGGER a later read to confirm pollution reached a sink (200 on the
   inject is not proof).
3. **SSPP — every param that is interpolated into a backend URL**: send
   `# ? & / ..` and encoded forms (`%23 %3f %26 %2f %2e%2e%2f`), observe
   routing/error feedback, map the internal API, then traverse/append route
   fragments on EACH param.
4. **OData** — apply `$filter`/`$select`/`$orderby`/`$batch`/`$expand`/encoded
   `%24filter` to EVERY endpoint under `/odata`, `/_api`, `/api/data/`; treat
   response cardinality as the blind oracle; test each key with
   `startswith(col,'a')`.
5. **Swagger/OpenAPI** — once a spec is found, diff the documented schema
   against the ACTUAL accepted body: every documented key is a mass-assignment
   candidate and every hidden route is a shadow-API candidate.
6. **Re-sweep per auth context** (anon/role A/role B) — DTO schemas often
   tighten per role.
7. **Track** `endpoint → key → technique → result` in the journal; every
   unlogged key = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: spa-api — 703 disclosed H1 reports (225 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `id`
- `client_id`
- `type`
- `name`
- `sentry_key`
- `_m`
- `oauth_token`
- `iclLayout`
- `state`
- `key`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] HTML injection in API response including request url** (Remote File Inclusion)
  - Signal: Hi Reddit , I found a way to distribute, persist & store Illegal images such as child porn , beheadings on reddit and in plain sight . I can also store & distribute xml ,json data 
- **[critical] [hta3] Remote Code Execution on ████** (Code Injection)
  - Signal: **Note** In the days leading up to this event, I looked at `███████` due to the ████████ press release which described this as the scope for this event. I understand that this is o
- **[critical] .git folder exposed [HtUS]** (Information Disclosure)
  - Signal: Heyy there, I have found a exposed .git folder on https://█████ https://████████/.git/config ``` [core] repositoryformatversion = 0 filemode = true bare = false logallrefupdates = 
- **[critical] Multiple HTTP Smuggling reports** (HTTP Request Smuggling)
  - Signal: Theses reports spreads other several years and are all about **HTTP Smuggling issues** (HTTP Requests or Responses splitting, Cache Poisoning, Security filter bypass). I've made re

