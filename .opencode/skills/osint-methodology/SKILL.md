---
name: osint-methodology
description: OSINT engagement workflow for bug bounty — target entity mapping, identity fabric discovery, credential-exposure sweep, secret classification + validation, dorking corpus, third-party exposure mapping, reporting standards. Use when pivoting from an application target to the org-level attack surface (people, creds, leaked secrets, exposed services). Trigger keywords: OSINT, credential exposure, leaked credentials, dork, password reuse, employee leak, secret validation.
---

# OSINT Methodology — Org-Level Attack Surface

## When to use
OSINT is a PIVOT tool, not a standalone discipline: after app-level recon, use it to find (a) leaked real credentials/keys for the org, (b) exposed services the asset map missed, (c) third-party surfaces that authenticate to the org. **Keep every finding in authorized scope** — a credential found is a lead to TEST on in-scope apps, not a reason to break into unrelated systems.

## Workflow
1. **Identity fabric discovery**: enumerate auth entry points per domain — OAuth/OIDC providers, ADFS/Okta SSO, autodiscover-v2, OpenID well-known, GetUserRealm, SAML metadata. Same org often shares one IdP → one valid set of creds pwns many apps.
2. **Credential exposure sweep**: search dork corpus against GitHub/GitLab/Gist/Pastebin/JS bundles for the org's domains, repo names, product names, employee usernames, email prefixes. Look for: `.env`/config dumps, `~/.git`, npm/Gradle/PyPI package tarballs with embedded secrets, S3/OneDrive/GDrive public links, Docker Hub images, container registry blobs, public CI logs.
3. **Classify + validate** every candidate with the secret catalog + validators (see offensive-osint). Never report unvalidated keys. Classify precisely (B2B vs consumer, dev vs prod).
4. **Third-party exposure**: password-reuse/email-enumeration leads must be tested ONLY on in-scope apps (OTP bypass, reset poisoning, OAuth code theft). Document the chain that makes the leak a real finding.
5. **Service exposure**: IP/port scans tied to the org's ASN, favicon/JARM clustering, exposed admin ports (Redis, kubelet, etcd, Memcached, Docker), misconfigured buckets, open APIs.

## Reporting standards (OSINT findings)
- Only report **validated, scoped** findings. A leaked key with no access proof is Informational at best.
- Show the capture path (dork → source → exact key) AND the validation (what the key opened, with evidence).
- Never include full keys in the report body — mask, then give the triager a verifiable prefix/last-4.
- Note if data is already public (Search engines/cache) — that downgrades severity but may still be a finding if the org can't rotate.

## Dork corpus (representative high-value queries)
```
site:target.com filetype:env
site:target.com "password" "api_key"
site:target.com "BEGIN PRIVATE KEY"
site:target.com "AKIA"  site:target.com "sk_live"  site:target.com "client_secret"
site:target.com inurl:swagger site:target.com inurl:.git site:target.com inurl:.env
site:github.com "target.com" "secret"  site:gitlab.com target "token"
"target.com" "smtp_password" "passwords.txt" target "config.json"
```
Rotate in the org's product/brand names, employee handles, and email domain. Use GitHub/ GitLab code search + gitleaks/trufflehog scans of any public repos in scope.

## Ethics guardrails
Authorized scope only; no scraping of personal data beyond what's needed to prove a finding; mask credentials in all artifacts; never use a validated credential against anything outside the program's asset list; log every probe in the engagement journal.