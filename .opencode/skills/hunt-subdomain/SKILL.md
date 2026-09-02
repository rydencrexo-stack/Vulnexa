---
name: hunt-subdomain
description: Subdomain takeover hunting — dangling-CNAME signals, provider fingerprints (Azure cloudapp, Vercel, Fastly, Zendesk, GitHub/GitLab Pages, S3), the five payout chains (OAuth redirect_uri → ATO, cookie-domain wildcard, CSP script-src, CORS regex, email DNS), validation discipline (register + serve canary with TLS + tear down). Use when stale CNAMEs/NXDOMAIN targets or wildcard-cookie/CSP/OAuth allowlist contexts exist. Trigger keywords: subdomain takeover, dangling CNAME, stale DNS, claim, cloudapp.
---

# Subdomain Takeover — Deep Hunting

## THE GATE
Signals: CNAME to provider infra + NXDOMAIN on the CNAME target; provider 404 fingerprints ("There isn't a GitHub Pages site here", `NoSuchBucket`, "No such app", "Fastly error: unknown domain", "This UserVoice subdomain is available", `DEPLOYMENT_NOT_FOUND`); SSL cert to provider wildcard.

## Modern Providers
Azure `cloudapp.azure.com` regional-pool re-issue (deploy free VM in same region to reclaim); Vercel deleted-project (`cname.vercel-dns.com` → recreate project); Fastly (attach dangling hostname to fresh service — no origin-ownership check); Zendesk (register trial, host-map subdomain, email-forwarding → intercept password resets); GitLab/GitHub Pages namespace re-claim; S3 bucket claim.

## The Five Payout Chains (standalone = Low/Info, chains = High/Critical)
1. **OAuth redirect_uri allowlist** → host code-receiver on claimed subdomain → 1-click ATO.
2. **Cookie-domain wildcard** (`Domain=.target.com`) → plant `Set-Cookie: SESSIONID=<attacker>; Domain=.target.com` from taken-over sibling → session fixation.
3. **CSP script-src includes taken-over host** → host attacker JS → stored-XSS-equivalent on main app.
4. **CORS regex matches taken-over host** → credentialed cross-origin API read.
5. **Email DNS (DKIM selector / SPF include)** → publish auth for your server → inbox phishing as `@target.com`.

Severity map: OAuth allowlist→Critical; parent cookies→High; CSP→Critical; CORS→High; email→High; none = file Low.

## Validation
Actually register and serve a unique canary file over `https://sub.target.com` with valid TLS, screenshot, then tear down. Don't file "fingerprint present" — must prove resource is currently unclaimed *and* claimable.

## Common Mistakes
Filing standalone takeover at High; missing that `*.target.com` wildcards often implicitly include subdomains; skipping the chain evaluation that justifies severity.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: subdomain-takeover — 133 disclosed H1 reports (57 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `_method`
- `authenticity_token`
- `html`
- `conversationId`
- `pageSize`
- `datestamp`
- `version`
- `hosts`
- `consentId`
- `interactionCount`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Authentication bypass on auth.uber.com via subdomain takeover of saostatic.uber.com** (Improper Authentication - Generic)
  - Signal: ## Summary This is not a standard vulnerability, but a chain of two more exotic vulnerabilities leading to a full authentication bypass of your SSO login system at auth.uber.com (v
- **[critical] Subdomain takeover due to an unclaimed Amazon S3 bucket on ███** (Cross-site Scripting (XSS) - Generic)
  - Signal: **Summary:** An unclaimed Amazon S3 bucket on █████████ gives an attacker the possibility to gain full control over this subdomain. **Description:** `███████` pointed to an S3 buck
- **[critical] Subdomain Takeover to Authentication bypass** (None)
  - Signal: ## Vulnerability Type: ----------- Subdomain Takeover ## Description: ----------- Due to unclaimed or expired Hubspot instance an attacker is able to claim and serve content from `
- **[critical] Subdomain takeover on svcgatewaydevus.starbucks.com and svcgatewayloadus.starbucks.com** (Privilege Escalation)
  - Signal: Hello, This is fairly close to [this report](https://hackerone.com/reports/325336) however these are different subdomains than the one in the report. This can be pretty serious sin

