---
name: recon-scope-triage
description: Pre-hunt discipline — target selection, scope analysis, crown-jewel selection, asset triage, attack-surface prioritization, impact-first hunting. Run BEFORE recon when picking what to attack. Trigger keywords: scope, target selection, triage, crown jewel, attack surface, impact first, where to hunt.
---

# Recon / Scope / Triage — What To Attack

## Target Selection (before touching a single endpoint)
Ask: **What is the crown jewel?** The ONE thing whose compromise = the program's worst day:
- Money (checkout, transfer, wallet, billing, refunds)
- PII at scale (profile, PII exports, admin panels, search of user data)
- Accounts (login, OAuth, SSO, password reset, session)
- Data integrity (config, DNS, source, CI/CD)
- AI/agents (a model that acts on user data or takes actions)

Then ask: **What's the worst thing that happens if authz/authn is broken here?** If the answer is "nothing valuable", skip it. Impact-first hunting means you never probe the low-value surface first.

## Scope Analysis
1. Read the FULL program policy — scope can change (in/out, additions). Don't trust memory.
2. Classify every asset: web/API/mobile/cloud/desktop/hardware/social. 
3. Note severity ceilings per asset type (some programs cap cloud/self-service at Low).
4. Note the "eligible" and "out-of-scope" lists verbatim. Mark implicit assets (same-root subdomains, IPs, staging) per policy — some programs include them, some exclude them; don't assume.
5. Identify explicit exclusions: third-party SaaS, acquired brands, specific ports/paths, vulns reported by automation, DoS, etc.

## Asset Triage (once you have the asset list)
Score each asset for expected yield, then order:
- **New == unreviewed**: features launched <30 days have the lowest security maturity. Prioritize.
- **Hidden == valuable**: shadow APIs, mobile-only endpoints, admin panels, staging domains, partner/legacy portals — low review coverage.
- **Money paths**: any feature touching payments/credits/refunds/wallets is where devs cut corners. Follow the money.
- **Auth boundaries**: every distinct auth system (SSO, OAuth, reset, session) is a separate surface — enumerate each.
- **Tech-mismatch signals**: old framework versions, unknown middleware, unusual stacks, misconfigured headers (quick wins).

## Prioritization heuristic
Priority 1 = crown jewel surface with money/auth impact and a NEW-looking implementation.
Priority 2 = same-impact surface on mature code (slower but still valuable, look for authz inconsistencies).
Priority 3 = everything else. Only spend leftover time here.

## When to bail
- Impact is capped low by policy (self-XSS, rate-limit-only) and there are higher-value assets.
- Surface is a third-party SaaS the program can't fix.
- 5-minute rule: all 401/403/404 after initial probing → move on.
- One-hour rule: no progress → switch context, come back later.

## Output
A one-line prioritized hunt plan: `CROWN JEWEL = <asset> · PATH 1 = <new money feature> · PATH 2 = <auth boundary> · PATH 3 = <shadow/mobile surface>`. Everything else waits.