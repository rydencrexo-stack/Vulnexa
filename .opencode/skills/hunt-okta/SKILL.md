---
name: hunt-okta
description: Okta security — /api/v1/authn spray + factor fingerprint oracle (_embedded.factors reveals phishing-resistant vs phishing-able), status code semantics (200 MFA_REQUIRED = valid password), OIDC redirect_uri tampering → auth-code theft, SAML SP metadata hardening check, SSWS token admin surface, orphan/dev tenant takeover, inbound-federation IdP injection, CVE-2024-0981 bcrypt truncation. Use when okta.com tenant, /api/v1/authn, or Okta SSO detected. Trigger keywords: Okta, authn spray, MFA_REQUIRED, SSWS, factor enumeration, redirect_uri.
---

# Okta — Deep Hunting

## THE GATE
`/api/v1/authn` spray endpoint is *also* the factor/fingerprint oracle: response `_embedded.factors` reveals `webauthn` (phishing-resistant) vs `sms/call/push/email/totp/question` (phishing-able).

## Status Codes
`200 MFA_REQUIRED`/`PASSWORD_EXPIRED` = **valid password**; `E0000004` = unified fail; `E0000119` = locked. Okta default lockout ~10 fails (some orgs 3) → ≤2 attempts/user.

## Post-2024 Hardening
`/api/v1/authn` differential user-enum is unreliable — verify freshness by diffing 1 known-existing vs 1 non-existing user byte-by-byte + timing; pivot to OneDrive-equivalent.

## Attack Vectors
- **OIDC `redirect_uri` tampering** (authorize endpoint, `@`-and-suffix injection variants) → open redirect → auth-code theft.
- **SAML SP metadata per app** (`/app/<id>/sso/saml/metadata`): `AuthnRequestsSigned="false"`, `WantAssertionsSigned="false"` → XSW/assertion replay.
- **Post-compromise admin surface**: `SSWS` token against `/api/v1/users|groups|apps|logs`.
- **Orphan/dev tenant takeover**: `<org>-dev/uat/test.okta.com` → SSO takeover.
- **Inbound-federation IdP injection**: attacker IdP + arbitrary NameID → impersonate anyone.
- **HAR/session-cookie replay**: `sid` cookie = bearer.
- **CVE-2024-0981**: bcrypt 72-byte truncation (username ≥52 chars → password-independent cache key).

## Key Commands
```
curl -sk -X POST https://T.okta.com/api/v1/authn -d '{"username":"u","password":"_test"}'
curl -sk https://T.okta.com/oauth2/v1/authorize?client_id=X&response_type=code&scope=openid&redirect_uri=<tampered>
curl -sk -H "Authorization: SSWS <t>" https://T.okta.com/api/v1/users
```

## Fingerprinting
Tenant guesses over `okta`/`okta-emea`/`oktapreview` TLDs; CNAME `sso./login./auth./okta.`; `/api/v1/iam/orgs` returning 401 (admin surface enabled).

## Validation
MFA_REQUIRED = valid cred; redirect_uri tampering confirmed by attacker URL in 302 Location; SSWS token must actually list users. Never confuse `oktapreview` (weaker security) with prod.

## Common Mistakes
Using Entra-style spray pace (Okta rate-limits faster); skipping factor enumeration; push fatigue without explicit OK (social engineering); stale 2022-era enum techniques; citing unverifiable tool names.