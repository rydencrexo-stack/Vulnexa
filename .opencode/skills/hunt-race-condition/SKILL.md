---
name: hunt-race-condition
description: Race condition hunting — single-packet attack (Kettle DEF CON 31 + Flatt 2024), two race primitives (identical-copies limit-overrun, different-requests partial-construction), N=30 MTU-bound with last-byte sync, Flatt first-sequence-sync for PIN brute inside 5-attempt window, Turbo Intruder Engine.BURP2, race-window estimation, root-cause greps, Wireshark validation (one TLS record). Use when coupon/gift-card/PIN/OTP/limit-overrun logic or idempotency-violating endpoints exist. Trigger keywords: race condition, single-packet, TOCTOU, double-spend, limit overrun, Turbo Intruder.
---

# Race Condition — Deep Hunting

## THE GATE
Two primitives:
- **Identical-copies race** (limit-overrun): coupon/gift-card double-spend; success = ≥2 of N get 2xx.
- **Different-requests race** (partial construction): fire A=register + B=confirm-with-blank-token together, ~20 rounds, winning in the window where the row exists but verification token isn't set.

## The Single-Packet Attack (core modern primitive)
Open one H2 connection, send N HEADERS+almost-complete DATA frames withholding the final byte, then release all final bytes in ONE TCP write → all N streams dispatch in the same scheduler tick (<1 ms window). Turbo Intruder `engine=Engine.BURP2` implements last-byte-sync. N=30 default (MTU-bound); N>30 via Flatt first-sequence-sync (synchronized TCP SEQ across connections, IP fragmentation → 10,000 requests/166 ms for PIN brute-force inside a 5-attempt window). **Wireshark validate**: N END_STREAM DATA frames in one TLS record/one TCP segment — if you see N segments your tool is sequencing.

## Race-Window Estimation
If `T_par1≈T_par2≈T_single` server parallelizes (window = min) — single-packet helps a lot; if `T_par2≈T_par1+T_single` it serializes. Backends that serialize anyway: Apache prefork, single-threaded PHP-FPM.

## Root Causes to Grep
`find_by` without `lock!`, `SELECT` without `FOR UPDATE`, `await get → await update`, counters outside transactions, async fulfillment after sync eligibility check, client-side `button.disabled=true` only.

## Bypasses
DB unique constraints catch *after* the race (partial fulfillment); multi-server apps don't share in-process mutexes (send via different CDN nodes/LBs); queue duplication with multiple workers.

## Validation / Anti-Patterns
"Send group in parallel" over HTTP/1.1 pipelines is millisecond-spread, not single-packet — triagers downgrade. Require Wireshark + N mutually-exclusive successes; don't race endpoints with real row locks. Reproduce ≥3/5 on a fresh account.

## Business-Logic Race Payouts
Coupon/credit/gift-card redemption (Stripe $5k, Reverb), fee-credit replay 30× parallel, price-swap mid-checkout (TOCTOU on archived cheaper price).

## PARAMETER COVERAGE — race EVERY check-then-act endpoint/field (MANDATORY)
The #1 miss: racing only the "famous" coupon/OTP endpoints and skipping the
rest of the state-changing surface. Races hide in EVERY check-then-act flow.

1. **Enumerate** every state-changing endpoint that checks-then-acts:
   coupon/promo redeem, gift-card/credit redeem, withdrawal/transfer, verify,
   OTP/PIN submit, vote/rating/like, follow/referral, account registration
   (same email), order/checkout, password/token use, balance-deduct.
2. **Sweep the single-packet attack on EACH** (N=30, MTU-bound, last-byte
   sync, one TCP segment — validate in Wireshark):
   - identical-copies race (limit-overrun): N identical requests; success = ≥2
     of N get 2xx/state-change
   - different-requests race (partial construction): A + B fired together;
     run ~20 rounds
3. **For each endpoint also enumerate its fields** and race the ones that
   matter: the coupon code, OTP, amount, quantity, user_id, token — a race on
   a *different field* of the same endpoint (e.g. idempotency key) is still a
   finding.
4. **Flatt first-sequence-sync** for PIN brute inside small windows; multi-
   server/LB egress to break shared mutexes.
5. **Re-sweep per auth context and per tier** (free vs paid) and per payment
   provider if multiple.
6. **Track** `endpoint → field → primitive → wins` in the journal; every
   unlogged endpoint/field = gap.

## RATE-LIMIT COUNTER RACE (TOCTOU on limiter)
Non-atomic limiters are a first-class race target — `read count → compare →
increment` executed concurrently lets many requests observe the pre-increment
value (full bypass matrix in hunt-brute-force §G):
1. Find a rate-limited action (OTP verify, coupon redeem, PIN check, login —
   map with 429/`X-RateLimit-*` headers first, then `limit` vs `limit+1`).
2. Single-packet burst (N≈30, one TLS record — verify in Wireshark) at the
   LIMITED endpoint; release the gate so all arrive simultaneously on the same
   server/worker.
3. Most wins come on the FIRST batch before the counter is atomically
   incremented; a "5 attempts" limit leaking 20+ successful checks = confirmed.
4. If the limiter is per-session, mint fresh sessions/CSRF tokens and re-race.
5. Distinguish counter race from per-key bypass: fix the IP/session/route,
   ONLY vary concurrency. If serial requests 429 but the concurrent burst
   succeeds → TOCTOU counter race (not a header/path bypass).

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: race-condition — 99 disclosed H1 reports (21 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `client_id`
- `redirect_uri`
- `code`
- `id`
- `authenticity_token`
- `client_secret`
- `getsc`
- `experiment_d2x_2020ify_buttons`
- `experiment_d2x_sso_login_link`
- `experiment_d2x_google_sso_gis_parity`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Project Template functionality can be used to copy private project data, such as repository, confidential issues, snippets, and merge requests** (Privilege Escalation)
  - Signal: I've found a three minor vulnerabilities which, when combined, allow an attacker to copy private repositories, confidential issues, private snippets, and then some. I'll go through
- **[critical] Webshell via File Upload on ecjobs.starbucks.com.cn** (OS Command Injection)
  - Signal: **Summary:** OS Command Injection which can let the attacker who get more important information of the server,such as disclosures internal source code of the webapp,database data a
- **[critical] Unauthenticated request smuggling on launchpad.37signals.com** (HTTP Request Smuggling)
  - Signal: ## Description By sending an ambiguous request on the rails application on `launchpad.37signals.com`, an attacker can desynchronise frontend and backend servers, leaving the socket
- **[critical] Misconfigurated login page able to lock login action for any account without user interaction** (None)
  - Signal: ## Summary While observing a few things about the login feature, I found that the account was locked after a certain number of requests. Although this feature is actually added to 

