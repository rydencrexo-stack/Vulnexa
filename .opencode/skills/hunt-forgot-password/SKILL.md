---
name: hunt-forgot-password
description: Password reset flow hunting — username enumeration via response differential, token in API response body, token replay after consumption, token not bound to session/IP, predictable reset tokens (base64, numeric, sequential, MD5-of-timestamp), no rate limit, expiry angles. Use when a reset/forgot-password flow exists. Trigger keywords: forgot password, password reset, reset token, token exposure, enumeration.
---

# Password Reset Flow — Deep Hunting

## THE GATE
Trace full flow request→token→use. Content-type matters — JSON REST vs `x-www-form-urlencoded` form (check login page HTML).

## Attack Vectors
- **Username enumeration via response differential** (fastest win): POST clearly-invalid email vs known email; compare message text, status, body length, or timing (fast "no user" vs slow "email queued").
- **Token exposed in API response body**: forgot-password endpoint returns token/link/code directly in JSON → immediate ATO.
- **Token replay after consumption**: complete reset cycle, resubmit the same consumed token → 200 = not invalidated (the High finding).
- **Token not bound to session/IP**: token accepted from any browser/IP → link-forwarding ATO.
- **Predictable reset tokens**: `base64(email+timestamp)` decodable; 4–6 digit numeric = ~10K guesses; sequential `token=1234`→`1235`; MD5-of-timestamp.
- **No rate limit**: 10–20 rapid requests, no 429/lockout/CAPTCHA → enumeration + token flooding.
- **Expiry**: 24h-old token still valid = phishing persistence.

## Key Payloads
`email=nonexistent@fakedomain12345.com` baseline probe; `base64 -d` decode tokens; `seq -w 000000 999999` for numeric token brute.

## Validation
Enumeration = measurably different response (body/status/length) reproducible; token exposure = token in response body; replay = second successful use of consumed token.

## Common Mistakes
Reporting enumeration alone as High (it's Medium); missing replay test (the High finding); forgetting token-expiry; confusing this with host-header poisoning (that's hunt-host-header) — this skill proves the recovery-flow primitive, chains live in hunt-ato.

## PARAMETER COVERAGE — every field of the reset flow (MANDATORY)
The #1 miss: testing only the `email`/`username` field and skipping the rest
of the request. Reset-flow bugs hide in every field: `email`/`username`
(enumeration), `token`/`code`/`hash`/`reset_key` (replay/format/brute),
`type`/`method` (email-vs-SMS switch), `redirect`/`callback`/`next` (open
redirect → token leak), headers (`Host`, `X-Forwarded-Host`, `User-Agent`,
`X-Forwarded-For`), cookies.

1. **Enumerate** every field of each reset endpoint: request-password,
   verify-token, set-new-password, and any OTP/resend/verify step.
2. **Sweep each field**:
   - `email`/`username`: enumeration differentials (message/status/length/timing)
   - `token`/`code`: replay after consumption, reuse across accounts, format
     analysis (base64/numeric/sequential/MD5), length for brute math
   - `type`/`method`: switch delivery channel and watch for token-in-response
   - `redirect`/`callback`: open-redirect ladder (`//evil`, `@evil`, backslash)
     — the leaked token in the redirect target is the chain
   - headers: Host/X-Forwarded-Host on the reset link generation (→ ATO);
     X-Forwarded-For for rate-limit bypass on the code endpoint
   - every JSON key, including nested (`{"user":{"email":...}}`) and extra
     keys (mass assignment of `verified`/`role` during reset)
3. **Re-sweep per step of the flow** — the request step, the verify step, and
   the finalize step are separate endpoints with separate parameters.
4. **Track** `step → field → payload → result` in the journal; every unlogged
   field = gap.

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

### Class: enumeration — 429 disclosed H1 reports (142 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `url`
- `_pageLabel`
- `name`
- `scope`
- `email`
- `id`
- `content`
- `password`
- `rcnum`
- `defid`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Attacker can add arbitrary data to the blockchain without paying gas** (Deserialization of Untrusted Data)
  - Signal: **Summary:** Due to a missing sanity check in Transaction::rlpParse, an attacker can append arbitrary RLP-encoded data to the end of an otherwise valid transaction, and that data w
- **[critical] Project Template functionality can be used to copy private project data, such as repository, confidential issues, snippets, and merge requests** (Privilege Escalation)
  - Signal: I've found a three minor vulnerabilities which, when combined, allow an attacker to copy private repositories, confidential issues, private snippets, and then some. I'll go through
- **[critical] RCE via the DecompressedArchiveSizeValidator and Project BulkImports (behind feature flag)** (Command Injection - Generic)
  - Signal: ### Summary The `DecompressedArchiveSizeValidator` is used to check the size of a archive before extracting it: https://gitlab.com/gitlab-org/gitlab/-/blob/v15.1.0-ee/lib/gitlab/im
- **[critical] Stored XSS in Private Message component (BuddyPress)** (Cross-site Scripting (XSS) - Stored)
  - Signal: ## Description: WordPress version: **5.0.3** BuddyPress version: **4.1.0** Users with accounts can send private messages containing rendered HTML to other uses, this includes being

