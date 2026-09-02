---
name: param-coverage-discipline
description: MANDATORY per-parameter testing protocol — enumerate EVERY parameter on EVERY endpoint (query, path, JSON/form body recursive, headers, cookies, GraphQL args, WebSocket/gRPC fields), then apply the FULL payload ladder for each bug class (SQLi/BSQLi, NoSQLi, SSTI, CMDi, LFI, SSRF, XSS, XXE, mass-assignment, wrong-type, IDOR) to EACH parameter. Tracks coverage in a coverage matrix in the journal, forbids skipping "safe-looking" params (IDs, counts, booleans, timestamps, page/limit, sort/order), observes ALL response dimensions (status, body, body-size, headers, timing, state), and re-sweeps per auth context. Use whenever ANY parameter-based bug hunting starts. Trigger keywords: parameter coverage, test every parameter, all parameters, per-parameter, parameter sweep, parameter matrix, missed bugs, exhaustive testing, every param.
---

# Parameter Coverage Discipline (MANDATORY)

## Why this skill exists
The #1 bug-loss failure mode across past engagements is **testing only the
"obvious" parameters and skipping the rest**. Injection and logic bugs hide in
EVERY parameter class: numeric IDs, booleans, counts, page/limit/offset,
sort/order, timestamps, format/`_`/callback tokens, nested JSON keys, headers,
cookies, path segments, file names, GraphQL args, WS/gRPC fields. **A skipped
parameter is a skipped bug.** This protocol is the enforcement mechanism.

## The rule
For EVERY endpoint touched, EVERY parameter is tested with EVERY payload
ladder applicable to the bug class being hunted. No parameter is exempt, no
parameter is "too small", none is "obviously safe".

## Step 1 — ENUMERATE the complete parameter set (BEFORE any payload)
Collect ALL input surfaces for each endpoint:
- **Query string**: every key, including `page`, `limit`, `offset`, `format`,
  `_`, `callback`, `sort`, `order`, `filter`, `q`, plus empty-key params.
- **Path**: every path segment, and its double/unicode-decoded forms.
- **JSON body**: every key, RECURSIVELY through nested objects and arrays
  (a bug often sits two levels deep).
- **Form body**: every field (`application/x-www-form-urlencoded`, multipart
  parts, file names).
- **Headers**: `User-Agent`, `Referer`, `X-Forwarded-For`, `X-Requested-With`,
  `Accept`, `Content-Type`, `Origin`, `Host`, `X-Host`, `X-Original-URL`,
  `X-Rewrite-URL`, any `X-*`.
- **Cookies**: every one (auth, tracking, CSRF, language).
- **GraphQL**: every argument of every field in the query/mutation, including
  aliases and nested input objects.
- **WebSocket / gRPC / SOAP**: every message key / field / XML element.

Record: `endpoint → full parameter list`. Build the **coverage matrix**
(rows = parameters, columns = payload classes). The matrix lives in the
engagement journal (NOTES.md) and is updated as you go.

## Step 2 — TEST EVERY PARAMETER, one at a time
For the class being hunted, run its FULL payload ladder on EACH parameter
while holding all others at baseline. One parameter mutated per request so a
signal is attributable. Class ladders (details in the hunt-* skill):
- **SQLi/BSQLi**: quote/error → boolean → time → UNION → error-based, on
  EVERY param — including numeric/ID/boolean params, not just search strings.
- **NoSQLi**: `$gt`/`$ne`/`$regex`/`$where` operator injection on EVERY JSON
  value and query-string key.
- **SSTI**: `{{7*7}}` `${{7*7}}` `#{7*7}` `<%=7*7%>` `*{7*7}` on EVERY param
  (name, bio, ID, slug, error field).
- **Command injection**: `;id` `|id` `` `id` `` `$(id)` `%0aid` on EVERY
  param — especially headers that reach logging/blocking/sendmail.
- **LFI/traversal**: `../../etc/passwd` + wrapper matrix on EVERY param,
  not just ones named file/path/template.
