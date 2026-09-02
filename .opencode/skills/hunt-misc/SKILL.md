---
name: hunt-misc
description: Cross-cutting / uncommon web bugs — invitation-before-verification, post-removal session persistence (soft-delete), PAT scope at issuance, CRLF/header injection → CDN cache poisoning, config URL fields as SSRF/token exfil (Sentry DSN, webhooks), dependency confusion, ReDoS anchor-switching, marker discipline + body-diff rule. Use when unique workflows, invitation systems, PATs, header injection, or config fields are present. Trigger keywords: invitation, PAT scope, CRLF injection, dependency confusion, ReDoS, webhook, soft-delete.
---

# Misc / Cross-Cutting Bugs — Deep Hunting

## Highest-Value Vectors / Chains
- **Invitation-before-verification**: accept invitation token from a different session without completing email verification → privileged role without owning the invited email (Shopify Partners-class). Test single-use vs multi-use tokens.
- **Post-removal session persistence**: soft-delete flips `active=false` but session/PAT stays valid → cross-tenant PII exfil post-termination (Shopify/GitLab class).
- **PAT scope at issuance, not at use**: read-only token calling write endpoints (GitHub class).
- **SAML XSW parser-differential**: strip/move `Signature` so signature-checker and business-logic parsers resolve different nodes (GitHub Enterprise CVE-2025-25291/292, samlify CVE-2025-47949).
- **CRLF/header injection** in Ruby/Rack (`pitchfork`, Net::HTTP) → `%0d%0aSet-Cookie: session=attacker` → CDN cache poisoning → mass stored XSS (GitLab H1).
- **Config URL fields as SSRF/token exfil**: Sentry DSN, webhook URLs, proxy URLs set by maintainer roles.
- **Subdomain takeover at OAuth `redirect_uri` allowlist**: wildcard + dangling CNAME → claim host → steal auth codes.
- **Dependency confusion** via PyPI/proxy fallback configs; **ReDoS** anchor-switching (`#` patched → `?`/`%`).

## Key Endpoints
`/invitations/*/accept`, `/auth/saml/callback`, `/api/v*/repos/*/lfs/*`, `/-/settings/integrations/sentry`, `oauth/authorize?redirect_uri=`, `/reset-password?token=`.

## Fingerprinting
`X-Request-Id` (pitchfork/Rack CRLF surface), `X-GitLab-*`, `X-Shopify-Shop-Api-Call-Limit`; internal paths in JS.

## Validation
**Marker discipline** — unique 8+ char random alphanumeric markers (`x4hd2k9pq`), never `test`/`admin`/`AAAA`; verify marker absent from baseline before claiming reflection. **Body-Diff Rule** — privilege-bypass claims require body differential, not status-code-only. Gate 0: concrete action + victim loss + 10-min repro.

## Common Mistakes
Status-code-only bypass claims; treating server-policy blocklists as existence oracles; "Could potentially..." impact statements.

## PARAMETER COVERAGE — every field of every uncommon flow (MANDATORY)
The #1 miss: testing only the one "interesting" field of a special flow and
skipping the rest. These cross-cutting bugs hide in EVERY field of
invitation, PAT, webhook, config, and header surfaces.

1. **Invitation flows — enumerate every field** of `/invitations`, `/accept`,
   `/invite`, `/register?token=` endpoints: the invite token, email, role,
   session cookie at accept-time, `type`/`source` fields. Sweep each:
   invitation-before-verification (accept from a DIFFERENT session/email),
   single-use vs multi-use token, role escalation via body fields.
2. **PAT / API tokens**: enumerate issuance fields (scope, expires_at, role)
   and USE-time behavior — test read-only token on every write endpoint;
   test post-removal persistence (soft-delete then reuse the token).
3. **CRLF/header injection — every header value that reaches a proxy/log**:
   User-Agent, Referer, X-Forwarded-For, custom `X-*` — sweep `%0d%0a`/`%0a`
   injection into Set-Cookie/Location refs; chain to cache poisoning.
4. **Config URL fields — every URL config**: Sentry DSN, webhook URLs, proxy
   URLs, callback URLs, avatar/image URLs — each is an SSRF/token-exfil
   candidate (test collaborator on each).
5. **ReDoS — every regex-driven param**: sweep the anchor-switching ladder
   (`#`→`?`→`%`) with super-linear length doubling on each.
6. **Dependency confusion**: enumerate internal package names from bundles/
   docs → candidate list.
