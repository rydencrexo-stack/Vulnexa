---
name: hunt-jwt
description: JWT security hunting — alg:none (case variants, trailing dot), RS256→HS256 key confusion (JWKS public key, rsa_sign2n), kid header injection (path traversal to /dev/null, SQLi/SSRF sinks), jku/x5u injection, jwk self-signed, expiry manipulation (remove exp, nbf+exp 2099), cross-tenant claim injection, offline cracking (hashcat -m 16500, jwt_tool), drive-to-admin discipline. Use when JWT auth, JWKS endpoints, or token-based APIs are detected. Trigger keywords: JWT, alg none, key confusion, JWKS, kid injection, token forge, RS256 HS256.
---

# JWT Security — Deep Hunting

## THE GATE
- **alg:none**: try case variants — `None`, `NONE`, `nOnE` (some verifiers reject lowercase only); keep trailing dot `header.payload.`.
- **RS256→HS256 key confusion**: obtain RSA public key (JWKS, JS bundle, or recover from two captured tokens via rsa_sign2n), re-sign edited payload HS256 using PEM as HMAC secret. **Always try alg:none first — it's free; on 401 try key confusion before concluding safe.**

## Header Injection Vectors
- **`kid`**: `{"alg":"HS256","kid":"../../../../../../../dev/null"}` → empty-string secret → sign HS256. `kid` can reach SQLi/command injection/SSRF if key lookup hits DB/shell/URL.
- **`jku`/`x5u`**: host attacker JWKS, set header, sign with matching private key; if host allowlisted, chain an open-redirect/SSRF on target's own domain.
- **`jwk` self-signed**: embed `{"jwk":{"kty":"RSA","n":"<modulus>","e":"AQAB"}}` in header, sign with matching private key.

## Expiry Manipulation
Remove `exp` entirely (many validators skip check if absent) or set `nbf` past + `exp` 2099 (`4102444800`).

## Cross-Tenant Claim Injection
Decode a real token, identify `org_id`/`tenant`/`workspace_id`/`account_id`, swap to admin's tenant → systematic IDOR via claims.

## Offline Cracking
`hashcat -a 0 -m 16500 token.jwt rockyou.txt`; `jwt_tool -C -d wordlist.txt`.

## Discipline
Match payload claim names to a REAL decoded token — a payload the app can't parse fails for the wrong reason. **Drive to the admin objective** — a forge that loads your own `/my-account` proves mechanism only; immediately forge admin identity + hit `/admin` + perform admin action. On 401, change ONE thing (kid depth, claim name, alg) and retry.

## Validation
Win is cross-identity data access (other users' emails/objects) or completed admin action, not a 200.

## Common Mistakes
Hand-encoding base64 (use jwt_tool/Burp JWT Editor/PyJWT); stopping at self-account; reporting alg:none-rejected as "safe" without trying key confusion; forge server ignores because trust boundary is the session cookie.

## PARAMETER COVERAGE — every token-accepting surface (MANDATORY)
The #1 miss: testing only the main `Authorization` header on one endpoint and
skipping the rest. JWT bugs hide in every place a token is accepted and in
every claim/parameter the endpoint reads.

1. **Enumerate** every token surface: `Authorization: Bearer`, cookie-carried
   JWT (separate cookie per endpoint), `access_token`/`token` query/body
   params, refresh-token endpoints, WebSocket handshake auth, gRPC metadata,
   GraphQL `Authorization` header, and the `kid`/`jku`/`x5u` headers.
2. **For each surface sweep the attack set**:
   - alg:none variants (None/NONE/nOnE, trailing dot) on each endpoint
   - RS256→HS256 key confusion, `kid` path-traversal/SQLi/SSRF, `jku`/`x5u`
     injection, `jwk` self-signed
   - expiry: remove `exp`, `nbf` past + `exp` 2099
   - claim tampering: decode a REAL token, enumerate its claims, then swap
     `role`/`admin`/`org_id`/`tenant`/`account_id`/`user_id` on EACH
   - header/claim-name matching: match the payload to a real decoded token,
     change ONE thing per retry
3. **Drive to admin**: after any forge, hit `/admin` + admin mutation — a
   self-account 200 proves mechanism only.
4. **Re-sweep per auth context and per route** (a JWT may validate on
   `/api/me` but not `/api/export` — sibling-function rule).
5. **Track** `surface → claim/header → attack → result` in the journal; every
   unlogged surface/claim = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: jwt — 32 disclosed H1 reports (16 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `jwt`
- `proceed_to`
- `successRedirectUrl`
- `serial`
- `response_type`
- `client_id`
- `redirect_uri`
- `scope`
- `delegated_scope`
- `state`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Arbitrary file read via the bulk imports UploadsPipeline** (Path Traversal)
  - Signal: ### Summary The bulk imports api does not remove symlinks when untaring the uploads.tar.gz file, allowing arbitrary files to be read and uploaded when importing a group. When a gro
- **[critical] Open memory dump method leaking customer information ,secret keys , password , source code & admin accounts** (Exposed Dangerous Method or Function)
  - Signal: ## Summary: Stripo uses Spring boot for the backend API development , and misconfigured the application to open actuator APIs to the public. This issue is found in 3 domains , don'
- **[critical] JWT audience claim is not verified** (Missing Critical Step in Authentication)
  - Signal: All versions of Argo CD starting with v1.8.2 are vulnerable to an improper authorization bug causing the API to accept certain invalid tokens. OIDC providers include an aud (audien
- **[high] Exposure of a valid Gitlab-Workhorse JWT leading to various bad things** (Improper Authentication - Generic)
  - Signal: ### Summary Using the **State** Uploading API we could potentially do a bad thing: - Bypass `Gitlab::Workhorse.verify_api_request!` This was due to the fact that Workhorse clean th