- **SSRF**: `http://127.0.0.1`, `http://169.254.169.254/`, collaborator on
  EVERY param — not just url-named ones (import, webhook, callback, image,
  pdf, feed all qualify, and so do plain string params).
- **XSS**: canary → context-specific payload on EVERY reflected param; blind
  XSS payloads in every stored field and header.
- **XXE**: DOCTYPE entity probe on EVERY body field (XML bodies AND
  JSON/uploaded DOCX/SVG).
- **Mass assignment**: `role`/`is_admin`/`verified`/`balance` on EVERY object
  write endpoint.
- **Wrong-type**: array/object/null/negative/oversized/NaN on EVERY param
  (error-handling + parser differentials).
- **IDOR/authz**: swap the object ID on EVERY object-ID param, and try
  type-confusion (string/number/array of IDs, base64, UUID, nested refs).
- **Open redirect**: `//evil.com` on EVERY redirect-ish param and on
  non-obvious ones (error=, return=, view=).
- **Host-header**: dual-Host, X-Forwarded-Host on EVERY Host-derived surface.

## Step 3 — TRACK COVERAGE (a skipped param is a lost bug)
- Journal every `endpoint → param → class → result`. Any parameter NOT logged
  = a gap = re-test before moving on.
- Diff the captured request corpus (HAR / proxy log / recorded curl) against
  the tested set to surface untested parameters.
- If a parameter is blocked (WAF, rate-limit, captcha, 403), note the reason
  and work the bypass ladder (encoding, case-mix, HTTP/2, alternate method,
  alternate content-type, chunked TE) instead of abandoning it.
- Re-sweep when the auth context changes: anonymous vs logged-in vs different
  role, free vs paid tier, web vs API vs mobile. A parameter is only "clean"
  in ONE context.

## Step 4 — OBSERVE EVERY RESPONSE DIMENSION
For every payload read ALL of: status code, body content, **body SIZE**,
response headers, timing, and any state change. Blind bugs show in ONE
dimension only: BSQLi = timing, boolean-based = body-size/status diff,
error-based = body content, mass-assignment = state change. A constant 200
body can still be a live blind sink — never stop measuring timing/body-size.

## Step 5 — DIFF AGAINST THE MAP
When a class sweep finishes, re-open the endpoint map and the captured
traffic. Any endpoint whose parameter set wasn't fully swept is flagged as a
gap and swept before moving on. Do not leave a target until every row of the
coverage matrix is filled for the classes in scope.

## Common Mistakes That This Protocol Kills
- Only testing `q=`/`search=`/`sort=` and skipping IDs, counts, booleans,
  page/limit, timestamps.
- Testing only the top-level JSON key and never nested objects/arrays.
- Stopping at the first clean parameter instead of sweeping all of them.
- Not re-testing after an auth-context change.
- Reading only status code and never body size / timing.
- Dropping a param on first WAF block instead of bypassing.

## Coverage of ACCESS-CONTROL GATES (401/403) — MANDATORY
A 401/403 response is a PARAMETER of the request as much as any query key:
it must be swept, not skipped. For every gated URL encountered during coverage:
1. Run the full **403/401 BYPASS CATALOGUE** (hunt-access-control): method
   fuzz → path-normalization (~40 variants) → trust-proxy headers →
   parameter/HPP → API-version downgrade → protocol/origin tricks. This is a
   coverage step, not an optional extra.
2. Run the **RATE-LIMIT BYPASS MATRIX** (hunt-brute-force §A–§H) on every
   rate-limited action — the limiter is a gate to bypass, not a reason to stop.
3. Log each gate's bypass attempt outcome in the coverage matrix
   (`route → family → trick → new status/body-diff`), exactly like a parameter.
4. Sweep the same gated route under EVERY auth context in scope (anonymous,
   user A, user B, admin) — the gate often holds for one identity shape and
   not another.
5. A non-401/403 response that differs from the baseline gate response is a
   candidate finding — validate with body-diff before recording.