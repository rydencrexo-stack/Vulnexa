# PHASE 2: LEARN (Pre-Hunt Intelligence)

## Read Disclosed Reports

```bash
# By program on HackerOne
curl -s "https://hackerone.com/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ hacktivity_items(first:25, order_by:{field:popular, direction:DESC}, where:{team:{handle:{_eq:\"PROGRAM\"}}}) { nodes { ... on HacktivityDocument { report { title severity_rating } } } } }"}' \
  | jq '.data.hacktivity_items.nodes[].report'
```

## "What Changed" Method

1. Find disclosed report for similar tech
2. Get the fix commit
3. Read the diff — identify the anti-pattern
4. Grep your target for that same anti-pattern

## CVE-Seeded Audit Approach

1. **Build a CVE eval set** — collect 5-10 prior CVEs for the target codebase
2. **Reproduce old bugs** — verify you can find the pattern in older code
3. **Pattern-match forward** — search for the same anti-pattern in current code
4. **Focus on wide attack surfaces** — JS engines, parsers, anything processing untrusted external input

## Threat Model Template

```
TARGET: _______________
CROWN JEWELS: 1.___ 2.___ 3.___
ATTACK SURFACE:
  [ ] Unauthenticated: login, register, password reset, public APIs
  [ ] Authenticated: all user-facing endpoints, file uploads, API calls
  [ ] Cross-tenant: org/team/workspace ID parameters
  [ ] Admin: /admin, /internal, /debug
HIGHEST PRIORITY (crown jewel x easiest entry):
  1.___ 2.___ 3.___
```

## 6 Key Patterns from Top Reports

1. **Feature Complexity = Bug Surface** — imports, integrations, multi-tenancy, multi-step workflows
2. **Developer Inconsistency = Strongest Evidence** — `timingSafeEqual` in one place, `===` elsewhere
3. **"Else Branch" Bug** — proxy/gateway passes raw token without validation in else path
4. **Import/Export = SSRF** — every "import from URL" feature has historically had SSRF
5. **Secondary/Legacy Endpoints = No Auth** — `/api/v1/` guarded but `/api/` isn't
6. **Race Windows in Financial Ops** — check-then-deduct as two DB operations = double-spend

## Mindset Rules

- "Authorization inconsistency is your friend" — 9 places check auth, the 10th doesn't.
- "New == unreviewed" — features launched in the last 30 days have lowest security maturity.
- "Think second-order" — second-order SSRF: URL saved in DB, fetched by cron job. Second-order XSS: stored clean, rendered unsafely in admin panel.
- "Follow the money" — payments, billing, credits, refunds = shortcuts.
- "Diffs find bugs" — compare old API docs vs new, mobile API vs web API, free vs paid user responses.

## Pre-Hunt Mental Checklist

- I know the app's core business model
- I've used the app as a real user for 15+ minutes
- I know the tech stack (language, framework, auth system, caching)
- I've read at least 3 disclosed reports for this program
- I have 2 test accounts ready (attacker + victim)
- I've defined my primary target: ONE crown jewel I'm hunting for today

## Rust/Blockchain Source Code (Hard-Won Lessons)

- **Panic paths: encoding vs decoding** — `.unwrap()` on an encoding path is NOT attacker-triggerable. Only panics on deserialization/decoding of network input are exploitable.
- **"Known TODO" is not a mitigation** — a comment like `// Votes are not signed for now` doesn't mean safe.
- **Pattern-based hunting from confirmed findings** — if `verify_signed_vote` is broken, check `verify_signed_proposal` and `verify_commit_signature`.