7. **Track** `flow → field → technique → result` in the journal with unique
   markers per test; every unlogged field = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: access-control — 712 disclosed H1 reports (256 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `scope`
- `search`
- `group_id`
- `repository_ref`
- `snippets`
- `authenticity_token`
- `state`
- `type`
- `url`
- `name`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Project Template functionality can be used to copy private project data, such as repository, confidential issues, snippets, and merge requests** (Privilege Escalation)
  - Signal: I've found a three minor vulnerabilities which, when combined, allow an attacker to copy private repositories, confidential issues, private snippets, and then some. I'll go through
- **[critical] One-click account hijack for anyone using Apple sign-in with Reddit, due to response-type switch + leaking href to XSS on www.redditmedia.com** (Improper Access Control - Generic)
  - Signal: Hi, # Description I've been researching new ways to steal OAuth codes and access-tokens using postMessage, and I found a way for me to steal the code and/or access-token from Apple
- **[critical] Unauthenticated Access to Admin Panel Functions at https://███████/███** (Improper Access Control - Generic)
  - Signal: **Description:** The admin panel at https://██████████/████████ and all its functions can be accessed without authentication. This is basically the same vulnerability as in #139491
- **[critical] Unauthenticated Access to Admin Panel Functions at https://██████████/████████** (Improper Access Control - Generic)
  - Signal: **Description:** I discovered that the admin panel at https://████/█████ and all its functions can be accessed without authentication. ## Impact An attacker is able to use the admi

### Class: info-disclosure — 1091 disclosed H1 reports (278 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `id`
- `page`
- `name`
- `query`
- `subject`
- `type`
- `sort_type`
- `col`
- `height`
- `text_query`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] .git folder exposed [HtUS]** (Information Disclosure)
  - Signal: Heyy there, I have found a exposed .git folder on https://█████ https://████████/.git/config ``` [core] repositoryformatversion = 0 filemode = true bare = false logallrefupdates = 
- **[critical] RCE on Steam Client via buffer overflow in Server Info** (Classic Buffer Overflow)
  - Signal: ## Introduction In Steam and other valve games (CSGO, Half-Life, TF2) there is a functionality to find game servers called the server browser. In order to retrieve the information 
- **[critical] [cloudron-surfer] Denial of Service via LDAP Injection** (LDAP Injection)
  - Signal: I would like to report `Denial of service via LDAP Injection` vulnerability in `cloudron-surfer` module. It allows a malicious attacker to send a malformed input that is interprete
- **[critical] Exposed GIT repo on ██████████[HtUS]** (Cleartext Storage of Sensitive Information)
  - Signal: Git metadata directory (.git) was found in this folder. An attacker can extract sensitive information by requesting the hidden metadata directory that version control tool Git crea

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

### Class: email-abuse — 117 disclosed H1 reports (13 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `height`
- `id`
- `email`
- `prove`
- `tx`
- `query`
- `page`
- `key`
- `hash`
- `per_page`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Exposed GIT repo on ██████████[HtUS]** (Cleartext Storage of Sensitive Information)
  - Signal: Git metadata directory (.git) was found in this folder. An attacker can extract sensitive information by requesting the hidden metadata directory that version control tool Git crea
- **[critical] RCE on Wordpress website** (Deserialization of Untrusted Data)
  - Signal: There is a trivial to exploit Remote Code Execution on nextcloud.com due to unserializing user input. # Proof of concept The following command will execute the `system('id')` comma
- **[critical] No Valid SPF Records/don't have DMARC record** (Improper Access Control - Generic)
  - Signal: I have already reported this isssue through email and the company has accepted my report. Hiii, There is any issue No valid SPF Records on https://app.upchieve.org Desciprition : T
- **[high] Broken Authentication: A project addition request can be used multiple time for different users** (Key Exchange without Entity Authentication)
  - Signal: > NOTE! Thanks for submitting a report! Please replace *all* the [square] sections below with the pertinent details. Remember, the more detail you provide, the easier it is for us 

### Class: crlf-header — 142 disclosed H1 reports (27 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `url`
- `iclLayout`
- `AAAAAAVVAacibcMeQaa-JKcUyH-R0itjt2o5kIUgVaclQb7SjFgL4eFSChKpRUFWw5I6mpFBaG331jUn5d3UQLI_WQvnxl7pF0SjzIKjWb9DdUnLhg`
- `militarybranch`
- `firstName`
- `middleName`
- `lastName`
- `email`
- `title`
- `department`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] [hta3] Remote Code Execution on ████** (Code Injection)
  - Signal: **Note** In the days leading up to this event, I looked at `███████` due to the ████████ press release which described this as the scope for this event. I understand that this is o
- **[critical] Multiple HTTP Smuggling reports** (HTTP Request Smuggling)
  - Signal: Theses reports spreads other several years and are all about **HTTP Smuggling issues** (HTTP Requests or Responses splitting, Cache Poisoning, Security filter bypass). I've made re
- **[critical] CVE-2019-11043: a buffer underflow in fpm_main.c can lead to RCE in php-fpm** (Buffer Underflow)
  - Signal: The vulnerability exists in php-fpm because of missing bounds check in fpm_main.c. If the FastCGI variable `PATH_INFO` is empty, the underflow happens when the code tries to calcul
- **[critical] Unauthorised Access to Anyone's User Account** (Improper Authentication - Generic)
  - Signal: When we do Login with Facebook on the Zomato app, you're doing zero authentication of the user. I'm able to hack into the targeted user's accounts by just using the Facebook ID. Af

