---
name: hunt-captcha-bypass
description: CAPTCHA bypass hunting — omit the field (fastest), empty/null values, token replay, cross-endpoint token reuse, reactive CAPTCHA, concurrency-window bypass for sliding-window human checks, sibling-endpoint gaps. Use when reCAPTCHA/hCaptcha/cloudflare-protected forms are present. Trigger keywords: captcha bypass, reCAPTCHA, hCaptcha, bot protection, human check.
---

# CAPTCHA Bypass — Deep Hunting

## THE GATE — Omit the field entirely (fastest, most common)
POST all fields except `g-recaptcha-response`/`h-captcha-response`/`captcha_token` — success = client-side-only validation.

## Attack Vectors
- **Empty/null values**: `captcha=`, `null`, `0`, `undefined` — some apps validate presence but not content.
- **Token replay**: reuse one solved token across requests (reCAPTCHA v2 single-use not enforced).
- **Cross-endpoint token reuse**: token solved for login accepted on registration — server validates "real solution" but not "right solution for THIS action."
- **Reactive CAPTCHA**: only after N failures → N-1 attempts per account by resetting state.
- **Concurrency-window bypass (non-obvious)**: some human checks are request-count-in-sliding-window middleware — garbage payloads satisfy it since the counter increments regardless of validation outcome. **Sequential pacing structurally cannot win** (12 requests over 250s when check needs ~10 in 20s) — fire all requests concurrently (`"concurrency": N`) so they arrive simultaneously.
- **Sibling endpoints**: `/api/register` vs `/register`, mobile API — CAPTCHA often absent.

## Key Payloads
`captcha=&email=...&password=...`; field names `g-recaptcha-response`, `h-captcha-response`, `captcha_answer`.

## Detection
Intercept successful form submission, remove field, replay; test parallel paths.

## Validation
Any successful state-changing action (account created, login, payment) without a valid token confirms bypass; compare against baseline with CAPTCHA.

## Common Mistakes
Wasting budget solving real reCAPTCHA/hCaptcha programmatically before testing patterns 1–4; sequential pacing on sliding-window checks; not checking sibling endpoints where CAPTCHA is absent.

## PARAMETER COVERAGE — every protected form and its fields (MANDATORY)
The #1 miss: testing only the one signup form you found and skipping the rest
of the CAPTCHA-protected surface.

1. **Enumerate EVERY protected form/endpoint** (login, signup, comment,
   message, OTP/reset request, payment, feedback, ticket) AND their sibling
   variants (`/api/register` vs `/register`, mobile API, GraphQL mutations,
   WebSocket events) — CAPTCHA is usually absent on one of them.
2. **For each form, enumerate its fields** and test the omit/empty/reuse
   ladder on the CAPTCHA field specifically:
   - omit `g-recaptcha-response`/`h-captcha-response`/`captcha_token` entirely
   - empty/null/`0`/`undefined`
   - replay one solved token across requests and across endpoints
   - cross-endpoint reuse (login token on registration)
3. **Reactive CAPTCHA**: map the failure threshold, then N-1 attempts per
   account with state reset.
4. **Sliding-window checks**: fire ALL requests concurrently (never sequential
   pacing) so they arrive in-window simultaneously.
5. **Re-sweep per auth context and per device path** (web/API/mobile).
6. **Track** `endpoint → field → technique → success?` in the journal; every
   unlogged endpoint/field = gap.