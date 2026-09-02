---
name: hunt-cloud-infra
description: Hunt cloud and infrastructure misconfigurations — S3/GCS/Azure blob buckets, exposed admin panels, Kubernetes/Docker, Firebase, subdomain takeover, CI/CD pipeline attacks, mobile app analysis, exposed git/env files, and Spring actuators. Use when testing cloud-hosted targets, checking for dangling CNAMEs, S3 bucket enumeration, GitHub Actions workflows, mobile APKs, or exposed infrastructure endpoints. Trigger keywords: cloud, S3, bucket, subdomain takeover, CNAME, CI/CD, GitHub Actions, actuator, Kubernetes, Docker, Firebase, misconfiguration, mobile, APK.
---

# Cloud / Infra / CI/CD / Mobile

## S3 / GCS / Azure Blob Buckets

### S3
```bash
# Public listing
aws s3 ls s3://target-bucket-name --no-sign-request

# Try common names
for name in target target-backup target-assets target-prod target-staging target-uploads target-data; do
  curl -s -o /dev/null -w "$name: %{http_code}\n" "https://$name.s3.amazonaws.com/"
done

# Cloud asset enumeration
pip3 install cloud_enum && cloud_enum -k TARGET
```

### GCS
```bash
curl -s "https://storage.googleapis.com/TARGET-bucket/"   # XML listing
gsutil ls gs://TARGET-bucket
```

### Azure Blob
```bash
curl -s "https://TARGET.blob.core.windows.net/?comp=list"   # container listing
# SAS token abuse: if a SAS token is leaked in JS/mobile, test its scope
```

### Bucket impact escalation
- S3 listing alone = Low. Chain: enumerate JS bundles → find OAuth client_secret → OAuth chain (Coinbase-style)
- Access keys in bucket → test what they can access (must PROVE access)
- Bucket takeover: if S3 bucket name is unclaimed but referenced → register it (only report if it serves target content/session)

## Subdomain Takeover

### Detection
```bash
# Dangling CNAMEs
cat /tmp/subs.txt | dnsx -silent -cname -resp | grep -i "CNAME" | tee /tmp/cnames.txt
# Look for CNAMEs to: github.io, heroku.com, azurewebsites.net, netlify.app, s3.amazonaws.com

# Automated
nuclei -l /tmp/subs.txt -t ~/nuclei-templates/takeovers/ -o /tmp/takeovers.txt
```

### Quick-Kill Fingerprints
```
"There isn't a GitHub Pages site here"  -> GitHub Pages
"NoSuchBucket"                          -> AWS S3
"No such app"                           -> Heroku
"404 Web Site not found"                -> Azure App Service
"Fastly error: unknown domain"          -> Fastly CDN
"project not found"                     -> GitLab Pages
"It looks like you may have typed..."   -> Shopify
```

### Impact escalation
- Basic takeover: serve page under target.com subdomain → Low/Medium
- + Cookies: if target.com sets cookie domain=.target.com → credential theft → High
- + OAuth redirect: if sub.target.com is registered redirect_uri → ATO chain → Critical
- + CSP bypass: if sub.target.com is in target's CSP → XSS anywhere → Critical

## Exposed Infrastructure

### Admin panels / debug endpoints
```
/jenkins       /grafana       /kibana        /elasticsearch
/swagger-ui.html  /api-docs   /phpMyAdmin    /adminer.php
/.env          /config.json   /server-status /actuator/env
/actuator/heapdump  /actuator/mappings  /actuator/beans
/.git/config   /.git/HEAD     /.svn/entries  /backup.zip
```

### Kubernetes / Docker
```bash
# K8s API (unauthenticated):
curl -sk https://TARGET:6443/api/v1/namespaces/default/pods
# Docker API:
curl -s http://TARGET:2375/containers/json
# Consul:
curl -s http://127.0.0.1:8500/v1/agent/members
```

