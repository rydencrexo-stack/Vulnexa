---
name: hunt-cors
description: Cross-origin resource sharing misconfiguration hunting — origin reflection + ACAC credentialed read (the only High), null-origin trust via sandbox iframe, regex-bypass table, two browser rules that kill findings (ACAO:* can't carry creds; ACAC alone proves nothing), browser-only PoC requirement (curl ignores CORS), per-test OOB markers. Use when CORS headers are reflected or Origin checks look loose on authed endpoints. Trigger keywords: CORS, ACAO, Access-Control-Allow-Origin, credentialed cross-origin, null origin.
---

# CORS Misconfiguration — Deep Hunting

## THE GATE
Most valuable vectors:
1. Origin reflection + `ACAC: true` on authed endpoints returning PII/tokens — the only High.
2. Null-origin trust (`ACAO: null` + creds) via sandbox iframe (`allow-scripts`, NOT `allow-same-origin`) or `data:`/redirect-chain.
3. Pre-flight OPTIONS authorizing arbitrary methods/headers → cross-origin state change.
4. Subdomain-takeover into trusted-origin regex → credentialed read.
5. postMessage handlers with loose checks.

## Regex-Bypass Table (match the flaw class first)
| Flaw | Payload |
|---|---|
| Missing `\.` | `https://eviltarget.com` |
| Missing `$` anchor | `https://x.target.com.evil.com` |
| Prefix-only | `https://target.com.evil.com` |
| Unescaped dot | `https://evilZtargetZcom` |
| Weird-parser | backtick/underscore variants |

Reflection of `evil.target.com` is NOT a bug unless you control a `*.target.com` host.

## Two Browser Rules That Kill Findings
- `ACAO: *` cannot combine with credentials (wildcard-only = Info).
- `ACAC: true` alone proves nothing.
- **curl ignores CORS** — browser PoC mandatory: `fetch(url,{credentials:'include'}).then(r=>r.text())`; TypeError/BLOCKED = not a finding.

## Validation
OOB exfil of the readable authed body to Collaborator with per-test marker; prove sensitive body (health endpoint = nothing); match regex-class to payload before submitting; severity High only with browser-proven credentialed read.

## Common Mistakes
Header-diffs without browser proof; claiming `ACAO:*`+creds; `-I`/HEAD (some servers only emit CORS on GET); treating OPTIONS reflection as the read-path; missing that pre-flight ≠ real request — always test GET/POST directly.

## PARAMETER COVERAGE — every origin-controlled endpoint (MANDATORY)
The #1 miss: testing only the endpoints you noticed reflected the Origin and
skipping the rest. CORS misconfigs vary per route — one endpoint may be
locked while a sibling leaks.

1. **Enumerate** every authenticated endpoint that returns sensitive data or
   tokens (PII, profiles, invoices, settings, exports, search) — and test
   EACH, not just one.
2. **For every endpoint sweep the Origin matrix**:
   - benign attacker origin `https://evil.com` (reflection? ACAC? ACAO?)
   - trusted-subdomain variants: `https://x.target.com.evil.com`,
     `https://target.com.evil.com`, `https://eviltarget.com`
   - `null` origin (via sandbox iframe `allow-scripts` / `data:` redirect)
   - regex-bypass payloads matched to the ACTUAL flaw class (missing dot,
     missing anchor, prefix-only, unescaped dot)
   - header-derived: `Origin: null`, multiple origins, `Origin: https://evil.com\n`
3. **Check the credential path**: does the response carry `ACAC: true` with a
   reflected (non-`*`) ACAO? Test GET and POST directly (HEAD/OPTIONS-only
   reflection is a false lead).
4. **Browser-proof is mandatory**: `fetch(url,{credentials:'include'})` must
   actually return the body — curl ignores CORS and proves nothing.
5. **Re-sweep per auth context** (logged-out vs user A vs user B).
6. **Track** `endpoint → origin → ACAO/ACAC → browser-read?` in the journal;
   every unlogged endpoint = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: cors — 212 disclosed H1 reports (58 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `url`
- `maxResults`
- `page`
- `state`
- `id`
- `client_id`
- `host`
- `Password`
- `code`
- `scope`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] One-click account hijack for anyone using Apple sign-in with Reddit, due to response-type switch + leaking href to XSS on www.redditmedia.com** (Improper Access Control - Generic)
  - Signal: Hi, # Description I've been researching new ways to steal OAuth codes and access-tokens using postMessage, and I found a way for me to steal the code and/or access-token from Apple
- **[critical] Misconfigurated login page able to lock login action for any account without user interaction** (None)
  - Signal: ## Summary While observing a few things about the login feature, I found that the account was locked after a certain number of requests. Although this feature is actually added to 
- **[critical] RCE via File Upload with a Null Byte Truncated File Extension at https://██████/** (Command Injection - Generic)
  - Signal: Hi, I found "repos" at `https://███/` and `https://c█████████/` and this one (which doesn't have the file upload functionality appearing on the DOM, but it still may be there) `htt
- **[critical] SSRF to AWS file read** (Server-Side Request Forgery (SSRF))
  - Signal: ## Summary: after seeing the disclosure it looks like the bug was not fixed properly ## Steps To Reproduce: copy and paste the request below and paste it into Burpsuite repeater `G

