---
name: hunt-shadow-api
description: Shadow / zombie API hunting — the delta between old and current API versions, version surface enumeration (path/header/subdomain), Wayback CDX for deprecated specs, behavioral diff (auth, rate-limit, validation, field exposure), swagger/OpenAPI discovery paths. Use when versioned API paths, changelog references, or deprecated specs are present. Trigger keywords: shadow API, zombie API, old version, v1 v2 diff, deprecated endpoint, swagger.
---

# Shadow / Zombie API — Deep Hunting

## THE GATE
The bug is in the **delta** between what an old API version enforces vs the current one.

## Version Surface Enumeration
Path-based (`/v1 /v2 /beta /internal /legacy /api/2023-01-01`), header-based (`X-API-Version: 1`, `Accept: application/vnd.company.v1+json`), subdomain-based (`api-v1`, `legacy-api`, `staging-api`). Any non-404 = still live.

## Wayback CDX for Deprecated Specs
`web.archive.org/cdx/search/cdx?url=TARGET/*swagger*&output=json&collapse=urlkey` — old specs stay indexed after live links are removed. Diff endpoint inventories between specs (`comm` on `jq '.paths|keys'`); old-only routes that still resolve = zombie candidates.

## Behavioral Diff (the finding, not shape diff)
Expired token accepted on v1 but rejected on v2; missing `429` on old version (rate-limit never backported); old version accepts injection/malformed payloads current rejects; old version leaks extra fields (internal IDs, PII) redacted in current.

## Key Probes
Identical requests to both versions comparing auth, rate-limit (burst for 429), validation, field exposure.

## Fingerprinting
Visible versioned paths/headers, changelog references, mobile APK hardcoded endpoints older than web app.

## Validation
Confirm the old endpoint isn't an alias/proxy to current logic — send a payload that would *behave differently*, not compare version strings. A 200 static "deprecated" message is not a finding.

## Common Mistakes
Reporting response-shape/cosmetic differences as findings (Informational); stopping at version reachable without behavioral regression proof.

## PARAMETER COVERAGE — diff EVERY param across EVERY version (MANDATORY)
The #1 miss: comparing only auth/rate-limit on a couple of endpoints and
skipping the parameter-level delta. The behavioral regression lives in a
single parameter of a single old-version route.

1. **Enumerate the FULL surface of EACH version**: every route, and for each
   route every parameter (query keys, path IDs, JSON/form keys recursive,
   headers, cookies) — old version vs current version side by side.
2. **Behavioral-diff EVERY parameter**: identical request to both versions
   comparing auth, rate-limit (burst for 429), input validation, injection
   handling (SQLi/SSTI/malformed), and **field exposure** (extra internal IDs/
   PII/`role`/`is_admin`/tokens present in old, redacted in new).
3. **Sweep injection on old-version params** the current version rejects —
   the old version may be the vulnerable one.
4. **Version surface enum on EVERY base**: `/v1`, `/v2`, `/beta`, `/internal`,
   `/legacy`, date-stamped, header-selected (`X-API-Version`, `Accept:
   application/vnd.*`), subdomain variants; Wayback CDX for removed specs.
5. **Re-sweep per auth context** — old version may skip checks for a
   particular role.
6. **Track** `version → route → param → diff/result` in the journal; every
   unlogged param = gap.

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

