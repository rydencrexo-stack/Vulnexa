---
name: hunt-nextjs
description: Next.js security hunting — Server Actions auth bypass (call action ID directly), middleware bypass (encoded _next, path traversal), image optimizer SSRF false-positive traps (400 ≠ bypass, 200 is optimized image), CVE-2024-34351 relative-redirect SSRF, ISR cache poisoning, source maps, _next/data routes, revalidate endpoint. Use when _next/static, __NEXT_DATA__, x-nextjs headers, or Next-Action detected. Trigger keywords: Next.js, Server Actions, middleware bypass, _next/image, ISR, Next-Action.
---

# Next.js — Deep Hunting

## THE GATE
Crown jewel: **Server Actions auth bypass** — actions enforce auth client-side; call the action ID directly.

## Attack Vectors
- **Server Actions (14+)**: find `"action":"<id>"` or `$$ACTION_` in HTML/bundles; POST with `Next-Action: <id>` + multipart body, no session.
- **Middleware bypass**: `/ _next/data/BUILD_ID/page.json` (SSG data route), encoded `%5Fnext`, `..%2F` path traversal into protected routes.
- **Image optimizer SSRF**: `/_next/image?url=&w=&q=` → 169.254.169.254 metadata, internal ports.
- **CVE-2024-34351 / GHSA-fr5h-rqp8-mj6g** (13.4.0 – <14.1.1): Server Actions **relative redirect trusting Host header** SSRF — NOT a `/_next/image` bug.
- **ISR cache poisoning**: poison via query param on revalidation, verify marker persists on clean URL (check `x-nextjs-cache`/`age`).
- **`__NEXT_DATA__` / `NEXT_PUBLIC_*`** leaked into client bundles/HTML.

## Key Endpoints
`/_next/image`, `/_next/data/$BUILD_ID/...json`, `/_next/static/chunks/*.map` (source maps), `/api/revalidate?secret=&path=`, `__nextjs_original-stack-frame`.

## Fingerprinting
`"buildId":"..."` in HTML; `x-nextjs-*` headers; version via `framework*.js`.

## Validation (critical false-positive guards)
`/_next/image` returns **400 by default for non-allowlisted URLs** (normal rejection — NOT a bypass). A 200 returns an *optimized image*, never the upstream body — status code alone NEVER proves SSRF. Confirm only via OOB callback to a **unique** Collaborator subdomain or body-diff internal-vs-external. Debug endpoints are dev-only; 404 in production is expected — only a non-404 is a finding.

## Common Mistakes
Reporting 400 as SSRF "block bypassed"; reporting dev-endpoint 404s; ISR claim without proof of cache persistence across clients.