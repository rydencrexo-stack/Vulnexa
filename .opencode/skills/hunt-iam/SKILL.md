---
name: hunt-iam
description: Cloud IAM attack chains — 60-second cred triage, 24+ AWS privesc primitives, confused-deputy (ExternalId), IMDSv1/v2 + GCP/Azure metadata variants, Cognito Identity Pool unauth chain (GetId → GetCredentialsForIdentity → STS → blackbox enum), K8s SA-token privesc, discipline (policy alone ≠ finding, CloudTrail awareness, no prod mishaps). Use when cloud creds, IAM roles, Cognito pools, or metadata endpoints surface. Trigger keywords: IAM, privilege escalation, assume-role, confused deputy, Cognito, metadata, STS.
---

# Cloud IAM Attack Chains — Deep Hunting

## THE GATE — 60-Second Cred Triage
Identify key type (`AKIA`/`ASIA`/`AGPA`/`AIDA`/`AROA`), then read-only `get-caller-identity` before anything else.

## 24+ AWS Privesc Primitives
Any of: `iam:AttachUserPolicy`, `PutUserPolicy`, `CreateAccessKey`, `CreateLoginProfile`, `UpdateAssumeRolePolicy`, `CreatePolicyVersion`, `PassRole`+compute/lambda/glue/CF/codestar combos, `lambda:UpdateFunctionCode` on an admin-role function, `cloudformation:UpdateStack`.

## Confused-Deputy
Missing `sts:ExternalId` or trust allowing `arn:aws:iam::*:role/*`.

## Metadata Variants
IMDSv2 blocks most SSRF (needs PUT); GCP needs `Metadata-Flavor: Google` header; Azure MI endpoint `/metadata/identity/oauth2/token` with `Metadata: true` → tokens for management/KV/Graph (Graph = full M365).

## Cognito Identity Pool Unauth Chain
`GetId --no-sign-request` → `GetCredentialsForIdentity` → STS (ASIA, ~1h TTL) → `get-caller-identity` → blackbox permission probe (enumerate-iam.py ~1000 actions). Common over-perms: `s3:Get*`, `dynamodb:Scan`, `lambda:InvokeFunction`, `appsync:GraphQL`, `cognito-idp:Admin*`, `iam:PassRole`.

## K8s SA-Token Privesc
`clusterrolebindings/create`, `roles/escalate`, `impersonate`, `nodes/proxy`, `secrets/get` → admin token.

## Key Commands
```
aws sts get-caller-identity; aws iam list-attached-user-policies --user-name $self
aws sts assume-role --role-arn arn:aws:iam::OTHER:role/X --role-session-name rt-1
curl -H "Metadata: true" "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://vault.azure.net"
gcloud projects get-iam-policy <proj> --flatten="bindings[].members" --filter="bindings.members:<sa-email>"
```

## Validation / Discipline
Policy alone ≠ finding — must demonstrate actual privileged action; don't mutate IAM without OK; check cred expiration before assuming current; every API call is audited (CloudTrail); document AssumeRole chains + created resources for cleanup.

## Common Mistakes
Confusing "have credential" with "credential is current"; `aws *` against wrong account (prod hit = career risk); enumerating 50k-user accounts loudly; skipping CloudTrail awareness.

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

