---
name: triage-validation
description: Finding validation before writing any report — 7-Question Gate (ask in order, one wrong = kill), layer-ordering trap (validation error ≠ auth bypass), 4 pre-submission gates, never-submit list, conditionally-valid-with-chain table, CVSS 3.1 quick reference, kill-fast rules, pre-severity gate, retraction discipline. Use BEFORE writing any report. Saves your validity ratio. Trigger keywords: validate, triage, is this a bug, report checklist, severity, N/A.
---

# Triage & Validation

One wrong answer = STOP **this finding**. Kill the finding. Move on to the next test class. (Killing a finding ≠ stopping the engagement — every other test class is still pending.)

> "N/A hurts your validity ratio. Informative is neutral. Only submit what passes all 7 questions."

## THE 7-QUESTION GATE (in order)

- **Q1: Can an attacker use this RIGHT NOW, step by step?** Fill: Setup (own account / other user's ID / no account) → Request (exact method+URL+headers+body) → Result (read/modify/delete exact data) → Impact (ATO/PII/money) → Cost (minutes, $0 or subscription). **If you CANNOT write step 2 as a real HTTP request → KILL.**
- **Q2: Is the impact on the program's accepted impact list?** Check program scope / "Out of Scope" / Vulnerability Types. Maps to an exclusion → KILL.
- **Q3: Is the root cause in an in-scope asset?** In-scope domain (not `*.internal.target.com`), production (not staging), not third-party SaaS the company just uses → else KILL.
- **Q4: Does it require privileged access an attacker can't realistically get?** "Admin can do X" = centralization risk = KILL on 99% of programs. Non-admin doing admin-only things = valid.
- **Q5: Is this already known or accepted behavior?** Search program's disclosed reports, GitHub issues, changelog, API docs. Acknowledged/design decision → KILL.
- **Q6: Can you prove impact beyond "technically possible"?** XSS → cookie theft not alert(1); SSRF → internal endpoint with data not DNS ping; SQLi → real table exfil; IDOR → other-user data in response not 200. Can't → DOWNGRADE, not kill.
- **Q7: Is this a known-invalid bug class?** See NEVER SUBMIT list. On it without a chain → KILL.

## THE LAYER-ORDERING TRAP (read before claiming any auth bypass)

**A validation error does NOT prove you passed authentication.** Many stacks put a global input sanitiser/body parser/schema filter in front of the auth middleware — a malformed body is rejected before auth is consulted, and the response is indistinguishable from "auth passed, validation failed."

```
curl -s -X POST https://target/api/v1/resource -d '{'          # 400 "Invalid text"  <- sanitiser, runs FIRST
curl -s -X POST https://target/api/v1/resource -H 'Content-Type: application/json' -d '{}'   # 401 "Not authenticated"
```
Only the second response tells you where the auth layer sits. Probe auth with the *simplest valid* body, not a malformed one. Error about **input shape/character class** = parser; error naming a **domain field** (`accountId is required`) + well-formed body still returning it = real signal. Applies equally to WAF/CDN edge blocks.

## 4 PRE-SUBMISSION GATES
- **Gate 0 Reality** (30s): real HTTP-confirmed, in scope, reproducible fresh, evidence ready.
- **Gate 1 Impact** (2min): what can attacker DO now; real victim; not "see non-sensitive data"; not relying on unlikely victim action.
- **Gate 2 Dedup** (5min): searched hacktivity, GitHub issues, last 5 disclosed reports, changelog, Google.
- **Gate 3 Quality** (10min): title `[Class] in [Endpoint] allows [actor] to [impact]`; copy-pasteable request; evidence of actual impact; CVSS 3.1 matching; 1-2 sentence fix; **never "could potentially"/"may allow"**.

## NEVER SUBMIT LIST
Missing CSP/HSTS/security headers; missing SPF/DKIM/DMARC; GraphQL introspection alone; banner/version disclosure without working CVE exploit; clickjacking on non-sensitive pages; tabnabbing; CSV injection without code exec; CORS wildcard without credentialed exfil PoC; logout CSRF; self-XSS; open redirect alone; OAuth client_secret in mobile app; SSRF DNS-callback only; host-header injection alone; rate limit on non-critical forms; session not invalidated on logout; concurrent sessions; internal IP in error message; mixed content; SSL weak ciphers; missing HttpOnly/Secure flags alone; broken links; autocomplete on password; pre-account takeover (usually).

## CONDITIONALLY VALID — CHAIN REQUIRED
| Standalone | Chain Required | Valid Result |
|---|---|---|
| Open redirect | + OAuth redirect_uri → code theft | ATO (Critical) |
| Clickjacking | + sensitive action + working PoC | Medium |
| CORS wildcard | + credentialed request exfils PII | High |
| CSRF | + transfer funds / change email / delete | High |
| Rate limit bypass | + OTP/reset token brute succeeds | Medium/High |
| SSRF DNS-only | + internal service + data returned | Medium |
| Host header injection | + reset email uses injected host | High |
| Prompt injection | + reads other user's data (IDOR) | High |
| Self-XSS | + CSRF to trigger on victim | Medium |
| Subdomain takeover | + OAuth redirect_uri at that subdomain | Critical |
| GraphQL introspection | + auth-bypass mutation or IDOR on node() | High |

## CVSS 3.1 QUICK REFERENCE
| Finding | Score | Vector |
|---|---|---|
| IDOR read PII, auth required | 6.5 Medium | AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N |
| IDOR write/delete | 7.5 High | AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N |
| Auth bypass → admin | 9.8 Critical | AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H |
| Stored XSS → cookie theft | 8.5 High | AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:L/A:N |
| SQLi → full DB dump | 9.1 Critical | AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N |
| SSRF → cloud metadata | 9.1 Critical | AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:N |
| Race → double spend | 7.5 High | AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:N |
| JWT none algorithm | 9.1 Critical | AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H |

Metrics: internet=AV:N; no race=AC:L; free acct=PR:L; no login=PR:N; admin=PR:H; no victim=UI:N; click=UI:R; read all=C:H; read some=C:L; modify all=I:H; crash=A:H; app-only=S:U; browser/OS/cloud=S:C.

## KILL FAST RULES
5-minute rule (can't fill Q1 in 5min → move on); >2 simultaneous preconditions → kill; "what does attacker walk away with?" — nothing tangible → kill; "Admin can do X" → kill; documented behavior → kill; 30+ min on Q6 without reproducible PoC → kill.

## PRE-SEVERITY GATE (before labeling Critical/High anywhere)
1. Validated the FULL chain to attacker-attainable impact, or only one primitive? (Primitive at layer N ≠ exploitable.)
2. What does the attacker walk away with, in one concrete sentence? ("RCE on SP front-end" concrete; "could lead to RCE" = High at best.)
3. Reproduced the full chain end-to-end at least twice?
4. Any inheritance/signature/audience check still gating? → not Critical; document as primitive at lower severity.
5. Has the program rejected this severity class before?

**Lesson:** JWT alg:none was labeled Critical based on signature-bypass primitive — issuer-trust check still rejected unsigned tokens. Full chain didn't complete. Had to retract.

## ANTI-PATTERNS THAT LOSE MONEY
Report before confirming bug exists; theoretical impact without proof; "API returns more fields than necessary" without sensitivity; chaining A+B when they're separate bugs (two payouts); reporting B saying "similar to A"; overclaiming severity; under-describing impact.

## RETRACTION DISCIPLINE
Never silently drop a failed finding — document the retraction in the report's appendix. Template:
```markdown
### Retracted: <finding>
- Original signal: ...
- Disproving evidence: <concrete step + observation>
- Why it looked like a bug: <root cause of FP — marker collision, jitter, status-only>
- Retraction date: ...
```
If a finding stops reproducing 24h after submission — retract preemptively. Self-retraction reads "researcher validates own work"; triager-retraction reads "researcher submitted noise."

## THE 7Q GATE AT SCALE — four FP shapes it kills
1. URL echo dressed as reflection (response IS the URL).
2. Word collision dressed as marker hit (canary matched a CSS class).
3. Server policy mistaken for state oracle (deny-list ≠ file existence).
4. 200 OK without leak (status differs, body byte-identical — Body-Diff Rule).