---
name: hunt-exceptional
description: Exceptional condition / error-handling hunting — one unexpected input at a time (wrong type, malformed JSON, wrong content-type, oversized/negative/overflow numbers, null bytes), watch response body not status, framework error-page success signatures (Sequelize, PHP warnings, Python traceback, Java stack, YSOD), fingerprint → arm SQLi/LFI/RCE. Use when any parameter can receive unexpected types or when error pages leak internals. Trigger keywords: error handling, exception, stack trace, 500, verbose error, malformed input.
---

# Exceptional Conditions — Deep Hunting

## THE GATE
Feed one unexpected input at a time: wrong type (`{"rating":"x","comment":[1,2,3]}`), malformed/truncated JSON, wrong Content-Type, oversized/negative/overflow numbers, null bytes (`/item/%00`). Watch the **response body**, not status. A 200/400/500 containing a framework error page = the finding.

## Success Signatures
Node `SequelizeDatabaseError`/`node_modules/...`; PHP `<b>Warning</b> /var/www/...:line N`; Python `Traceback...werkzeug`; Java `at com.app.Foo(Foo.java:42)`; .NET `Server Error in '/' Application` (YSOD).

## Fingerprinting
Error pages disclose ORM, absolute paths, library versions — these arm SQLi/LFI/RCE next.

## Validation
Clean JSON error with no internals is NOT a finding; capture the exact leaked artifact (path, class, version, stack frame) as evidence.

## Common Mistakes
"It returned 500" without a disclosure artifact; not noting what the leak enables downstream.

## PARAMETER COVERAGE — wrong-type on EVERY parameter (MANDATORY)
The #1 miss: feeding odd types only to a couple of "input-heavy" params and
skipping the rest. Exceptional-condition bugs (stack traces, ORM leaks, parser
differentials) hide in ANY parameter that is cast/validated/queried server-side
— including numeric IDs, booleans, arrays, nested objects, and empty strings.

1. **Enumerate** the complete input set (query keys, path segments, every
   JSON/form key recursively, headers, cookies, GraphQL args).
2. **On EACH parameter run the type ladder**, one mutation at a time:
   - wrong type: send an ARRAY `[1,2,3]`, an OBJECT `{}`, a BOOLEAN, a float,
     a null, and a very long string where a string is expected
   - wrong type on numeric params: string `"abc"`, negative, overflow
     (`99999999999999999999`), `1e999`/`NaN`, empty
   - malformed JSON body (truncate, duplicate keys, trailing commas, `NaN`)
   - wrong Content-Type on each endpoint (send XML to JSON parser, form to JSON)
   - null bytes `%00` in path/params
3. **Observe the response BODY, not just the status**: a 200/400/500 containing
   a framework error page (Sequelize/`node_modules`, PHP Warning, Python
   traceback, Java stack, YSOD) is the artifact. Record the exact leaked path,
   class, version, stack frame.
4. **Fingerprint → arm the next class**: every leaked ORM/library/absolute path
   feeds SQLi/LFI/RCE payload selection.
5. **Re-sweep per context**: anon vs authed, per role, per content-type.
6. **Track** `endpoint → param → type → status/artifact` in the journal; every
   unlogged param = gap.