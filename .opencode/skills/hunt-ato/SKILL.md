---
name: hunt-ato
description: Account takeover hunting — 9 attack paths (host-header reset poisoning, Referer leak, IDOR email change, password-change without step-up, security-question brute, SSO subdomain takeover, JWT paths, session fixation), OOB confirmation discipline, login oracle (AADSTS code semantics), validation that a real takeover of a test account B from attacker A's session happens. Use when reset flows, email change, password change, SSO redirect_uri, or JWT endpoints exist. Trigger keywords: ATO, account takeover, password reset, email change, session hijack, takeover chain.
---

# Account Takeover — Deep Hunting (9 Paths)

## The Paths
1. **Host-header reset poisoning**: swap `Host`, `X-Forwarded-Host`/`X-Host`/`X-Forwarded-Server`, or dual-Host smuggling; reset mailer builds link from request Host. **Confirmation = OOB (Collaborator DNS in the email), not response-based** — read the actual email; reflected header alone is a false-positive killer.
2. **Referer leak**: reset token in URL + callback page loads third-party resource → full `Referer:` exfil. Also 302-to-open-redirect carrying token.
3. **IDOR-driven email change** (zero victim interaction, most reliable): `PATCH /api/users/{victimB_uid} {"email":"attacker@evil.com"}` with A's session → trigger reset → link lands at attacker → full ATO. Silent — API not UI.
4. **Password-change without step-up + login oracle**: no current-password/MFA gate = persistence multiplier; bcrypt-vs-fast-reject timing gap sorts candidate passwords.
5. **Security-question brute + OSINT**: answers (birth city, pet, school) are OSINT-able — no brute needed.
6. **SSO subdomain takeover at `redirect_uri`**: provider accepts `*.target.com`; find dangling CNAME → claim on Heroku/S3 → host callback → victim's `?code=` lands on attacker host. **OOB proof: code must actually arrive and exchange for token.**
7. **JWT paths**: alg:none, RS256→HS256 with JWKS public key, hashcat `-m 16500`, `kid` path-traversal/SQLi.
8. **Session fixation**: GET pre-auth session → login carrying it; force arbitrary ID accepted = Critical.
9. **Legacy protocol endpoints**: `/_vti_bin/Authentication.asmx`, `/xmlrpc.php`, `/rest/auth/1/session` (no rate limit/MFA) — see hunt-auth-bypass.

## Validation
Real takeover of test account B from attacker A's session, fresh-browser 10-min walkthrough. JSON-parse error bodies — `AADSTS50076` claims-challenge contains a literal `access_token` substring that is NOT a usable token.

## Common Mistakes
Claiming ATO that needs victim click + creds + CAPTCHA (drops to Medium/self-XSS tier); self-account-only impact; rate-limit-only findings on `/forgot-password` (rejected — impact is token guessing).

## PARAMETER COVERAGE — every ATO-path field (MANDATORY)
The #1 miss: testing only the email field on the reset form and skipping the
rest of each ATO path's request surface.

1. **Path 1 (reset poisoning)** — enumerate reset-request fields (email,
   `type`/channel, redirect/return) AND headers (Host, X-Forwarded-Host,
   X-Host, X-Forwarded-Server, dual-Host, User-Agent) — sweep the host ladder
   across EACH, verify the actual email (OOB), not the HTTP response.
2. **Path 3 (IDOR email change)** — enumerate the email-change surface: every
   endpoint and every field (email, user_id in body/query, nested JSON, no
   `current_password`), swap victim IDs on EACH write and check silent
   blind-IDOR success.
3. **Path 4 (password change)** — test no-step-up on EVERY credential-change
   endpoint (password, email, phone, security questions, backup codes) with
   and without MFA present.
4. **Path 6 (SSO)** — redirect_uri full taxonomy + state/PKCE on every
   authorize surface; claim dangling CNAMEs into the allowlist.
5. **Path 7 (JWT)** — sweep alg/key/kid/claim attacks on every token surface.
6. **Path 8 (fixation)** — every pre-auth cookie accepted into post-login.
7. **Every path: re-sweep per user context** (A vs B) — real takeover of test
   account B from A's session is the bar.
8. **Track** `path → endpoint → field/header → result` in the journal; every
   unlogged field = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: ato — 677 disclosed H1 reports (254 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `email`
- `client_id`
- `token`
- `type`
- `username`
- `userId`
- `id`
- `Password`
- `state`
- `name`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] RCE on Steam Client via buffer overflow in Server Info** (Classic Buffer Overflow)
  - Signal: ## Introduction In Steam and other valve games (CSGO, Half-Life, TF2) there is a functionality to find game servers called the server browser. In order to retrieve the information 
- **[critical] Authentication bypass on auth.uber.com via subdomain takeover of saostatic.uber.com** (Improper Authentication - Generic)
  - Signal: ## Summary This is not a standard vulnerability, but a chain of two more exotic vulnerabilities leading to a full authentication bypass of your SSO login system at auth.uber.com (v
- **[critical] Stealing Zomato X-Access-Token: in Bulk using HTTP Request Smuggling on api.zomato.com** (HTTP Request Smuggling)
  - Signal: # Intro Hi Zomato Security Team! My name is Evan Custodio and this is my first time evaluating your platform. I specialize in looking for server-side vulnerabilities. Recently I've
- **[critical] Pre-Auth Blind NoSQL Injection leading to Remote Code Execution** (None)
  - Signal: **Summary:** The `getPasswordPolicy` method is vulnerable to NoSQL injection attacks and does not require authentication/authorization. It can be used to take over accounts by leak

