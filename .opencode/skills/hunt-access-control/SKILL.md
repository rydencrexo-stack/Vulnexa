---
name: hunt-access-control
description: Hunt access control and IDOR vulnerabilities — broken access control, horizontal/vertical privilege escalation, authorization bypass, missing server-side authz checks, mass assignment, tenant isolation breaks, blind IDOR, GraphQL node() IDOR, method/version/header IDOR variants. Use when testing any endpoint with object IDs (numeric, UUID, base64, hashed), multi-tenant apps, role/privilege boundaries, or when a user can access another user's data. Trigger keywords: IDOR, access control, authorization, privilege escalation, broken access control, BOLA, object reference.
---

# IDOR & Access Control Hunting

> #1 most-paid web2 class — ~30% of paid submissions. IDOR = missing server-side authorization check on an object your request points at (an ID, filename, token, account number).

## THE GATE (before wasting time)
Random UUIDs feel safe but are frequently leaked elsewhere. A GUID is not a permission. Ask: "Where else does the app hand me someone else's identifier?" — list endpoints, search results, shared links, emails, autocomplete, websocket messages, `Location` headers on create.

## 10 IDOR Variants to Test

| Variant | What to Test |
|---|---|
| V1: Direct | Change object ID in URL path `/api/users/123` → `/api/users/456` |
| V2: Body param | Change ID in POST/PUT JSON body `{"user_id": 456}` |
| V3: GraphQL node | `{ node(id: "base64(OtherType:123)") { ... } }` |
| V4: Batch/bulk | `/api/users?ids=1,2,3,4,5` — request multiple IDs at once |
| V5: Nested | Change parent ID: `/orgs/{org_id}/users/{user_id}` |
| V6: File path | `/files/download?path=../other-user/file.pdf` |
| V7: Predictable | Sequential integers, timestamps, short UUIDs |
| V8: Method swap | GET returns 403? Try PUT/PATCH/DELETE on same endpoint |
| V9: Version rollback | v2 blocked? Try `/api/v1/` same endpoint |
| V10: Header injection | `X-User-ID: victim_id`, `X-Org-ID: victim_org`, `X-Account-Id` |

## Core Methodology (from the IDOR Playbook)

1. **Two accounts** — A (attacker), B (victim). Plant a unique searchable value in B's data.
2. **Baseline** — as A, capture a request returning your own object (e.g. `GET /api/invoices/1042`). Confirm clean 200. This is your control for what "authorized" looks like.
3. **Manual swap** — as A, change object ID to B's ID (and neighbors: 1041, 1043, 1000). Read response carefully:
   - `200` with B's data = confirmed IDOR. Screenshot + plant unique value.
   - `403/401` = authz working here. Retest with tricks below.
   - `404` = could be real "not found" OR disguised "not yours". Compare to genuinely nonexistent ID (`99999999`). Different responses leak object existence (weaker but reportable).
   - `302` to login/dashboard = often client-side redirect while JSON still leaks. Check raw body.