### Firebase Open Rules
```bash
curl -s "https://TARGET-APP.firebaseio.com/.json"       # open read
curl -s -X PUT "https://TARGET-APP.firebaseio.com/test.json" -d '"pwned"'   # open write = Critical
```

### Spring Actuator (Java/Spring Boot)
- `/actuator/env` — environment variables, sometimes secrets
- `/actuator/heapdump` — full heap with credentials (download + jhat to extract secrets)
- `/actuator/mappings` — map all routes
- `management.endpoints.web.exposure.include=*` is the misconfig

## CI/CD Pipeline

### GitHub Actions
- `pull_request_target` + checkout of PR code = RCE on self-hosted runners
- Secrets in workflow logs / artifacts
- Artifact poisoning (overwrite existing artifacts)
- Build command injection via branch/tag names
- OIDC token theft from CI runners (scope to cloud provider)
- `GITHUB_TOKEN` permissions over-granted

### Git recon for secrets
```bash
gitleaks detect --source . -v
trufflehog filesystem .
# GitHub dorking: GitDorker -org TARGET_ORG -d dorks/alldorksv3
```

## Mobile App Analysis

### APK extraction pipeline
```bash
# Download APK from APKMirror / Play, then:
apktool d app.apk                     # decode resources
jadx -d out app.apk                   # decompile to Java
# Extract: API endpoints, hardcoded credentials/keys, OAuth client_secrets
strings app.apk | grep -i "api\|token\|secret\|http"
```

### Mobile-specific checks
- Certificate pinning bypass (Frida / objection)
- Exported activities/receivers (AndroidManifest.xml) — exported components callable externally
- Deep link injection
- Shared preferences / SQLite stored in cleartext
- WebView JavaScript bridge (addJavascriptInterface)
- **Mobile API often uses older/different API version than web** — same company, different surface, lower maturity
- OAuth client_secret hardcoded in app (usually rejected alone, but chain with missing PKCE = valid)

## Quick Wins Checklist (fast scan order)
- [ ] Subdomain takeover (subzy/subjack/nuclei)
- [ ] Exposed `.git` / `.env`
- [ ] Spring actuators
- [ ] S3/cloud buckets
- [ ] Firebase open rules
- [ ] GraphQL introspection
- [ ] Default credentials on admin panels
- [ ] JS secrets (SecretFinder, jsluice)
- [ ] CORS misconfig (`Origin: https://evil.com` + credentials)
- [ ] Open redirects

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

### Class: k8s — 244 disclosed H1 reports (89 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `name`
- `id`
- `Password`
- `error`
- `alt`
- `deviceUdid`
- `Action`
- `Version`
- `action`
- `x-amz-signedheaders`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] UrnState Heap Overflow** (Classic Buffer Overflow)
  - Signal: ## Summary: When handling a URN Request an attacker controlled response can cause Squid to overflow a heap buffer. The buffer exist within a struct so not only does it allow an att
- **[critical] Handling of `tracking` command allows making arbitrary blind requests with user's cookies from Grammarly Extension's origin** (None)
  - Signal: ## **Summary:** Attacker could trigger Grammarly extension's `gnar._fetch` command using a crafted page to perform XHR with cookies and any configurational params to any cross-orig
- **[critical] RCE via unsafe inline Kramdown options when rendering certain Wiki pages** (Code Injection)
  - Signal: ### Summary When rendering wiki content with certain extensions such as `.rmd`, `render_wiki_content` will call [`other_markup_unsafe`](https://gitlab.com/gitlab-org/gitlab/-/blob/
- **[critical] Panorama UI XSS leads to Remote Code Execution via Kick/Disconnect Message** (Code Injection)
  - Signal: ## Overview Counter-Strike: Global Offensive's UI is built of a framework called [Panorama](https://developer.valvesoftware.com/wiki/Dota_2_Workshop_Tools/Panorama) which is heavil

