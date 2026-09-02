---
name: hunt-oauth
description: OAuth / OIDC security hunting — redirect_uri bypass taxonomy (suffix, at-sign, path traversal, parameter pollution, IDN homograph, post-validation normalization), browser-parse vs server-parse userinfo table, Pass-The-Token, nOAuth email-mutable ATO, Dirty Dancing, state CSRF / account linking, dynamic client registration, cross-client token confusion, mobile deep links, PKCE gaps, exchange-the-code validation. Use when OAuth flows, authorize endpoints, redirect_uri, or IdP login buttons exist. Trigger keywords: OAuth, OIDC, redirect_uri, authorization code, state, PKCE, token theft.
---

# OAuth / OIDC — Deep Hunting

## THE GATE — redirect_uri Bypass Taxonomy (highest yield)
`https://legit.com.evil.com`, `https://legit.com@evil.com`, path traversal `https://legit.com/cb/../../evil`, parameter pollution `redirect_uri=legit&redirect_uri=evil`, encoded slashes `%2F`/`%252F`, fragment `https://evil.com#legit.com`, IDN homograph (`oauth.šemrush.com` — punycode passed Latin-only string check), post-validation normalization (`..` resolved after check).

## Browser-Parse vs Server-Parse Table (non-obvious)
WHATWG URL parser does userinfo parsing ONLY before the first `/` after `://`. Prefix `https://acme.example` (no slash) + `https://acme.example@evil.com/cb` = server passes, browser lands on evil.com → **exploit**. With trailing slash `https://acme.example/` + `https://acme.example/@evil.com/cb` = browser stays on acme.example → **not exploitable**. **Always headless-test final navigation in a real browser before claiming ATO-chain.**

## Other Vectors
- **Open-redirect-on-whitelisted-domain chain**: exact-match whitelist defeated via `redirect_uri=https://legit.com/logout?next=https://evil.com`.
- **Pass-The-Token**: attacker's Facebook token replayed to RP API; RP calls provider `/me`, finds victim email, never validates token's `app_id` → ATO across sites.
- **nOAuth**: Azure AD `email` claim is mutable + unverified; attacker sets own `mail` to victim's address → RP keying users by email → ATO.
- **Dirty Dancing**: `response_type=token` swap + promiscuous `postMessage` listener accepting `*.zoom.us` + `response_mode=web_message` → code leak with NO XSS.
- **State CSRF / account linking**: remove/reuse fixed state → force victim to callback with attacker's code → victim's session linked to attacker's IdP identity.
- **Dynamic client registration**: open `registration_endpoint` → register malicious client with attacker `redirect_uris`.
- **Cross-client token confusion**: mint token for client A, replay against client B's API (no `aud` validation).
- **Mobile deep links**: `intent://push_notification_webview?url=https://evil.com#Intent;scheme=target-app;...` — webview loads attacker URL capturing OAuth callback.
- **OIDC `sub` ambiguity**: multi-IdP apps keying accounts on `sub` alone → same `sub` across Google/Microsoft = cross-IdP hijack.

## Key Payloads
`.well-known/openid-configuration` jq for `registration_endpoint`; `prompt=none` silent re-auth test.

## Validation
**Exchange-the-code step is non-negotiable**; state-only leakage is Low, code/token leak + successful exchange is Critical.

## Common Mistakes
Skipping headless browser confirmation; substring-matching error bodies; assuming fragment tokens are safe (JS reads `location.hash`, postMessage exfil); PKCE omission test only on new clients (legacy/mobile exempt).

## PARAMETER COVERAGE — every OAuth parameter (MANDATORY)
The #1 miss: testing only `redirect_uri` and `client_id` and skipping the rest
of the OAuth parameter space. Bugs hide in `state`, `scope`, `response_type`,
`response_mode`, `nonce`, `prompt`, `login_hint`, `code_challenge`, `acr_values`,
`display`, `ui_locales`, and headers (`Origin`, `Referer`, `Authorization`).

1. **Enumerate** every parameter the authorize/token/userinfo/registration
   endpoints accept (introspection of `client_id`, `response_type`, `scope`,
   `state`, `redirect_uri`, `prompt`, `nonce`, `login_hint`, `code_challenge`,
   `code_challenge_method`, `resource`/`audience`).
2. **Sweep each parameter**:
   - `redirect_uri`: full bypass taxonomy on EVERY client (suffix, at-sign,
     path traversal, pollution, fragment, IDN, normalization)
   - `state`: omit, reuse fixed value, replay across flows (CSRF/account linking)
   - `scope`: escalate scope (`admin`, `email`, `offline_access`, higher-tier
     scopes), compare accepted vs documented
   - `response_type`: `code`↔`token` swap (token-in-fragment leaks), multiple
     types, `response_mode=web_message`/`query`/`fragment` swaps
   - `prompt`: `none` silent-auth behavior, re-auth bypass
   - `code_challenge`: omit PKCE, mismatch, replay code across clients
   - `login_hint`/`acr_values`: prefill attacks, auth-method downgrade
   - `resource`/`audience`: cross-client token confusion, tenant switch
   - headers: `Origin`/`Referer` in the token exchange and web_message flow
3. **Exchange-the-code step is mandatory** on every working flow — a leaked
   code that can't be exchanged is not a finding.
4. **Re-sweep per client**: each registered OAuth client (first-party, legacy,
   mobile, dynamic) can have different validation.
5. **Track** `endpoint → param → payload → result` in the journal; every
   unlogged parameter = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: oauth — 176 disclosed H1 reports (50 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `client_id`
- `redirect_uri`
- `state`
- `response_type`
- `scope`
- `code`
- `oauth_token`
- `next`
- `consumer_key`
- `host`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Authentication bypass on auth.uber.com via subdomain takeover of saostatic.uber.com** (Improper Authentication - Generic)
  - Signal: ## Summary This is not a standard vulnerability, but a chain of two more exotic vulnerabilities leading to a full authentication bypass of your SSO login system at auth.uber.com (v
- **[critical] One-click account hijack for anyone using Apple sign-in with Reddit, due to response-type switch + leaking href to XSS on www.redditmedia.com** (Improper Access Control - Generic)
  - Signal: Hi, # Description I've been researching new ways to steal OAuth codes and access-tokens using postMessage, and I found a way for me to steal the code and/or access-token from Apple
- **[critical] ██████████ vulnerable to CVE-2022-22954** (Code Injection)
  - Signal: I found that one of the targets belongs to **DOD** vulnerable to **CVE-2022-22954** where an attacker may be able to execute any malicious code like escalating Remote code executio
- **[critical] Leaking sensitive information on Github lead full access to all Grab Slack channels** (Information Disclosure)
  - Signal: #Summary: Accidental leakage of secret keys in such code repositories is a real problem, after my report #387117, I decided to dig deeper than the previous report and looking to so

