---
name: hunt-graphql-api
description: Hunt GraphQL, API abuse, web cache poisoning, and HTTP request smuggling. Covers GraphQL introspection, node() IDOR bypass, field-level auth, aliases/batching for rate limit bypass, API versioning, mass assignment, cache poisoning (unkeyed headers, parameter cloaking, web cache deception), and CL.TE/TE.CL/H2.CL smuggling. Use when testing GraphQL endpoints, REST APIs, CDN-cached pages, or frontend/backend proxy chains. Trigger keywords: GraphQL, API, cache poisoning, web cache deception, request smuggling, CL.TE, TE.CL, introspection, API abuse.
---

# GraphQL / API / Cache Poisoning / Smuggling

## GraphQL

### Introspection (alone = Informational, but maps the attack surface)
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

### Rate Limit Bypass — Batching
```json
[
  {"query": "{ login(email: \"user@test.com\", password: \"pass1\") }"},
  {"query": "{ login(email: \"user@test.com\", password: \"pass2\") }"},
  "...100 more..."
]
```

### Rate Limit Bypass — Aliases
```graphql
{
  a: login(email: "a@x.com", password: "x1")
  b: login(email: "a@x.com", password: "x2")
  c: login(email: "a@x.com", password: "x3")
}
```

### Other GraphQL angles
- Mutations without field-level auth (unprotected admin mutations)
- Query cost / complexity DoS (deeply nested queries)
- Introspection on production → map schema → hunt admin/mutation endpoints
- Subscription/streaming endpoints with weak auth
- Persisted query bypass (unregistered queries accepted)
- Batch query authorization bypass (one query in batch passes auth, another doesn't)
- Error messages leaking schema/types/source snippets

## REST API

- **Version rollback**: `/api/v2/` guarded but `/api/v1/` (or `/api/`) isn't
- **Method tampering**: GET blocked → PUT/PATCH/DELETE on same endpoint
- **Mass assignment**: extra JSON fields (`role`, `is_admin`, `status`)
- **Parameter pollution**: `?id=1&id=2`, `id[]=2`, encoded separators
- **API key in JS bundles / source maps / mobile strings**
- **WebSocket endpoints** with client-supplied object IDs
- **UUID/ID leaks**: `Location` header on create, list endpoints, search autocomplete
- **Older unprotected API**: the mobile app often uses a different/older API version — same company, different surface

## Cache Poisoning / Web Cache Deception

### Unkeyed headers → reflected in response
- Test `X-Forwarded-Host`, `X-Original-URL`, `X-Rewrite-URL`, `X-Forwarded-Scheme`
- Param Miner (Burp extension) auto-discovers unkeyed headers

### Techniques
- Parameter cloaking: `?param=value;poison=xss` (semicolon cloaks into a different key)
- Fat GET: body params on GET requests
- Web cache deception: `/account/settings.css` — trick cache into storing private response
- Cache key confusion: two URLs that map to same cache key but different responses

### Cache poisoning chain
1. Find unkeyed input reflected in response (header or param)
2. Check if response is cached (header `Age`, `X-Cache`, `CF-Cache-Status`)
3. If cached AND victim visits the poisoned URL → stored XSS affecting other users
4. Report only when you can show a real victim would receive the poisoned response

## HTTP Request Smuggling

- **CL.TE**: Content-Length processed by frontend, Transfer-Encoding by backend
- **TE.CL**: Transfer-Encoding processed by frontend, Content-Length by backend
- **H2.CL**: HTTP/2 downgrade smuggling
- TE obfuscation: `Transfer-Encoding: xchunked`, tab prefix, space prefix
- Use Burp "HTTP Request Smuggler" extension to detect

### CL.TE example
```
POST / HTTP/1.1
Host: target.com
Content-Length: 13
Transfer-Encoding: chunked

0

SMUGGLED
```
Frontend reads CL:13 → sends all. Backend reads TE → sees chunk "0" = end → "SMUGGLED" left in buffer → next user's request poisoned.

### What smuggling enables
- Request queue poisoning (front-end routes victim's request to attacker's smuggled prefix)
- Cache poisoning via smuggled requests
- Auth bypass (smuggle to internal routes without auth)
- Stealing other users' requests (capture tokens)

## GraphQL Introspection Script (map schema fast)
```bash
curl -s https://target.com/graphql -H "Content-Type: application/json" \
  -d '{"query":"{__schema{types{name fields{name}}}}"}' | jq -r '.data.__schema.types[].name' | grep -v "^__"
```

## PARAMETER COVERAGE — EVERY argument, EVERY field, EVERY query (MANDATORY)
The #1 miss: testing only the "interesting" queries/fields and skipping the
rest of the schema. A bug lives in the argument nobody looked at.

1. **Enumerate the FULL schema** via introspection, then list EVERY field and
   EVERY argument (including `input` object arguments — recurse into their
   fields, and optional/paginated args like `first`/`after`/`filter`/`sort`).
2. **Per class, sweep each argument one at a time** (others at baseline):
   - IDOR/authz: swap every object-id argument and `node(id:)` typed IDs; test
     read AND mutation fields
   - injection: SQLi/NoSQLi/SSTI/CMDi payloads on every string argument,
     including filter/sort/order args and search terms
   - mass assignment: extra role/is_admin/status args on every mutation input
   - rate-limit: batching/aliases on login/OTP/verify mutations
   - wrong-type: array/object/null on every argument
3. **Aliases/batching bypass**: when a single query is rate-limited, replay the
   same mutation as aliases `a:`/`b:`/`c:` or as a batch array — this applies
   to EVERY mutation, not just login.
4. **Re-sweep per auth context**: anonymous vs logged-in vs different role;
   some fields authorize lazily.
5. **Track** `query → field → argument → payload → result` in the journal;
   every unlogged argument = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: cache-poisoning — 81 disclosed H1 reports (29 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `for`
- `cb`
- `cachebust`
- `dontpoisoneveryone`
- `name`
- `yeettest`
- `xyzxyz`
- `qwKzzSR`
- `token`
- `CPDoS`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Multiple HTTP Smuggling reports** (HTTP Request Smuggling)
  - Signal: Theses reports spreads other several years and are all about **HTTP Smuggling issues** (HTTP Requests or Responses splitting, Cache Poisoning, Security filter bypass). I've made re
- **[critical] HTTP Smuggling multiple issues in Squid 3.x & squid 4.x** (HTTP Response Splitting)
  - Signal: Hello, as can be seen on a recent public security update by Squid I reported several smuggling issues. If you want some background on impact of Smuggling issues You can check the c
- **[critical] HTTP request smuggling on Basecamp 2 allows web cache poisoning** (HTTP Request Smuggling)
  - Signal: It is found that an authenticated Basecamp 2 user can desync front and backend servers and poison the socket with harmful response for the next visitor. During redirect probe, It a
- **[critical] The Microsoft Store Uber App Does Not Implement Certificate Pinning** (Improper Certificate Validation)
  - Signal: ## Summary The Microsoft Store Uber App (Windows Phone Architecture) does not properly implement certificate pinning. ## Security Impact Layer-2+ network traffic transmitted from a

### Class: http-smuggling — 85 disclosed H1 reports (36 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `name`
- `id`
- `type`
- `lang`
- `authenticity_token`
- `textdomain`
- `password`
- `product`
- `account_id`
- `username`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Multiple HTTP Smuggling reports** (HTTP Request Smuggling)
  - Signal: Theses reports spreads other several years and are all about **HTTP Smuggling issues** (HTTP Requests or Responses splitting, Cache Poisoning, Security filter bypass). I've made re
- **[critical] Stealing Zomato X-Access-Token: in Bulk using HTTP Request Smuggling on api.zomato.com** (HTTP Request Smuggling)
  - Signal: # Intro Hi Zomato Security Team! My name is Evan Custodio and this is my first time evaluating your platform. I specialize in looking for server-side vulnerabilities. Recently I've
- **[critical] HTTP Smuggling multiple issues in Squid 3.x & squid 4.x** (HTTP Response Splitting)
  - Signal: Hello, as can be seen on a recent public security update by Squid I reported several smuggling issues. If you want some background on impact of Smuggling issues You can check the c
- **[critical] Cache Manager ACL Bypass** (Authentication Bypass Using an Alternate Path or Channel)
  - Signal: ## Summary: ACL Manager can be bypassed giving non authorized users to squid-internal-mgr. Possible to bypass other url_regex, but only focused on manager. with the hostname of the

### Class: graphql — 154 disclosed H1 reports (26 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `sentry_key`
- `operation`
- `build_number`
- `platform`
- `key`
- `type`
- `id`
- `page`
- `csrf`
- `scope`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Improper data update process on UpdatePhabricatorIntegration mutation leads to leak of Phabricator Conduit API token.** (Information Disclosure)
  - Signal: ## Details **Title**: Improper data update process on `UpdatePhabricatorIntegration` mutation leads to leak of Phabricator Conduit API token. **Risk**: High **Impact**: High **Expl
- **[critical] Unauthenticated access to Zendesk tickets through athena-flex-production.shopifycloud.com Okta bypass** (Improper Authentication - Generic)
  - Signal: **Summary** athena-flex-production.shopifycloud.com seems to be an internal system that Shopify uses because it redirects user to Okta login. During this however, I noticed that it
- **[critical] Takeover an account that doesn't have a Shopify ID and more** (None)
  - Signal: ## Details The https://pos-channel.shopifycloud.com/graphql-proxy/admin can be exploited to update a staff member email without any email confirmation. Using the partner dashboard,
- **[critical] Confidential data of users and limited metadata of programs and reports accessible via GraphQL** (Information Disclosure)
  - Signal: **Summary:** The GraphQL endpoint doesn't have access controls implemented properly. **Description:** Any attacker can get personally identifiable information of users of Hackerone

