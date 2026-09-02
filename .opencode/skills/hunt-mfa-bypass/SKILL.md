---
name: hunt-mfa-bypass
description: MFA bypass hunting — prefix oracle (OTP digit-by-digit, collapses 10^6 → ~60 guesses), single-session discipline (re-login regenerates OTP), OTP race TOCTOU via single-packet, skip-MFA-step (pre-MFA cookie, middleware-gated route), OTP replay, response manipulation, backup-code dump via /api/me, remember-device trust escalation. Use when OTP/TOTP/MFA verification endpoints exist. Trigger keywords: MFA bypass, OTP, TOTP, 2FA, prefix oracle, backup codes.
---

# MFA Bypass — Deep Hunting

## THE GATE — Prefix Oracle (highest value, non-obvious)
Many apps validate OTP prefix-by-prefix rather than all-or-nothing. Submit 1–3 digit partial codes; a "correct prefix" gives a distinct response. Walking digits collapses 10^6 → ~60 guesses. Some apps award success on a single correct first digit — sweep `0-9` first.

**Critical discipline: stay in ONE session** — re-login regenerates the OTP and destroys prefix progress.

## Attack Vectors
- **OTP race (TOCTOU)**: fire ~30 concurrent same-OTP submissions via single-packet HTTP/2 (Turbo Intruder) before the server marks it used; 2 requests almost always resolve sequentially (false negative).
- **Skip MFA step**: after password, "pre-MFA" cookie issued → hit `/dashboard` directly. MFA is middleware-gated on `/mfa` only, not on the resource route.
- **OTP replay**: same code accepted twice after logout/re-login (not invalidated).
- **Response manipulation**: change `{"success":false}`→`true` — proves client-side-only check.
- **Backup-code dump via `/api/me`**: user object returns plaintext `backup_codes` array.
- **Backup codes**: 36^8 ≈ 2.8T too large, but 6–8 digit numeric = feasible with no rate limit.
- **Remember-device trust escalation**: capture "remember device" cookie, present from new IP/UA → not bound.

## Key Payloads
`{"otp":"FUZZ"}` full `000000-999999` ffuf sweep `-t 5`; `otp=1`, `otp=12` prefix sweeps.

## Detection
Trace every auth state transition in Burp; check MFA is per-endpoint not just middleware; check OTP entropy + rate limit on the verify endpoint specifically.

## Validation
Attacker session reaching post-MFA state is the proof; session token or protected resource data without MFA completion.

## Severity
Standalone MFA bypass is High; chained with password oracle is Critical (attacker already needs password). Don't claim Critical when attacker already needs password.

## PARAMETER COVERAGE — every MFA/OTP field (MANDATORY)
The #1 miss: testing only the `otp`/`code` field and skipping the rest of the
MFA surface.

1. **Enumerate** every field of every MFA endpoint: `otp`/`code`/`pin`/`token`
   (SMS/email/TOTP/app/backup), `type`/`factor`/`method`, `remember`/
   `remember_device`, `user_id`/`session`/`state`, `challenge`/`challenge_id`,
   `backup_code`, nested JSON keys, and headers (`X-Forwarded-For`,
   `User-Agent`, cookies).
2. **Sweep each field**:
   - prefix oracle on EVERY otp/code/backup field (`0-9`, then walking digits)
     — stay in ONE session (re-login regenerates OTP and destroys progress)
   - OTP race (single-packet, ~30 concurrent, one TCP segment) on each verify
   - replay same code after logout/re-login on each
   - response-manipulation (`success:false`→`true`) on each
   - `type`/`factor` switch: change SMS→email→app→backup and watch for weaker
     validation or token-in-response
   - skip-MFA: hit post-MFA resources directly (pre-MFA cookie) on EACH route
   - remember-device: capture cookie → present from new IP/UA on each
   - `/api/me`-style objects: look for plaintext backup codes
3. **Rate-limit the verify endpoint itself** (not just login) per field.
4. **Re-sweep per auth context** (password-only vs MFA users) and per endpoint.
5. **Track** `endpoint → field → technique → result` in the journal; every
   unlogged field = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: mfa-2fa — 223 disclosed H1 reports (70 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `client_id`
- `state`
- `redirect_uri`
- `response_type`
- `oauth_token`
- `url`
- `scope`
- `query`
- `next`
- `Password`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] HTML injection in API response including request url** (Remote File Inclusion)
  - Signal: Hi Reddit , I found a way to distribute, persist & store Illegal images such as child porn , beheadings on reddit and in plain sight . I can also store & distribute xml ,json data 
- **[critical] Remotely trigger an assertion on a TLS server with a malformed certificate string** (Improper Certificate Validation)
  - Signal: **Summary:** Connecting to a NodeJS TLS server with a client certificate that has a type 19 string in its subjectAltName will crash the TLS server if it tries to read the peer cert
- **[critical] Lodash "difference" (possibly others) Function Denial of Service Through Unvalidated Input** (Uncontrolled Resource Consumption)
  - Signal: > NOTE! Thanks for submitting a report! Please replace *all* the [square] sections below with the pertinent details. Remember, the more detail you provide, the easier it is for us 
- **[critical] Leaking sensitive information on Github lead full access to all Grab Slack channels** (Information Disclosure)
  - Signal: #Summary: Accidental leakage of secret keys in such code repositories is a real problem, after my report #387117, I decided to dig deeper than the previous report and looking to so

### Class: verification-bypass — 305 disclosed H1 reports (91 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `email`
- `id`
- `Password`
- `token`
- `ConfirmPassword`
- `nonce`
- `password`
- `client_id`
- `authenticity_token`
- `dhl`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] .git folder exposed [HtUS]** (Information Disclosure)
  - Signal: Heyy there, I have found a exposed .git folder on https://█████ https://████████/.git/config ``` [core] repositoryformatversion = 0 filemode = true bare = false logallrefupdates = 
- **[critical] Exim use-after-free vulnerability while reading mail header involving BDAT commands** (Use After Free)
  - Signal: Original article is [here](https://devco.re/blog/2017/12/11/Exim-RCE-advisory-CVE-2017-16943-en/) # Use-after-free in receive_msg leads to RCE ### Vulnerability Analysis To explain
- **[critical] [meemo-app] Denial of Service via LDAP Injection** (LDAP Injection)
  - Signal: I would like to report `Denial of service via LDAP Injection` vulnerability in `meemo-app` module. It allows a malicious attacker to send a crafted input that is interpreted as an 
- **[critical] Authentication bypass on auth.uber.com via subdomain takeover of saostatic.uber.com** (Improper Authentication - Generic)
  - Signal: ## Summary This is not a standard vulnerability, but a chain of two more exotic vulnerabilities leading to a full authentication bypass of your SSO login system at auth.uber.com (v

