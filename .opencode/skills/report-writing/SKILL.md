---
name: report-writing
description: Security report writing for bug bounty — human-tone impact-first structure, CVSS 3.1 scoring details, PoC etiquette, duplicate-avoidance, severity-escalation counters, and proof-of-impact evidence standards. Use when drafting, polishing, or self-reviewing any bug bounty report before submission. Trigger keywords: report, writeup, CVSS, PoC, submission, proof, impact, duplicate.
---

# Report Writing — From Proof to Submission

## Structure (impact first, human tone)
1. **Title**: `[CLASS] impact on <asset>` (e.g. `[IDOR] other users' order data readable via /api/orders/{id}`). Clear, specific, no drama.
2. **Summary (2-3 sentences)**: what, where, and the worst real-world impact. No acronym soup.
3. **Impact**: concrete — "any authenticated user can read any other user's order history, including billing addresses and last-4 card digits, via a direct IDOR on GET /api/orders/{id}". Quantify: N records, $ value, user count. This is what pays.
4. **Steps to reproduce**: numbered, copy-pasteable curl/Burp requests with the exact payload and the exact response. Someone who has never seen the app must be able to reproduce in <5 min.
5. **Impact escalation / attack scenario**: the chain — "combine with a second user account to demonstrate cross-tenant impact" — showing why it matters beyond a PoC.
6. **Mitigation suggestion**: 1-2 concrete fixes (authz check on every object read; server-side validation; rate limit with lockout; parameterized query). Keep brief.

## CVSS 3.1 quick rules
- Score per the actual reachable state: unauthenticated vs authenticated, scope change or not, C/I/A impact reachable in the real attack.
- IDOR on another user's data with auth: typically AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N ≈ 6.5 (Medium-High).
- Same with privilege-to-other-user escalation or PII volume: consider S:C → 7.1-8.1.
- Never inflate: self-XSS, open redirect alone, or theoretical chains get ≤ Low. Triagers de-dup/reject inflated scores.
- Use the official calculator; state the vector string in the report.

## PoC etiquette
- Minimal: the smallest request/response that proves it. No bulk enumeration dumps.
- Redact PII/cookies/tokens (mask middle, keep verifiable prefix) — see evidence-hygiene skill.
- Prefer a clean HTTP exchange over a giant screenshot; add ONE screenshot if it helps readability.
- Never include full secrets/keys; give masked prefix + validation proof.

## Duplicate avoidance
- Search Hacktivity + the program's known-reports before writing. If another report covers the same root cause → don't submit.
- Frame at the ROOT-CAUSE level, not the symptom — a fix for symptom X that leaves root cause Y means your report may be "informational" while the real bug stays open. Submit the root-cause version.

## Severity-escalation counters (when triager disagrees)
- Missing-impact rebuttal: demonstrate the concrete data/capability reachable (record a second test account's data, show admin-only action reachable).
- "By design" rebuttal: cite the program's own docs/policy that say otherwise; show the trust boundary being crossed.
- "Needs auth" downgrade rebuttal: show the request works with a LOW-priv account and escalate to the impact of a full user.

## Self-review checklist before submit
- [ ] Reproduced cleanly from scratch, ≥2 techniques where possible
- [ ] In-scope asset + authorized target
- [ ] No duplicate (checked Hacktivity)
- [ ] Impact quantified, not assumed
- [ ] CVSS vector computed with the official calculator
- [ ] PII/cookies/tokens redacted
- [ ] One chain per report, root cause at the center
- [ ] Repro steps copy-pasteable