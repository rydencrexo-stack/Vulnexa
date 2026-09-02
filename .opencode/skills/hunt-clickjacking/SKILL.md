---
name: hunt-clickjacking
description: Clickjacking hunting — header-absence is the trigger not the finding, the three mandatory confirmations (page renders in iframe, action succeeds cross-site, SameSite cookie carries auth), sensitive-action targeting, FP discipline. Use when frameable pages with state-changing actions exist. Trigger keywords: clickjacking, frame, X-Frame-Options, CSP frame-ancestors, UI redress.
---

# Clickjacking — Deep Hunting

## THE GATE
Header-absence is the trigger, not the finding. Only frameable pages with a sensitive *state-changing* action reachable cross-site are exploitable.

## Three Mandatory Confirmations (in a real browser)
1. Page actually renders in the iframe — no framebusting JS (`if(top!==self)` breakout, `Sec-Fetch-Dest` checks).
2. The action succeeds cross-site — critically, if the session cookie is `SameSite=Lax`/`Strict` (modern default), it is NOT sent on the cross-site framed request and the clickjack fails — verify the authed state carries into the frame.
3. It's a state-changing action (transfer, email/password change, 2FA disable, OAuth authorize, admin action), not read-only.

## Targets by Payout
Login pages (force login with attacker creds), money-transfer/checkout confirm, account settings, OAuth "Authorize app" dialogs, admin role changes.

## FP Discipline
Public/read-only pages lacking frame protection = Low/Info; APIs/JSON/images are not clickjacking targets; header-absence alone + SameSite cookies + framebusting JS can each fully defeat it. Proof = screenshot/recording of the overlay + framed sensitive action while authenticated. Missing headers with no working frame PoC is a documentation issue, not a vulnerability.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: clickjacking — 309 disclosed H1 reports (63 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `for`
- `id`
- `type`
- `sentry_key`
- `oauth_token`
- `url`
- `state`
- `callback`
- `page`
- `host`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] RCE on Steam Client via buffer overflow in Server Info** (Classic Buffer Overflow)
  - Signal: ## Introduction In Steam and other valve games (CSGO, Half-Life, TF2) there is a functionality to find game servers called the server browser. In order to retrieve the information 
- **[critical] Authentication bypass on auth.uber.com via subdomain takeover of saostatic.uber.com** (Improper Authentication - Generic)
  - Signal: ## Summary This is not a standard vulnerability, but a chain of two more exotic vulnerabilities leading to a full authentication bypass of your SSO login system at auth.uber.com (v
- **[critical] Stored XSS in Private Message component (BuddyPress)** (Cross-site Scripting (XSS) - Stored)
  - Signal: ## Description: WordPress version: **5.0.3** BuddyPress version: **4.1.0** Users with accounts can send private messages containing rendered HTML to other uses, this includes being
- **[critical] One-click account hijack for anyone using Apple sign-in with Reddit, due to response-type switch + leaking href to XSS on www.redditmedia.com** (Improper Access Control - Generic)
  - Signal: Hi, # Description I've been researching new ways to steal OAuth codes and access-tokens using postMessage, and I found a way for me to steal the code and/or access-token from Apple

