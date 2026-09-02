# EXTRA: Mobile, API, and CI/CD Hunting

## Android / Mobile Hunting

- Certificate pinning bypass (Frida/objection)
- Exported activities/receivers (AndroidManifest.xml)
- Deep link injection
- Shared preferences / SQLite in cleartext
- WebView JavaScript bridge
- Mobile API often uses older/different API version than web

## API-Specific

- Older unprotected API versions (`/api/v1/` guarded, `/api/` isn't)
- Parameter pollution (duplicate params, array params, encoded separators)
- JWT issues: alg=none, weak HMAC secret, kid injection, missing exp/nbf, algorithm confusion (RS256→HS256)
- Mass assignment (extra fields in JSON body that backend accepts)
- API key leaked in JS bundles, source maps, mobile app strings
- WebSocket endpoints (client-supplied object IDs)
- Batch endpoints for rate limit bypass

## CI/CD Pipeline

- GitHub Actions: `pull_request_target` with checkout of PR code
- Secrets in workflow logs
- Artifact poisoning (overwrite existing artifacts)
- Build command injection via branch/tag names
- OIDC token theft from CI runners

## GraphQL Extra Notes

- Aliases to bypass rate limits: `{ a: login(...), b: login(...) }`
- Persisted query bypass (unregistered queries accepted)
- Introspection enabled on production → map the schema, look for admin/mutation endpoints
- Subscription/streaming endpoints with weak auth

## JWT Bypass Quick Reference

| Attack | Payload / Test |
|---|---|
| alg=none | Remove signature, set header `{"alg":"none"}` |
| Weak secret brute | `hashcat -m 16500 jwt.txt rockyou.txt` |
| kid injection | `{"kid":"../../../../../../dev/null"}` (path traversal), or SQLi in kid |
| Algorithm confusion | Force HS256 with server's public key as HMAC secret |
| Missing validation | Remove signature entirely — does server still accept? |
| Expiration bypass | Set `exp` far future, or remove `exp`/`iat` if not enforced |
