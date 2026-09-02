---
name: hunt-source-leak
description: Source / build artifact leakage — source-map hash-rotation trap (re-derive live hash), .js.map reconstruction, .git exposure via git-dumper, .env variants, swagger/OpenAPI maps, .DS_Store, build-info commit hash → CVE targeting, trufflehog secret sweep. Use when .env, .git/HEAD, .js.map, swagger, or build artifacts reachable. Trigger keywords: source leak, source map, .git exposed, .env, git-dumper, source disclosure.
---

# Source / Build Artifact Leakage — Deep Hunting

## THE GATE — Source-Map Hash-Rotation Trap (the big non-obvious one)
Bundle filenames are content-hashed; a `.map` at an old hash 404s after redeploy while the map is still fully exposed under the new hash. A 404 ≠ remediation — derive the current hash live from the page (`grep -oE 'main\.[a-f0-9]+\.js'`) before testing AND re-verifying. Only `GENERATE_SOURCEMAP=false` + CDN purge actually fixes it.

## Attack Vectors
`.js.map` reconstructs TS/ES6 sources → API routes, auth logic, hardcoded keys; swagger/openapi gives full endpoint map; `.git/` exposure → `git-dumper` → full history; webpack chunks; `.DS_Store` directory listing; `asset-manifest.json`/`_next/static/<buildId>/_buildManifest.js`.

## Key Commands
```
/.env /.env.production /.git/HEAD /swagger.json /openapi.json /api-docs
pip3 install git-dumper; git-dumper "https://T/.git/" /tmp/repo/
git grep -i "password|secret" $(git rev-list --all)
trufflehog git file:///tmp/repo/
grep -r "process\.env\." extract/ | grep -v NEXT_PUBLIC_
```

## Fingerprinting
Last-line `sourceMappingURL` check on each JS; `build-info.json` reveals git commit hash → exact version CVE targeting.

## Validation
Reconstructed source must contain endpoints/secrets; `.env` must contain real `DATABASE_URL`/`API_KEY`; `.git` must clone and yield secrets in history. Severity: `.env` with creds / `.git` with history secrets = Critical; source map w/ secrets = High.

## Common Mistakes
Reusing a recorded stale map URL (reporting fixed when nothing changed); skipping source-map extraction of `sourcesContent`; treating robots.txt-only as a finding (Informational).

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

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

### Class: source-leak — 540 disclosed H1 reports (197 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `id`
- `name`
- `type`
- `search`
- `url`
- `scope`
- `textdomain`
- `lang`
- `canary`
- `callback`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] RCE when removing metadata with ExifTool** (Code Injection)
  - Signal: ### Summary When uploading image files, GitLab Workhorse passes any files with the extensions [jpg|jpeg|tiff](https://gitlab.com/gitlab-org/gitlab/-/blob/v13.10.2-ee/workhorse/inte
- **[critical] .git folder exposed [HtUS]** (Information Disclosure)
  - Signal: Heyy there, I have found a exposed .git folder on https://█████ https://████████/.git/config ``` [core] repositoryformatversion = 0 filemode = true bare = false logallrefupdates = 
- **[critical] Multiple HTTP Smuggling reports** (HTTP Request Smuggling)
  - Signal: Theses reports spreads other several years and are all about **HTTP Smuggling issues** (HTTP Requests or Responses splitting, Cache Poisoning, Security filter bypass). I've made re
- **[critical] Remote Command Execution via Github import** (Command Injection - Generic)
  - Signal: ### Summary This is very similar to https://about.gitlab.com/releases/2022/08/22/critical-security-release-gitlab-15-3-1-released/#Remote%20Command%20Execution%20via%20Github%20imp

