# PHASE 4: VALIDATE + PHASE 5: REPORT

## The 7-Question Gate (Run BEFORE Writing ANY Report)

All 7 must be YES. Any NO → STOP.

### Q1: Can I exploit this RIGHT NOW with a real PoC?
Write the exact HTTP request. If you cannot produce a working request → KILL IT.

### Q2: Does it affect a REAL user who took NO unusual actions?
No "the user would need to..." with 5 preconditions. Victim did nothing special.

### Q3: Is the impact concrete (money, PII, ATO, RCE)?
"Technically possible" is not impact. "I read victim's SSN" is impact.

### Q4: Is this in scope per the program policy?
Check the exact domain/endpoint against the program's scope page.

### Q5: Did I check Hacktivity/changelog for duplicates?
Search the program's disclosed reports and recent changelog entries.

### Q6: Is this NOT on the "always rejected" list?
Check the list below. If it's there and you can't chain it → KILL IT.

### Q7: Would a triager reading this say "yes, that's a real bug"?
Read your report as if you're a tired triager at 5pm on a Friday. Does it pass?

## 4 Pre-Submission Gates

### Gate 0: Reality Check (30 seconds)
- [ ] The bug is real — confirmed with actual HTTP requests, not just code reading
- [ ] No third-party data was accessed beyond what's needed to prove impact
- [ ] No destructive action was taken (no data modification on accounts you don't own)

### Gate 1: Not on the "Always Rejected" List

| Finding | Reason |
|---|---|
| Self-XSS | Not exploitable on other users |
| Missing security headers (HSTS, CSP) alone | Policy, not bug |
| Information disclosure of own data | No impact |
| Open redirect alone | Need ATO or OAuth chain |
| SPF/DKIM/DMARC missing | Low/informational, usually N/A |
| Email enumeration | Usually N/A unless rate-limit bypass exists |
| Path traversal with no readable files | No impact |
| Default server banners | Informational |
| CORS misconfig without sensitive data | No impact |
| Lack of rate limiting on non-sensitive endpoint | N/A |
| Vulnerable third-party dependency with no PoC | N/A |
| TLS/SSL issues | N/A |
| CSRF without a security-sensitive action | N/A |
| Self-reported XSS, or XSS on yourself only | N/A |

### Gate 2: Duplicate Check
- [ ] Checked Hacktivity for the program
- [ ] Checked the program's changelog/recent disclosures
- [ ] Searched Google/GitHub for the exact bug pattern

### Gate 3: Impact Re-check
- [ ] I can state in ONE sentence what harm occurs
- [ ] The harm is to a real user, not me
- [ ] I have a concrete number (N users, $X, N records)

## Report Writing (Human-Tone, Not Robot)

### Structure
```
## Summary
One paragraph: what the bug is, where, and the real-world impact. Lead with impact.

## Vulnerability Description
Technical explanation. What's broken and why. 2-4 sentences.

## Steps to Reproduce (Numbered, Copy-Pasteable)
1. Create accounts A and B at <URL>
2. Login as A, navigate to <endpoint>, note request
3. ...
4. (Include the exact HTTP request as a code block)

## Impact
- What an attacker gains
- Affected users/records (quantify)
- Worst-case chain (if applicable)

## PoC
- Full HTTP request(s)
- Screenshot/video of proof (before/after states)
```

### Writing Rules
- **Human tone**: "I noticed that..." not "The application fails to validate..."
- **Lead with impact**, not the vuln class. Triager reads the title first.
- **Reproduction must be exact**: copy-pasteable numbered steps, full request headers, no "etc."
- **One report per chain**, not one per bug. Chains pay 3-10x more.
- **Don't oversell or undersell severity** — let CVSS 3.1 + impact speak.
- **Screenshots**: before/after that clearly shows the difference. Redact sensitive data if needed.

### Title Format
`[Vuln Class] in <feature> leads to <concrete impact>`

Good: `IDOR in /api/v2/invoices/{id} allows reading any user's invoice with PII`
Bad: `IDOR vulnerability`

## CVSS 3.1 Quick Reference

### Factor Scoring Guide

| Factor | Low (0-3.9) | Medium (4-6.9) | High (7-8.9) | Critical (9-10) |
|---|---|---|---|---|
| Attack Vector | Physical | Local | Adjacent | Network |
| Privileges Required | High | Low | None | None |
| User Interaction | Required | Required | None | None |
| Impact | Partial | Partial | High | High (all 3) |

### Vector String Reference

| Vector | Meaning |
|---|---|
| AV:N | Network |
| AV:A / AV:L / AV:P | Adjacent / Local / Physical |
| AC:H / AC:L | Attack Complexity High / Low |
| PR:N / PR:L / PR:H | Privileges Required None / Low / High |
| UI:R / UI:N | User Interaction Required / None |
| S:U / S:C | Scope Unchanged / Changed |
| C/A/I + H/M/L/N | Confidentiality/Integrity/Availability + High/Medium/Low/None |

### Severity → score bands
- Critical: 9.0–10.0 | High: 7.0–8.9 | Medium: 4.0–6.9 | Low: 0.1–3.9

### Typical Scores by Bug Class (calibrate your claim)

| Bug | Typical CVSS | Severity |
|---|---|---|
| IDOR (read PII) | 6.5 | Medium |
| IDOR (write/delete) | 7.5 | High |
| Auth bypass → admin | 9.8 | Critical |
| Stored XSS | 5.4–8.8 | Med–High |
| SQLi (data exfil) | 8.6 | High |
| SSRF (cloud metadata) | 9.1 | Critical |
| Race condition (double spend) | 7.5 | High |
| GraphQL auth bypass | 8.7 | High |
| JWT none algorithm | 9.1 | Critical |

### Quick severity heuristics
- **Critical**: RCE, full ATO, mass PII exfil, cloud credential theft, SQLi on auth
- **High**: privilege escalation, stored XSS on admin, IDOR write, SSRF → internal data
- **Medium**: reflected XSS, IDOR read of PII, CSRF on account-changing action
- **Low/Info**: open redirect (unless chained), minor info leak, missing headers

## Always Rejected — Never Submit These

Missing CSP/HSTS/security headers, missing SPF/DKIM/DMARC, GraphQL introspection alone, banner/version disclosure without working CVE exploit, clickjacking on non-sensitive pages, tabnabbing, CSV injection, CORS wildcard without credential exfil PoC, logout CSRF, self-XSS, open redirect alone, OAuth client_secret in mobile app, SSRF DNS-ping only, host header injection alone, no rate limit on non-critical forms, session not invalidated on logout, concurrent sessions, internal IP disclosure, mixed content, SSL weak ciphers, missing HttpOnly/Secure cookie flags alone, broken external links, pre-account takeover (usually), autocomplete on password fields.

**N/A hurts your validity ratio. Informative is neutral. Only submit what passes the 7-Question Gate.**

## Conditionally Valid With Chain

These low findings become valid bugs when chained:

| Low Finding | + Chain | = Valid Bug |
|---|---|---|
| Open redirect | + OAuth code theft | ATO |
| Clickjacking | + sensitive action + PoC | Account action |
| CORS wildcard | + credentialed exfil | Data theft |
| CSRF | + sensitive state change | Account takeover |
| No rate limit | + OTP brute force | ATO |
| SSRF (DNS only) | + internal access proof | Internal network access |
| Host header injection | + password reset poisoning | ATO |
| Self-XSS | + login CSRF | Stored XSS on victim |

## Report Templates

### HackerOne Template

```
Title: [Vuln Class] in [endpoint/feature] leads to [Impact]

## Summary
[2-3 sentences: what it is, where it is, what attacker can do]

## Steps To Reproduce
1. Log in as attacker (account A)
2. Send request: [paste exact request]
3. Observe: [exact response showing the bug]
4. Confirm: [what the attacker gained]

## Supporting Material
[Screenshot / video of exploitation]
[Burp Suite request/response]

## Impact
An attacker can [specific action] resulting in [specific harm].
[Quantify if possible: "This affects all X users" or "Attacker can access Y data"]

## Severity Assessment
CVSS 3.1 Score: X.X ([Severity label])
Attack Vector: Network | Complexity: Low | Privileges: None | User Interaction: None
```

### Bugcrowd Template

```
Title: [Vuln] at [endpoint] -- [Impact in one line]

Bug Type: [IDOR/SSRF/XSS/etc]
Target: [URL or component]
Severity: [P1/P2/P3/P4]

Description:
[Root cause + exact location]

Reproduction:
1. [step]
2. [step]
3. [step]

Impact:
[Concrete business impact]

Fix Suggestion:
[Specific remediation]
```

## Report Title Formula

```
[Bug Class] in [Exact Endpoint/Feature] allows [attacker role] to [impact] [victim scope]
```

**Good:**
```
IDOR in /api/v2/invoices/{id} allows authenticated user to read any customer's invoice data
Missing auth on POST /api/admin/users allows unauthenticated attacker to create admin accounts
Stored XSS in profile bio field executes in admin panel -- allows privilege escalation
SSRF via image import URL parameter reaches AWS EC2 metadata service
Race condition in coupon redemption allows same code to be used unlimited times
```

**Bad:**
```
IDOR vulnerability found
Broken access control
XSS in user input
Security issue in API
```

## Impact Statement Formula (First Paragraph)

```
An [attacker with X access level] can [exact action] by [method], resulting in [business harm].
This requires [prerequisites] and leaves [detection/reversibility].
```

## Human Tone Rules (Avoid AI-Sounding Writing)

- Start sentences with the impact, not the vulnerability name
- Write like you're explaining to a smart developer, not a textbook
- Use "I" and active voice: "I found that..." not "A vulnerability was discovered..."
- One concrete example beats three abstract sentences
- No em dashes, no "comprehensive/leverage/seamless/ensure"

## The 60-Second Pre-Submit Checklist

```
[ ] Title follows formula: [Class] in [endpoint] allows [actor] to [impact]
[ ] First sentence states exact impact in plain English
[ ] Steps to Reproduce has exact HTTP request (copy-paste ready)
[ ] Response showing the bug is included (screenshot or response body)
[ ] Two test accounts used (not just one account testing itself)
[ ] CVSS score calculated and included
[ ] Recommended fix is one sentence (not a lecture)
[ ] No typos in the endpoint path or parameter names
[ ] Report is < 600 words (triagers skim long reports)
[ ] Severity claimed matches impact described (don't overclaim)
```

## Severity Escalation Language

When payout is being downgraded, counter with:

| Program Says | You Counter With |
|---|---|
| "Requires authentication" | "Attacker needs only a free account (no special role)" |
| "Limited impact" | "Affects [N] users / [PII type] / [$ amount]" |
| "Already known" | "Show me the report number -- I searched and found none" |
| "By design" | "Show me the documentation that states this is intended" |
| "Low CVSS score" | "CVSS doesn't account for business impact -- attacker can steal [X]" |

## Submission Checklist (Final)

- [ ] Ran the 7-Question Gate — all YES
- [ ] Passed all 4 pre-submission gates
- [ ] Read my report as a tired triager — does it pass?
- [ ] Steps to reproduce are copy-pasteable and exact
- [ ] Full HTTP requests included (method, path, headers, body)
- [ ] Impact quantified (N users, $X, N records)
- [ ] In scope per program policy
- [ ] No destructive actions taken
- [ ] Evidence clean, no secrets/irrelevant data exposed
