---
name: evidence-hygiene
description: Evidence capture and PoC redaction discipline — cookie redaction protocol (mask session cookies, safe to leave trace IDs/Cloudflare cookies), PII black-bar protocol, HAR sanitization with jq, Burp screenshot hygiene (hide request panel), DevTools Console clean-PoC patterns (credentials include), 5-step capture order, filename conventions, post-submission rotation. Use BEFORE any PoC screenshot, HAR attachment, or evidence prep. Trigger keywords: evidence, redact, HAR, screenshot, PoC, cookie leak, PII.
---

# Evidence Hygiene — PoC Capture & Redaction

> Bug-bounty evidence convinces a triager. Anything beyond that — live cookies, real-user PII, useless trace IDs — should not be in the evidence.

## 1. Two Categories of Sensitive Data
| Category | Examples | Treatment |
|---|---|---|
| **Your-account secrets** | Session cookies, OAuth/refresh tokens, API keys | Always redact |
| **Other users' PII** | Real names, emails, phones, addresses, faces | Redact unless demonstrating cross-account impact; mask faces |
| **Triager-useful metadata** | Trace IDs, request IDs, timestamps, test-account UID, GraphQL op names, response shapes | **Leave visible** |
| **Test-account passwords** | Throwaway `Testing@5678` | OK if rotated immediately post-submission |

## 2. Cookie Redaction Protocol
**Must mask:** session cookie value, `csrf-token` bound to session, `Authorization`/Bearer/JWT, `Cookie`/`Set-Cookie` values.
**Safe to leave:** Cloudflare cookies (`__cf_bm`), analytics (`_ga`), trace IDs (`x-request-id`), server headers, your test email/UID.

**Method A — don't capture cookies at all:** DevTools Console PoCs use `credentials: 'include'` so the browser sends cookies; screenshot the Console output, never the Network Headers panel. Burp Repeater: drag the divider DOWN to hide the request body.
**Method B — black-bar in image editor** (Preview annotation / Snip & Sketch) over cookie value.
**Method C — jq find/replace** for HARs (§4).

## 3. PII Black-Bar Protocol
Mask: first/last names, email local-part, phone last 7 digits, address below city, DOB year, gov IDs, faces. Leave: field names/shapes (`"first_name": "<REDACTED>"`), your attacker-session UID, endpoint+method, trace ID.

Report body reference: "Real PII fields in the response are masked with black rectangles... The unredacted response is available privately on request."

## 4. HAR Sanitization
```bash
sanitize_har() {
  jq '.log.entries |= map(
    (.request.headers |= map(if .name | ascii_downcase | IN("cookie","authorization","x-csrf-token") then .value="<REDACTED>" else . end)) |
    (.response.headers |= map(if .name | ascii_downcase | IN("set-cookie") then .value="<REDACTED>" else . end)) |
    (.request.cookies |= map(.value="<REDACTED>")) |
    (.response.cookies |= map(.value="<REDACTED>"))
  )' "$1" > "${1%.har}.sanitized.har"
}
grep -i 'authn\|"cookie"\|authorization' x.sanitized.har   # verify
```

## 5. Burp Screenshot Hygiene
Repeater: hide Cookie line (drag divider / temporarily delete text). Intruder Results: show only `Request# | Payload | Status code | Response received | Length` columns — never the Request/Response sub-panels. Scanner Issues panel is safe.

## 6. DevTools Console PoC Pattern
```js
fetch('/api/endpoint', {method:'POST', headers:{'content-type':'application/json'}, credentials:'include',
  body: JSON.stringify({/* payload */})}).then(r=>r.json()).then(j=>console.log("LABEL:", JSON.stringify(j)))
```
- `credentials:'include'` → cookies never appear in your code/screenshots.
- Clear console between calls (`Cmd+K`/`Ctrl+L`) so each screenshot shows one call+response.
- Long responses: log shape + critical field only, not full dump.
- **Type `allow pasting`** at session start or the anti-self-XSS warning appears in screenshots.

## 7. Screenshot Capture Order (5-step PoC for state-change findings)
1. Pre-state verify → true. 2. **THE BUG** (action succeeds). 3. Post-state negative (old fails). 4. Post-state positive (new works). 5. Out-of-band (inbox notification check).

Filenames: `{finding}-step{step}-{description}.png` e.g. `04-step2-update-password-no-stepup.png`. Take all in one sitting; don't reload between shots.

## 8. Post-Submission Hygiene
1. Log out + back in (rotates session cookie). 2. Change password (kills any password shown). 3. Keep unredacted artifacts private — share only via platform's private attachment system. 4. Never post about findings publicly until program allows. 5. Quarterly sweep of `~/security-research/` and `~/Downloads/` for stale HARs.

## Pairing
`triage-validation` = should I report? `evidence-hygiene` = how to capture/redact. `report-writing` = report body template.