---
name: hunt-session
description: Session management hunting — two-session rule (real captured sessions, never placeholders), session fixation (force arbitrary ID = Critical), invalidation-on-logout body-diff, invalidation on password/email change (sibling-session survival = persistent ATO), refresh-token rotation + reuse-detection, DBSC downgrade, JWT-as-session (exp/jti absence), entropy measurement, cookie attribute signals. Use when auth cookie/session logic, refresh tokens, or logout behavior are in scope. Trigger keywords: session fixation, session invalidation, refresh token, logout, cookie flags, entropy.
---

# Session Management — Deep Hunting

## THE TWO-SESSION RULE (house discipline)
Every fixation/invalidation claim proven with TWO real captured sessions (A = attacker/stolen, B = victim), never hardcoded placeholders. Capture real cookies from curl jars.

## Attack Vectors
- **Session fixation**: GET pre-auth session → login carrying it → if value unchanged AND now authenticated, fixation. Stronger: force arbitrary ID (`session=AAAAdeadbeefAAAA`) — attacker-controlled ID accepted = Critical, no XSS needed.
- **Invalidation on logout**: replay old cookie explicitly (not the jar), **body-diff** against authenticated baseline (200 means nothing without A's unique identity marker: email, user-id, CSRF token).
- **Invalidation on password/email change** (highest-paid): A and B logged into the SAME test account; B changes password; replay A's pre-change session. Sibling-session survival = persistent-ATO primitive. Test logout-all-devices too.
- **Refresh-token rotation + reuse-detection**: rotate once (RT1→RT2), replay old RT1, then check RT2 — correct BCP kills the entire token family; no-rotation or replay-survives = long-lived stealable credential.
- **DBSC downgrade**: strip `Sec-Session-Registration`/device-bound proof, replay plain cookie — if accepted, device-binding is advisory.
- **JWT-as-session**: missing `exp`/`jti` → no server revocation; logout then replay same JWT against `/api/me` still 200 = not server-revocable.
- **Entropy**: 200+ freshly-issued IDs, decode for counter/timestamp/userId structure; NIST ≥64 bits.

## Cookie Attribute Signals
Missing `__Host-` prefix = fixatable from any subdomain; `SameSite=Lax` alone = bypassable via sibling-subdomain top-level nav (Argo CD CVE-2024-22424); `SameSite=None` without Secure.

## Validation
Body-diff never status-only; negative control must fail where surviving cookie succeeds; OOB confirmation for theft chains.

## Common Mistakes
Treating 200 as proof (cached/edge/SPA shell); missing the second-cookie stable session; attribute gaps reported standalone as High (Low/Info until chained to XSS/CSRF/MITM).

## PARAMETER COVERAGE — every session credential (MANDATORY)
The #1 miss: testing only the main session cookie and skipping the rest of the
session surface. Bugs hide in every cookie, every header, and every token field.

1. **Enumerate** every credential surface: ALL cookies (auth, CSRF, tracking,
   language, device, `SAMLResponse`), `Authorization` header (Bearer/refresh),
   `X-Session`/`X-User` headers, remember-me tokens, refresh-token body fields,
   and JWT-as-session query/header params.
2. **Sweep each** with the session ladders:
   - fixation: capture pre-auth value → login → value unchanged & authed? and
     force an arbitrary value (`session=AAAAdeadbeefAAAA`)
   - invalidation-on-logout: replay each old cookie explicitly and body-diff
     against the authenticated baseline (unique identity marker, never 200 alone)
   - invalidation-on-change: two sessions on the same account; change
     password/email; replay the other session
   - refresh tokens: rotation + reuse-detection on each refresh endpoint
   - DBSC: strip `Sec-Session-Registration`/device proof, replay plain cookie
   - JWT: missing `exp`/`jti`; logout then replay → still 200?
   - entropy: 200+ samples per token field, decode structure, measure bits
   - cookie attributes: `__Host-`/`__Secure-` prefix, `SameSite`, `Secure`,
     `HttpOnly` on every cookie
3. **Re-sweep per endpoint** — a session cookie may be validated on
   `/api/me` but not on `/api/export` (sibling-function rule).
4. **Track** `endpoint → credential → technique → result` in the journal;
   every unlogged credential = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: session — 135 disclosed H1 reports (34 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `oauth_token`
- `token`
- `name`
- `id`
- `redirectUrl`
- `message`
- `strategy`
- `email`
- `error`
- `deviceUdid`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] .git folder exposed [HtUS]** (Information Disclosure)
  - Signal: Heyy there, I have found a exposed .git folder on https://█████ https://████████/.git/config ``` [core] repositoryformatversion = 0 filemode = true bare = false logallrefupdates = 
- **[critical] [meemo-app] Denial of Service via LDAP Injection** (LDAP Injection)
  - Signal: I would like to report `Denial of service via LDAP Injection` vulnerability in `meemo-app` module. It allows a malicious attacker to send a crafted input that is interpreted as an 
- **[critical] [cloudron-surfer] Denial of Service via LDAP Injection** (LDAP Injection)
  - Signal: I would like to report `Denial of service via LDAP Injection` vulnerability in `cloudron-surfer` module. It allows a malicious attacker to send a malformed input that is interprete
- **[critical] Authentication bypass on auth.uber.com via subdomain takeover of saostatic.uber.com** (Improper Authentication - Generic)
  - Signal: ## Summary This is not a standard vulnerability, but a chain of two more exotic vulnerabilities leading to a full authentication bypass of your SSO login system at auth.uber.com (v

