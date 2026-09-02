---
name: hunt-lfi
description: Local File Inclusion hunting — PHP filter-chain → RCE (iconv Synacktiv 2022), wrapper matrix (php://filter, data://, php://input, expect://, phar://, zip://), bypass tables, Apache CVE-2024-4577 PHP-CGI on Windows, named CVE probes, log poisoning with readability pre-check, base64 source reads. Use when params like page/file/path/template/view/module/load/theme/dir hit a file-include sink. Trigger keywords: LFI, file inclusion, path traversal read, php wrapper.
---

# Local File Inclusion — Deep Hunting

## THE GATE
Params: `page/file/path/template/view/lang/module/load/read/theme/dir`. Fingerprint: `X-Powered-By: PHP`; Apache banner 2.4.49/50; Java `/WEB-INF/`; Windows `..\..\web.config`.

## PHP Filter-Chain → RCE (modern default)
A bare `php://filter` read **upgrades to execution with no upload/writable file** via chained `iconv` conversions forging `<?php ... ?>` in-memory (Synacktiv 2022). Always base64-encode source reads (`convert.base64-encode/resource=`) or PHP parses/swallows it.

## Wrapper Matrix
| Wrapper | Requirement |
|---|---|
| `data://text/plain;base64,` | `allow_url_include=On` |
| `php://input` | `allow_url_include=On` |
| `expect://id` | rare `expect` extension |
| `phar://` | unserialize-on-metadata sink |
| `zip://...%23path/inside.txt` | zip with entry |

## Bypass Table
`../` stripped once → `....//`; double-decode → `%252f`; appended extension → `?`/`#` truncation or `%00` (PHP<5.3.4); `php://` blocked → `pHp://`/`data://`; base prepend → pad `../` or absolute path.

## Named CVE Probes
- Apache 2.4.49/2.4.50 (`--path-as-is` required; curl normalizes `%2e` otherwise).
- PHP-CGI arg injection on Windows CVE-2024-4577 (XAMPP).

## Log Poisoning
Needs a **readability check first** — verify the log is readable plain before poisoning.

## Validation
Show real file *contents* (`root:x:0:0:` line), never an echoed path; base64 must decode to valid PHP; negative control `/etc/passwd_<rand>`; blind requires unique Collaborator sub-tag per sink (DNS+HTTP) or triple-confirmed length/timing delta.

## Common Mistakes
Claiming LFI from a 403/500 diff (may be `../`-string matching); treating echoed path in an error as proof; one-off timing deltas; truncated reads reported as full.

## Escalation
LFI → `/proc/self/environ`, `/proc/self/cmdline` leak env/cloud keys; filter-chain → RCE.

## PARAMETER COVERAGE — traverse EVERY param (MANDATORY)
The #1 miss: testing only params literally NAMED file/page/path/template and
skipping every other parameter. LFI hides in IDs, language/locale params, sort
keys, export/theme params, error pages, and any value that ever feeds a
filesystem path or `include()`/`file_get_contents()`.

1. **Enumerate** every query key, path segment, form/JSON key, header
   (`User-Agent`, `Referer`, `X-Forwarded-For` → log-poisoning paths), and
   cookie.
2. **On EACH parameter run the traversal ladder**:
   - `../../../../etc/passwd` (+ up one level at a time to calibrate depth)
   - `..%2f..%2f..%2fetc/passwd`, `%252e%252e%252f` (double-decode),
     `....//....//`, `..;/` (Tomcat), backslash `..\..\web.config` (Windows)
   - absolute path `/etc/passwd`
   - wrapper matrix (if PHP): `php://filter/convert.base64-encode/resource=`,
     `data://`, `php://input`, `expect://`, `phar://`, `zip://`
   - null byte / `?`/`#` truncation for appended-extension cases
3. **A parameter that appends a value to a path** (e.g. `?file=uploads/X`) is
   a candidate — test traversal from it, not just full-path params.
4. **Log-poisoning**: test every header into the access log, then include the
   log file — but ONLY after confirming the log is readable plain (negative
   control first).
5. **WAF block → bypass ladder** (double-encode, case, `%09`, path-as-is with
   `--path-as-is`), never drop the param.
6. **Track** `endpoint → param → encoding → result` in the journal; unlogged
   param = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: lfi-path-traversal — 207 disclosed H1 reports (134 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `type`
- `textdomain`
- `lang`
- `app`
- `platform`
- `resource-type`
- `name`
- `path`
- `version`
- `vector`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Arbitrary file read via the bulk imports UploadsPipeline** (Path Traversal)
  - Signal: ### Summary The bulk imports api does not remove symlinks when untaring the uploads.tar.gz file, allowing arbitrary files to be read and uploaded when importing a group. When a gro
- **[critical] path traversal vulnerability in Grafana 8.x allows " local file read "** (None)
  - Signal: Hi team, I've found a path traversal issue in the Grafana instances hosted on the MTN platforms. With the path traversal it's possible for an unauthenticated user to read arbitrary
- **[critical] GitLab CI runner can read and poison cache of all other projects** (Path Traversal)
  - Signal: The GitLab CI runner allows users to cache files and directories in between runs. These files are stored in a ZIP file and uploaded to a shared cache instance. In my testing, the f
- **[critical] RCE as Admin defeats WordPress hardening and file permissions** (Path Traversal)
  - Signal: This vulnerability was found when I found myself in the following scenario: My collegue set up WordPress on his local machine and challenged me to hack it. Before he gave me admin 

