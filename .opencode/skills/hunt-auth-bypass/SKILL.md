---
name: hunt-auth-bypass
description: Authentication bypass hunting — legacy protocol matrix (xmlrpc, SOAP, /rest/auth, _format=json, TeamCity, Tomcat), parser-differential SAML XSW, cross-portal trust inheritance, unicode/control-char domain enforcement bypass, audience confusion, Duende BFF TokenType.UserOrClient, sibling-function rule. Use when custom login UIs, SSO flows, or middleware auth boundaries exist. Trigger keywords: auth bypass, authentication bypass, login bypass, xmlrpc, legacy login, audience confusion.
---

# Authentication Bypass — Deep Hunting

## THE GATE — Legacy-Protocol Matrix
Any custom-branded login UI must be probed in parallel for platform-native credential endpoints that outlive the UI's protections (no rate limit, no MFA, no CAPTCHA). Canonical cases: WP `/xmlrpc.php`, SharePoint `/_vti_bin/Authentication.asmx`, Atlassian `/rest/auth/1/session`, Drupal `/user/login?_format=json`, Exchange `/EWS/Exchange.asmx`, Joomla `/administrator/index.php?option=com_login`, TeamCity GET-form-login, Tomcat `/manager/text/list`, Citrix `/nf/auth/doAuthentication.do`.

## Attack Vectors
- **Parser-differential SAML XSW**: sign a benign `<Assertion>`, inject a sibling attacker `<Assertion>`; REXML vs Nokogiri resolve the same XPath to different nodes (GitHub CVE-2025-25291/292).
- **Cross-portal trust inheritance**: partner token accepted at admin portal — verifier checks signature only, not issuance context (Slack confused-deputy: GitHub-signed assertion presented to Slack ACS).
- **Unicode/control-char domain bypass**: append `\r`/U+0000 to email → domain comparison normalizes away.
- **Audience confusion** (Argo CD CVE-2023-22482): token signed by correct issuer but minted for a different `aud` accepted.
- **Duende BFF `TokenType.UserOrClient`**: unauthenticated request to a misconfigured route gets proxied with a client-credentials M2M token (broader scope than any user token) → admin-scope downstream.
- **Sibling-function rule**: admin route families — 9 enforced, 10th unenforced.

## Key Payloads
`alg:none` JWT `{"alg":"none"}` + empty sig, keep trailing dot. XMLRPC `system.multicall` batches ~1000 credential pairs in one request — bypasses per-request rate limits. Comment injection `<NameID>attacker@evil.com<!---->.victim@company.com</NameID>`. SAML sig strip: regex-remove `<ds:Signature.*?</ds:Signature>` and re-encode.

## Detection
`SAMLResponse` in POST bodies, `Set-Cookie: SAMLResponse=`, `WWW-Authenticate: Bearer realm=`, JS greps for `samlRequest|RelayState|onelogin|shibboleth`.

## Validation (Gate 0)
Attacker can authenticate as another user OR no-credentials; concrete victim loss; reproducible fresh-browser in 10 min.

## Common Mistakes
Stopping at "username enumeration" (N/A on H1); reporting alg:none where verifier actually validates; not proving cross-identity data access.

## PARAMETER COVERAGE — every auth surface (MANDATORY)
The #1 miss: testing only the main login form and skipping the parallel auth
surfaces. Bypasses hide in every login-like endpoint, every header the auth
middleware trusts, and every field of the login request.

1. **Enumerate** EVERY credential surface: primary login, login-with-
   google/apple/SSO, mobile API login, legacy endpoints (xmlrpc/SOAP/`_format=
   json`/REST session), password reset (its own bypass), SAML/SSO ACS, OAuth
   callbacks, and every "authenticate" endpoint discovered in bundles/swagger.
2. **Sweep each surface's parameters**:
   - credentials: username/password/email fields — parser-differential inputs
     (Unicode, control chars `\r`/U+0000, null bytes, trailing dots, comment
     injection) on EACH
   - `_format`/content-type: send `?`-variants, alternate serializers on each
     surface
   - headers: `X-Original-URL`/`X-Rewrite-URL` (ACL bypass), `Authorization`
     parser quirks, `TokenType.UserOrClient` misroutes, `X-User`/`X-Forwarded-
     User` identity headers on EACH route
   - JWT/SAML fields: `alg`/`kid`/`aud`/`NameID` per the JWT/SAML skills on
     every token-accepting endpoint
   - session endpoints: `/rest/auth/1/session`, `/api/v1/sessions` etc.
3. **Sibling-function rule**: for each admin/privileged route family, test the
   ENTIRE family, not the one known-enforced route.
4. **Re-sweep per identity context**: anonymous, user A, user B, org-admin —
   middleware may gate one shape and not another.
5. **Track** `surface → field → technique → result` in the journal; every
   unlogged surface/field = gap.

## 401/403 BYPASS ON THE AUTH SURFACE (MANDATORY)
A 401 (authN) or 403 (authZ) on any login/SSO/API route is a bypass candidate,
not a stop sign. Run this BEFORE assuming the gate holds (full catalogue in
hunt-access-control):
1. **Method fuzz**: replay the request as GET/POST/PUT/PATCH/HEAD/OPTIONS/
   TRACE + `X-HTTP-Method-Override` — middleware often only guards the "normal"
   method; `/rest/auth/1/session` (GET) vs `POST` behavior differs.
2. **Header fuzz**: `X-Original-URL` / `X-Rewrite-URL` pointing at the target
   path (Selenium/Rails/Spring-style ACL bypass), `X-Forwarded-For: 127.0.0.1`
   for IP-allowlisted routes, `Authorization` parser quirks (duplicate/blank/
   whitespace-padded schemes — see the authN table above).
3. **Path normalization**: case folding, trailing `/`, `/..;/` (Tomcat),
   encoded separators `%2f`/`%00`, extension append `.json`, matrix params —
   keep the SAME request meaning, change only the encoding.
4. **Content-type / `_format` swap** on the same route (the auth gate may key
   on the serializer).
5. **Protocol/origin**: HTTP/2→1.1→1.0, drop Host on 1.0, hit origin IP with
   `Host: target` to skip the edge that enforces the rule.
6. **Validation**: a bypass = response DIFFERS from the baseline 401/403
   (status in 200/201/2xx/3xx AND different body-MD5). 3xx-with-Location =
   proof. Compare against baseline, ONE change per request.
7. **Track** `route → family → trick → new status/body-diff` in the journal.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: auth-bypass — 464 disclosed H1 reports (148 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `client_id`
- `redirect_uri`
- `email`
- `id`
- `authenticity_token`
- `content`
- `url`
- `response_type`
- `host`
- `rcnum`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Multiple HTTP Smuggling reports** (HTTP Request Smuggling)
  - Signal: Theses reports spreads other several years and are all about **HTTP Smuggling issues** (HTTP Requests or Responses splitting, Cache Poisoning, Security filter bypass). I've made re
- **[critical] Project Template functionality can be used to copy private project data, such as repository, confidential issues, snippets, and merge requests** (Privilege Escalation)
  - Signal: I've found a three minor vulnerabilities which, when combined, allow an attacker to copy private repositories, confidential issues, private snippets, and then some. I'll go through
- **[critical] [cloudron-surfer] Denial of Service via LDAP Injection** (LDAP Injection)
  - Signal: I would like to report `Denial of service via LDAP Injection` vulnerability in `cloudron-surfer` module. It allows a malicious attacker to send a malformed input that is interprete
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