4. **Automate with Autorize** (Burp BApp) — set B's session cookie, browse as A normally. Autorize replays every request with B's low-priv session and color-codes. Set an "Enforcement Detector" string (e.g. `"Forbidden"`) for accuracy. Auth Analyzer does the same with multiple sessions.
5. **Enumerate at scale** — `seq 1000 2000 | ffuf --request req.txt -w - -ac`, diff responses by size/status. Pull 2-3 records max to prove, then STOP — no full customer dump.
6. **Break the "protected" cases** — method change, param pollution (`?id=1&id=2`), arrays (`id[]=1`), extra headers, path tricks (`/api/invoices/1043/`, `/api/invoices/1043.json`, `/api/../invoices/1043`).
7. **Non-numeric IDs** — decode base64/hex (`SW52b2ljZToxMDQy` → `Invoice:1042`), hashed IDs (MD5/CRC of small int = enumerable), predictable UUIDs (UUIDv1 = timestamp+MAC), leaky sibling endpoints (`/api/search?q=` returns other users' IDs = your enumeration source).
8. **Blind IDOR** — response says 200 OK with no data but the action happened: you changed another user's email, cancelled their order, triggered a notification. No data leak in response ≠ no impact. Test POST/PUT/DELETE that succeed silently.

## Mass Assignment / Parameter Tampering

- Add `role=admin`, `is_admin=true`, `admin=1` to registration/profile update JSON
- Add unexpected params: `?user_id=other_user`, `user[role]=admin`, `permissions=*`
- GraphQL: try setting role fields in mutation args
- Mass assignment = server accepts extra fields backend shouldn't (JSON body extra keys)

## Tenant Isolation (Multi-Tenant SaaS)

- Swap org/team/workspace IDs in headers, cookies, JWT claims, URL paths
- `X-Org-ID`, `X-Tenant-ID`, `org_id` in body
- Cross-tenant: create data in tenant A, read as tenant B
- Soft-deleted records still accessible by ID
- Cross-region or staging-to-prod data leakage

## IDOR Chains (higher payout)

- IDOR + Read PII = Medium
- IDOR + Write (modify other's data) = High
- IDOR + Admin endpoint = Critical (privilege escalation)
- IDOR + Account takeover path = Critical
- IDOR + Chatbot (LLM reads other user's data) = High
- GUID IDOR amplification: find an endpoint that leaks/lists GUIDs → leak + IDOR = full chain, higher severity

## Copy-Paste IDOR Checklist (run per feature touching user data)

- [ ] Two accounts created (A attacker, B victim) with unique searchable value in B
- [ ] Every object reference mapped: path, query, body, headers, cookies, GraphQL, filenames
- [ ] Baseline captured — own object returns 200 in Repeater
- [ ] Manual ID swap tested (neighbor IDs and B's real IDs)
- [ ] Autorize / Auth Analyzer run across the whole browse
- [ ] Numeric ranges swept with Intruder/ffuf, responses diffed by size and status
- [ ] 403/404 cases retried with method change, param pollution, arrays, extra headers, path tricks
- [ ] Non-numeric IDs decoded (base64/hex) and leak sources found for UUIDs
- [ ] GraphQL node/typed queries tested; mobile traffic proxied
- [ ] Write actions tested for blind IDOR (POST/PUT/DELETE that succeed silently)
- [ ] Impact proven with 2-3 records max, then stopped

## Common Fixes (for the remediation section of your report)
- Check ownership on every read AND write, server-side (centralized policy layer)
- Session-scoped lookups: `WHERE id = ? AND user_id = ?`
- Return same response for "not yours" and "not found"
- UUIDs are defense in depth, never a replacement for authz check

## PARAMETER COVERAGE — swap EVERY object reference (MANDATORY)
The #1 miss: testing only the "obvious" ID in the URL path and skipping every
other reference to an object. Authorization bugs hide in body IDs, nested
objects, query params, headers, cookies, filenames, GraphQL node IDs, and
type-confused values.

1. **Enumerate EVERY object reference per endpoint**:
   - path IDs (`/users/123`) AND the plural/action variants (`/users/123/favorites`)
   - JSON body IDs at every nesting level (top-level and inside nested objects/arrays)
   - query params (`?user_id=`, `?show=`, `?filter[owner]=`)
   - headers (`X-User-ID`, `X-Org-ID`, `X-Account-Id`, `X-Team-Id`)
   - cookies that encode identity/org
   - filenames (`/files/download?path=...`, multipart file names)
   - GraphQL arguments and `node(id:)`/typed IDs (decode base64 → swap type+id)
2. **Swap EACH one** with victim IDs AND neighbors (`-1`, `+1`, `1000`), for
   BOTH read (GET) and write (POST/PUT/PATCH/DELETE) — write IDOR is often
   silently blind (200, no data).
3. **For each swap observe all dimensions**: 200-with-data (confirmed), 403,
   real-404 vs disguised-404 (diff against `99999999`), 302 (check raw body for
   leaked JSON), and state changes (blind IDOR).
4. **Break protected cases per reference**: method swap, param pollution
   (`?id=1&id=2`), arrays (`id[]=2`), type confusion (string/number/array/base64/
   UUID), path tricks (`/id/`, `/id.json`, `/../id`), version rollback
   (`/api/v1/`).
5. **Re-sweep as a DIFFERENT role/user** — same endpoint can enforce authz for
   one tenant shape and not another (org-admin vs user, free vs paid).
6. **Track** `endpoint → reference → swap → result` in the journal; every
   unswapped reference = gap.

## 403 / 401 BYPASS CATALOGUE (run on EVERY gated URL — MANDATORY)
When any endpoint returns 401/403, run this catalogue (sources: Vidoc, HackTricks,
Pentestas forbidden_bypass, bitpanic). A bypass = a gate/backend normalization
mismatch. **Validation rule (from Pentestas detection logic)**: a bypass only
counts when the response differs from the baseline 403 — status in
{200,201,204,207,301,302,307,308} AND body-MD5 differs, AND (for 200) body ≥50
bytes AND ≥64 bytes different in size (WAFs return custom 403 as 200 with same
body). 3xx with a Location header = proof on its own. Always compare against the
BASELINE 403 response, one change per request.

### Family 1 — Path normalization (22 tricks, ~40 candidates)
For a blocked path `/admin`, test each as `/<TRICK>/admin`, `/admin/<TRICK>`,
`/<TRICK>admin`, and `admin/<TRICK>`:
| Trick | Example |
|---|---|
| Trailing | `/admin/`, `/admin/.`, `/admin/./`, `/admin/..` |
| Tomcat semicolon / matrix | `/admin..;/`, `/admin;/`, `/admin;jsessionid=x` |
| Encoded segments | `/admin/..%2f`, `/%2eadmin`, `/admin%20`, `/admin%09`, `/admin%00` |
| Dot tricks | `/%2e/admin`, `/%252e/admin` (double-encode), `/./admin`, `/../admin`, `//admin`, `/\admin` |
| Unicode slash | `/%ef%bc%8fadmin` (fullwidth solidus encodes to `/`) |
| Extension append | `/admin.json`, `/admin.html`, `/admin.css`, `/admin.js` (Spring <5.3 `useSuffixPatternMatch`) |
| Query / fragment | `/admin?`, `/admin#` |
| Case folding | `/ADMIN`, `/Admin`, `/aDmIn`, `/%75ser` |
| Null/control | `/admin%00`, `/..%00`, `/..%01`, `/..%0a`, `/..%0d`, `/..%09` |
| Home-dir | `/~root`, `/~admin` |

### Family 2 — Trust-the-proxy headers (15+ tricks)
Same path, ONE extra header per request (add each separately, value variants:
`127.0.0.1`, `localhost`, `10.0.0.1`, `172.16.0.0`, internal IPs):
- IP overrides: `X-Forwarded-For`, `X-Forward-For`, `X-Real-IP`, `X-Remote-IP`,
  `X-Remote-Addr`, `X-Originating-IP`, `X-Client-IP`, `Client-IP`,
  `True-Client-IP`, `Cluster-Client-IP`, `X-ProxyUser-Ip`, `X-Forwarded`,
  `Forwarded`, `Forwarded-For`, `Via`
- URL overrides: `X-Original-URL: /admin/console`, `X-Rewrite-URL: /admin/console`
- Host-based: `Host: localhost`, alternate virtual-host values, `X-Forwarded-Host`
- **Hop-by-hop abuse**: `Connection: X-Forwarded-For` (or any header name in the
  `Connection` header) makes intermediaries DROP that header before the backend
  sees it — use it to strip an edge-inserted header the backend trusts for auth.
  Also try `Connection: X-Original-URL`, `X-Rewrite-URL`, `X-Forwarded-Host`.

### Family 3 — HTTP method substitution (7+ methods)
The gate may only filter GET. Replay the same request as `POST`, `HEAD`,
`PATCH`, `OPTIONS`, `PUT`, `DELETE`, `TRACE`, `CONNECT`, and an invented method
(`FOO`). Note: HEAD 200 + `Content-Length: N` proves content exists even if
body isn't sent. Then test method-override headers on a POST:
`X-HTTP-Method-Override: GET/PUT`, `X-Method-Override:`, `X-HTTP-Method:`
(Spring/Rails/.NET route POST to the GET handler).

### Family 4 — Parameter manipulation (API-focused)
- Change value (`id=123`→`124`), add unused params (`&isAdmin=true`), reorder,
  remove optional params, boundary values (`0`, `-1`, `99999999`)
- **HPP / JSON pollution**: `user_id=ATTACKER&user_id=VICTIM`;
  `{"id":111}`→`{"id":[111]}`→`{"id":{"id":111}}` (type-confusion authz skip)
- **API version downgrade**: `/v3/users_data/1234` 403 → `/v1/users_data/1234` 200
- Add junk cache-buster params that the limiter/gate keys on but backend ignores

### Family 5 — Protocol / origin tricks
- Protocol downgrade: HTTP/2→1.1→1.0; on 1.0 REMOVE the Host header entirely
  (can flip gate behavior)
- Direct origin IP / CNAME: resolve the domain, hit the origin IP with
  `Host: target` — bypasses the CDN/WAF edge that enforces the rule
- CDN cached copies: if a restricted page was cached while public, the CDN
  serves it — check `archive.org/web` and cache status headers
- HTTP→HTTPS and HTTPS→HTTP scheme swap
- Request smuggling (CL.TE/TE.CL/H2 downgrade) to reach backend past the gate —
  see hunt-http-smuggling
- User-Agent fuzzing: alternate browser/OS UAs; some gates block only
  scanner/tool UAs
- Referer spoofing: some gates allow requests with an internal/valid Referer

### Ordered workflow per gated URL
1. baseline 403 captured (status + body MD5 + size)
2. method fuzz (all 8+ methods + override headers)
3. path-normalization sweep (all ~40 variants)
4. header sweep (all trust-proxy headers, one per request)
5. parameter manipulation + HPP + version downgrade
6. protocol/origin tricks (downgrade, origin IP, scheme swap)
7. any non-403/401 response that differs from baseline = candidate → validate
   with body-diff and confirm the protected content is actually served
8. Track `url → family → trick → new status/body-diff` in the journal.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: access-control — 712 disclosed H1 reports (256 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `scope`
- `search`
- `group_id`
- `repository_ref`
- `snippets`
- `authenticity_token`
- `state`
- `type`
- `url`
- `name`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Project Template functionality can be used to copy private project data, such as repository, confidential issues, snippets, and merge requests** (Privilege Escalation)
  - Signal: I've found a three minor vulnerabilities which, when combined, allow an attacker to copy private repositories, confidential issues, private snippets, and then some. I'll go through
- **[critical] One-click account hijack for anyone using Apple sign-in with Reddit, due to response-type switch + leaking href to XSS on www.redditmedia.com** (Improper Access Control - Generic)
  - Signal: Hi, # Description I've been researching new ways to steal OAuth codes and access-tokens using postMessage, and I found a way for me to steal the code and/or access-token from Apple
- **[critical] Unauthenticated Access to Admin Panel Functions at https://███████/███** (Improper Access Control - Generic)
  - Signal: **Description:** The admin panel at https://██████████/████████ and all its functions can be accessed without authentication. This is basically the same vulnerability as in #139491
- **[critical] Unauthenticated Access to Admin Panel Functions at https://██████████/████████** (Improper Access Control - Generic)
  - Signal: **Description:** I discovered that the admin panel at https://████/█████ and all its functions can be accessed without authentication. ## Impact An attacker is able to use the admi

### Class: idor — 274 disclosed H1 reports (89 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `id`
- `message`
- `userId`
- `Password`
- `PID`
- `RNo`
- `username`
- `ConfirmPassword`
- `passChange`
- `__RequestVerificationToken`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Remove Every User, Admin, And Owner Out Of Their Teams on developers.mtn.com via IDOR + Information Disclosure** (Insecure Direct Object Reference (IDOR))
  - Signal: Hello world, This vulnerability is too involved with regular users, in order for us to prevent any damage, we need 3 different user accounts we own. This gives us specific "user_id
- **[critical] Access to all █████████ files, including CAC authentication bypass** (Insecure Direct Object Reference (IDOR))
  - Signal: **Summary:** Due to an Insecure Direct Object Reference (IDOR) in adding recipients to a shared package on ██████████, an unauthenticated attacker can access all files uploaded to 
- **[critical] IDOR on update user preferences** (Insecure Direct Object Reference (IDOR))
  - Signal: ## Summary: Team member with role USER can change data of any user in the team, or steal his cookies, or steal the account of victim via forget password function. ## Steps To Repro
- **[critical] █████████ IDOR leads to disclosure of PHI/PII** (Insecure Direct Object Reference (IDOR))
  - Signal: **Summary:** ████ is designed in a way where there is a vulnerable endpoint that allows a non-medical user to view the ██████████ records of people who are not ████████s of the spo

