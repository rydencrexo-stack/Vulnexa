---
name: hunt-spa-api
description: SPA backend API hunting — bundle harvesting (route literals as string segments, API hosts), secret regexes, establish a CONTROL (gated sibling endpoint), test every route unauthenticated, response-differential interpretation (400 mandatory-field = reached business logic without auth), data-layer reach proof, minimal-proof discipline. Use when SPA shell with large JS bundles / console / app / dashboard subdomains exist. Trigger keywords: SPA, bundle, API discovery, unauthenticated API, gated route, minified JS.
---

# SPA Backend API — Deep Hunting

## THE GATE
An SPA ships its full backend route map to the browser; the login page being SSO-gated says nothing about whether the API behind it checks tokens.

## Bundle Harvesting
Grep `/static/js/*.js`, `/_next/static/*.js` for API hosts (`*api*`, `*-api*`, dev/beta/staging variants), versioned bases (`/api/v2`), and **route literals as string segments** (`"account/payment/list"`) — minifiers never store full URLs, so naive `/api/v*` grep fails; prepend the base yourself. Secret regexes: `AIza...`, `AKIA...`, `sk_live_`, `eyJ...` JWTs, `apiKey:`.

## Establish a CONTROL
Unauth request to an endpoint that IS gated; its `401`/"Missing authorization" is the differential. Same-stack sibling API is ideal control.

## Test Every Route Unauthenticated (both methods)
| Response | Meaning |
|---|---|
| `200`+data | Exposure |
| `400 "field X is mandatory"` | **Reached business-logic validation without auth = auth bypass** |
| `200`+DB error (`PROCEDURE db.sp_y does not exist`) | Reached data layer (also SQLi surface) |
| Mandatory fields named `is_admin`/`role_id`/`account_type` | Client-supplied authorization → self-elevation |

## Key Probes
POST/GET each route with no Authorization header; `dev-`/`beta-` variants; check `Access-Control-Allow-Origin: *`.

## Fingerprinting
Tiny HTML shell + large bundles; `console`/`app`/`dashboard`/`portal` subdomains; `*api*` hosts in recon.

## Validation
Response differential vs control; cross-endpoint ID pivots (`account_id` → other endpoints) prove router reachability; **stop at minimal proof** (`totalCount`/few records), never enumerate the table; never POST `create`/`signup`/`upload` as proof (destructive writes need explicit authorization).

## Common Mistakes
"App needs login so API is protected"; naive URL grep on minified bundles; over-claiming AIza keys (most are Maps/analytics); assuming 404 = no API (try other base/method).

## PARAMETER COVERAGE — every route, every param, both methods (MANDATORY)
The #1 miss: testing only a handful of "interesting" routes unauthenticated and
skipping the rest of the bundle-derived route map.

1. **Enumerate the FULL route map** from bundles: every route literal, every
   versioned base (`/api/v1`, `/api/v2`, `/internal`, `/admin`), every
   documented path param, and every query key the frontend sends. Prepend the
   base yourself — minified bundles store route segments, not URLs.
2. **Test EVERY route unauthenticated AND with a low-priv token**, with GET and
   POST (and PUT/DELETE/PATCH) each — a route gated for one verb may be open
   for another.
3. **For every route, enumerate its parameters** (query keys, path IDs, JSON/
   form body keys recursive, headers the SPA sends) and sweep:
   - authz: missing-Authorization behavior, `400 mandatory-field` =
     reached business logic without auth
   - IDOR: swap every object-id param
   - injection: SQLi/BSQLi/NoSQLi/SSTI/CMDi on every string param
   - mass assignment: `is_admin`/`role_id`/`account_type`/`verified` on every
     write route
4. **Cross-endpoint ID pivots**: any `account_id`/`user_id`/`org_id` returned
   by one route → feed to every other route that accepts an ID.
5. **dev-/beta-/staging- variants of every route**, and alternate bases.
6. **Re-sweep per auth context** (anon, user A, user B, admin).
7. **Track** `route → method → param → result` in the journal; every unlogged
   route/param = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: shadow-api — 243 disclosed H1 reports (74 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `url`
- `id`
- `maxResults`
- `client_id`
- `referrer`
- `config`
- `type`
- `password`
- `path`
- `skin`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] RCE when removing metadata with ExifTool** (Code Injection)
  - Signal: ### Summary When uploading image files, GitLab Workhorse passes any files with the extensions [jpg|jpeg|tiff](https://gitlab.com/gitlab-org/gitlab/-/blob/v13.10.2-ee/workhorse/inte
- **[critical] [meemo-app] Denial of Service via LDAP Injection** (LDAP Injection)
  - Signal: I would like to report `Denial of service via LDAP Injection` vulnerability in `meemo-app` module. It allows a malicious attacker to send a crafted input that is interpreted as an 
- **[critical] Exposed GIT repo on ██████████[HtUS]** (Cleartext Storage of Sensitive Information)
  - Signal: Git metadata directory (.git) was found in this folder. An attacker can extract sensitive information by requesting the hidden metadata directory that version control tool Git crea
- **[critical] RCE via unsafe inline Kramdown options when rendering certain Wiki pages** (Code Injection)
  - Signal: ### Summary When rendering wiki content with certain extensions such as `.rmd`, `render_wiki_content` will call [`other_markup_unsafe`](https://gitlab.com/gitlab-org/gitlab/-/blob/

### Class: spa-api — 703 disclosed H1 reports (225 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `id`
- `client_id`
- `type`
- `name`
- `sentry_key`
- `_m`
- `oauth_token`
- `iclLayout`
- `state`
- `key`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] HTML injection in API response including request url** (Remote File Inclusion)
  - Signal: Hi Reddit , I found a way to distribute, persist & store Illegal images such as child porn , beheadings on reddit and in plain sight . I can also store & distribute xml ,json data 
- **[critical] [hta3] Remote Code Execution on ████** (Code Injection)
  - Signal: **Note** In the days leading up to this event, I looked at `███████` due to the ████████ press release which described this as the scope for this event. I understand that this is o
- **[critical] .git folder exposed [HtUS]** (Information Disclosure)
  - Signal: Heyy there, I have found a exposed .git folder on https://█████ https://████████/.git/config ``` [core] repositoryformatversion = 0 filemode = true bare = false logallrefupdates = 
- **[critical] Multiple HTTP Smuggling reports** (HTTP Request Smuggling)
  - Signal: Theses reports spreads other several years and are all about **HTTP Smuggling issues** (HTTP Requests or Responses splitting, Cache Poisoning, Security filter bypass). I've made re

