---
name: hunt-cloud-misconfig
description: Cloud misconfiguration hunting — S3/GCS/Blob anon listing, Firebase .json read/write, IMDS via SSRF, CloudWatch RUM weaponization chain (guestRoleArn + identityPoolId → Cognito unauth → AWS access), stale-CNAME bucket takeover, 7-step validation checklist, severity rubric. Use when cloud assets, buckets, Firebase, RUM JS, or metadata endpoints are suspected. Trigger keywords: S3 bucket, cloud misconfig, Firebase, CloudWatch RUM, bucket takeover, anon listing.
---

# Cloud Misconfiguration — Deep Hunting

## THE GATE
S3/GCS/Blob anon listing; Firebase `/.json` read + `PUT` write probe; IMDS via SSRF (`169.254.169.254`, IMDSv2 PUT-token).

## CloudWatch RUM Weaponization (2024–26 surface, non-obvious)
- `guestRoleArn` + `identityPoolId` embedded in public JS are the Cognito unauth chain's entry; over-broad guest role = anonymous AWS access.
- **Covert exfil**: `dataplane.rum.<region>.amazonaws.com` is on every enterprise allowlist; `PutRumEvents` accepts arbitrary `userDetails`/`customEvents` strings — DLP and SIEM don't parse RUM telemetry.
- **Subdomain takeover of self-hosted `cwr.js`** → persistent JS on every page.
- **Telemetry injection**: flood fake error spikes (alert drowning), XSS in page-URL telemetry that fires when SOC views dashboard.

## Key Commands
```
curl -s "https://T.s3.amazonaws.com/?max-keys=10"; aws s3 ls --no-sign-request
curl -s "https://T.firebaseio.com/.json"
aws cognito-identity get-id --identity-pool-id REG:UUID --no-sign-request
aws cognito-identity get-credentials-for-identity --identity-id REG:<uuid> --no-sign-request
grep -ErohE "identityPoolId['\"]?\s*[:=]\s*['\"]([a-z]{2}-[a-z]+-[0-9]+:[0-9a-f-]{36})"
```

## Fingerprinting
Regex for `cwr(`/`new AwsRum(`/`aws-rum-web`, extract applicationId/identityPoolId/guestRoleArn (leaks account ID). Stale-CNAME → deleted bucket takeover via hunt-subdomain.

## Validation (7-step checklist)
GetId succeeds unauth, `get-credentials-for-identity` returns STS, `sts get-caller-identity` screenshot, enumerate ≥1 action beyond `rum:PutRumEvents`, demonstrate one real read/list. No modify/delete. Severity: `*:*` guest role = Critical; `rum:PutRumEvents`-only = Informational.

## Common Mistakes
Reporting pool exposure alone (Informational without over-permission proof); claiming writable bucket without unique-marker write + clean-session read-back; ignoring `--no-sign-request`.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: cloud-misconfig — 185 disclosed H1 reports (58 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `oauth_token`
- `sentry_key`
- `client_id`
- `referrer`
- `id`
- `next`
- `ticket`
- `redirect_uri`
- `state`
- `response_type`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Remotely trigger an assertion on a TLS server with a malformed certificate string** (Improper Certificate Validation)
  - Signal: **Summary:** Connecting to a NodeJS TLS server with a client certificate that has a type 19 string in its subjectAltName will crash the TLS server if it tries to read the peer cert
- **[critical] Unauthenticated Access to Admin Panel Functions at https://███████/███** (Improper Access Control - Generic)
  - Signal: **Description:** The admin panel at https://██████████/████████ and all its functions can be accessed without authentication. This is basically the same vulnerability as in #139491
- **[critical] Unauthenticated Access to Admin Panel Functions at https://██████████/████████** (Improper Access Control - Generic)
  - Signal: **Description:** I discovered that the admin panel at https://████/█████ and all its functions can be accessed without authentication. ## Impact An attacker is able to use the admi
- **[critical] Subdomain takeover due to an unclaimed Amazon S3 bucket on ███** (Cross-site Scripting (XSS) - Generic)
  - Signal: **Summary:** An unclaimed Amazon S3 bucket on █████████ gives an attacker the possibility to gain full control over this subdomain. **Description:** `███████` pointed to an S3 buck

