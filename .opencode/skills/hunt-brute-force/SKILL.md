---
name: hunt-brute-force
description: Brute-force / rate-limit hunting — four rate-limit states (hard lockout, soft IP throttle, CAPTCHA injection, silent shadow-throttle), shadow-throttle seed detector, IP rotation bypass headers, token entropy measurement (Burp Sequencer), ReDoS detection, full-keyspace proof math, three-column observation (status, latency, body size). Use when login, OTP, reset, or any credential/verification endpoint is in scope. Trigger keywords: brute force, rate limit, lockout, credential stuffing, throttle, OTP brute.
---

# Brute-Force & Rate-Limit — Deep Hunting

## THE GATE — Four Rate-Limit States (never collapse them)
A 200/401 with no 429 does NOT mean "no rate limit." Classify: (1) hard lockout, (2) soft IP throttle (bypassable via header rotation), (3) CAPTCHA injection (200 but body switches to challenge), (4) **silent shadow-throttle** — requests get 200/401 but submissions are dropped. The trap: naive loop reports "no rate limit" on a shadow-throttled endpoint.

## Shadow-Throttle Seed Detector
Place a known-good OTP at position 500 of your brute set; if the correct code stops authenticating under load, it's throttling, not unprotected. Watch three columns: status, time_total, body size — rising latency or body-size shift with status unchanged = shadow throttle.

## IP Rotation Bypass
Rotate `X-Forwarded-For`, `X-Real-IP`, `X-Originating-IP`, `X-Client-IP`, `CF-Connecting-IP`, `True-Client-IP` every request; also multi-comma XFF, spoofed-then-real-IP. **Proof = delta**: re-run without rotation, show 429 returns.

## Token Entropy Measurement
20+ tokens → `ent`/Shannon bits, hex/base64 decode for timestamp/counter/PID structure, sort-diff consecutive numeric tokens, Burp Sequencer effective bits (<64 bits on a security token = finding).

## ReDoS
Super-linear latency doubling per +5 chars with a benign-byte-length control; linear = just slow.

## Full-Keyspace Proof
Report the math (throughput × code-lifetime vs 10^6), don't actually exhaust against third parties. Instagram-2019 class = 6-digit code + no rate limit + IP rotation.

## Detection
Burst ~50 requests logging status+latency+body length per attempt; timing oracle = compare medians of 30+ samples, never single requests.

## Validation
Reachable impact required — rate-limit gap with no reachable outcome is Informational.

## Common Mistakes
Checking only for 429; single-request timing; 101-code probe claimed as full-keyspace proof; missing the shadow-throttle false-negative.

## PARAMETER COVERAGE — every credential/verification field (MANDATORY)
The #1 miss: testing only the primary `password`/`otp` field and skipping the
rest. Rate-limit and brute-force bugs hide in EVERY field of the endpoint and
in every step of a multi-step flow.

1. **Enumerate** every field of each login/OTP/reset/verify endpoint:
   `username`/`email`, `password`/`pin`/`otp`/`code`, `token`, `remember`,
   `captcha`/`g-recaptcha-response`, `type`/`factor`, plus nested JSON keys and
   every header (`X-Forwarded-For`, `User-Agent`, `X-Client-IP`,
   `CF-Connecting-IP`).
2. **Sweep rate-limit state per field**: burst each field in isolation and
   classify the four states (hard lockout / soft IP throttle / CAPTCHA / silent
   shadow-throttle) — watch status AND latency AND body-size per attempt, never
   just 429.
3. **Rate-limit bypass ladders on each endpoint**: rotate IP-spoofing headers,
   rotate the target username (multi-account throttling), alternate content-
   types, alternate endpoints (login vs `verify` vs reset vs API), alternate
   HTTP verbs, batching (GraphQL aliases), and check each OTP step separately.
4. **Entropy/token analysis on every token field**: collect 20+ samples,
   measure bits, decode base64/hex, diff consecutive values for counter/epoch
   structure.
5. **OTP prefix oracle**: on verify endpoints, probe one digit at a time (the
   prefix oracle collapses 10^6 → ~60 guesses) — on EVERY OTP field.
6. **Re-sweep per auth context** (anon, logged-in, different role) and per
   content-type.
7. **Track** `endpoint → field → state → result` in the journal; unlogged
   field = gap.

## RATE-LIMIT BYPASS MATRIX (MANDATORY — sources: Raxomara, HackTricks, SecureLayer7, payloadplayground)
Every limiter answers two questions: **who is this request (the key)** and
**how many have I seen (the counter)**. Bypasses change the key or race the
counter. **First map the limit**: hit until 429, read `Retry-After`/
`X-RateLimit-*` headers (window + quota + reset), then test exactly `limit`,
`limit+1`, `limit+2` (increment may happen after the check). Send an
unauthenticated and an authenticated request to see whether the bucket follows
IP, session, account, or route — the bypass that works depends ENTIRELY on
which key is used. **Change ONE variable per test** so you can attribute the
bypass precisely, then stack them once confirmed.

### A. Header spoofing (per-IP limiters)
- Rotate IP headers per request: `X-Forwarded-For`, `X-Real-IP`,
  `X-Originating-IP`, `X-Remote-IP`, `X-Remote-Addr`, `X-Client-IP`,
  `True-Client-IP`, `CF-Connecting-IP`, `X-Host`, `X-Forwarded-Host`,
  `X-Forwarded`, `Forwarded`, `Via`, `X-ProxyUser-Ip`, `Cluster-Client-IP`
- Parsing order: proxies take left-most OR right-most of a multi-value XFF —
  rotate `X-Forwarded-For: 1.1.1.1, 2.2.2.2` and vary which end wins
- Duplicate the header (`X-Forwarded-For: real` then again `spoofed`) — limiter
  and app may disagree on which value wins
- Try localhost/internal values (`127.0.0.1`, `10.0.0.1`, `172.16.0.0`,
  `localhost`) — some apps whitelist these and skip limiting entirely
- Alternate IP encodings of one address (hex/decimal/octal/short-form) as
  distinct raw-string keys

### B. Path / case / encoding normalization desync (per-route limiters)
The limiter keys the normalized path; the router collapses variants → fresh
bucket per variant:
- Trailing slash `/login` vs `/login/`, double slash `//login`, `/login/..`
- Case folding `/login` vs `/logiN` vs `/LOGIN` (case-insensitive backends)
- Encoded separators `%2f`, `%252f`; blank/control chars `%00`, `%09`, `%20`,
  `%0d`, `%0a`, `%0C`
- Matrix/path params `;jsessionid=x`, `/login;x=y` (Tomcat strips, limiter keeps)
- Dot-segments `/./login`, `/../login` (limiter counts, router resolves)
- Junk cache-buster / non-significant params `?x=1`, `?x=2` (limiter hashes
  full request-URI; backend ignores them)

### C. Equivalent / shadow endpoints (per-route limiters)
Same action reachable via unrated routes — cycle the action across ALL of them:
- `/api/v1/login` vs `/api/v2/login`; `/login` vs `/auth/login`
- `/login` vs `/oauth/token` (password grant) vs mobile API vs GraphQL
  `mutation login` vs WebSocket/gRPC variant
- Unversioned/legacy/internal paths (`/internal/*`, `/api/*` without the limiter)
- Bulk/batch helpers: `/v2/batch`, arrays of objects in one body

### D. Identity mutation (per-account / per-credential limiters)
Desync the limiter's key from the app's lookup by mutating the identity value:
- Email case `victim@x.com` vs `Victim@X.com`; Gmail `+` alias `v+X@x.com`;
  trailing dot `v@x.com.` — same account in auth, distinct bucket in limiter
- Embedded/partial encoding `e%78ample@em%61il.com`; appended chars
  `victim@x.com%00`, `%0a`, `%09` — login code normalizes, limiter doesn't
- HPP: duplicate the identity field `email=a@x.com&email=v@x.com` (limiter keys
  one occurrence, auth reads the other; PHP keeps last, ASP.NET concatenates,
  Express arrays)
- Password spraying instead of per-account brute (one password across many
  accounts; no single account crosses its lockout threshold)

### E. Protocol & transport tricks
- Protocol downgrade: HTTP/2→1.1 (per-connection vs per-request counting);
  some limiters count H1 connections, not H2 streams — multiplex hundreds of
  H2 streams per connection (Turbo Intruder `requestsPerConnection: 100-1000`)
- HTTP pipelining on one connection
- **WebSocket / gRPC upgrade**: many edges only rate-limit the initial HTTP
  request; after `101`/gRPC handshake, frames/messages bypass per-request
  counters — spray OTP/codes inside one upgraded channel
- **CDN PoP sharding**: Cloudflare-type counters are per data-center — route
  through egress nodes in many regions to multiply quota

### F. Session / cookie / origin reset
- Clear or change cookies between attempts (per-session counter resets)
- Mint a fresh unauthenticated session each round (re-fetch CSRF/anti-bot token)
- Request a NEW session ID after the old is blocked — OTP attempt limits are
  often tied to the session ID while the "start session" endpoint is unthrottled
- Log in before each batch (some limiters reset on successful login)
- Bypass the CDN entirely: hit the origin IP / Cloudfront IP with `Host: target`

### G. Counter race (TOCTOU — strongest against correct limiters)
A non-atomic limiter reads count → compares → increments. Fire a concurrent
burst so many requests read the pre-increment value (see hunt-race-condition):
- Single-packet attack (final bytes of N requests in one TCP packet, ~30 max)
- Turbo Intruder `openGate()` release; N=30 default, verify in Wireshark (one
  TLS record / one TCP segment)
- Most effective against the FIRST batch (a "5 OTP attempts" limit can leak
  20+ tries if the increment isn't atomic)

### H. Timing / sliding-window
- Known bucket boundary (`X-RateLimit-Reset: N`): fire max-allowed just before
  reset, then another full burst just after
- Reactive/shadow limits: verify a valid submission still 200s under load
  (shadow-throttle detection, see THE GATE)

### Confirmation
429 → apply ONE mutation → requests succeed again = that mutation defeats the
limiter (note exactly which one). Report the minimal sufficient bypass but
stack aggressively during testing, then narrow down.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: rate-limit-brute — 345 disclosed H1 reports (54 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `email`
- `_m`
- `id`
- `proto`
- `password`
- `_v`
- `fbclid`
- `_nfpb`
- `_pageLabel`
- `source`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] HTML injection in API response including request url** (Remote File Inclusion)
  - Signal: Hi Reddit , I found a way to distribute, persist & store Illegal images such as child porn , beheadings on reddit and in plain sight . I can also store & distribute xml ,json data 
- **[critical] Absence of Token expiry leads to Unauthorized login Access** (Improper Authentication - Generic)
  - Signal: ### Summary While doing the testing for the mobile app, I observed out that it is possible to bypass the authentication and gain unauthorized access to the user's account bu brute-
- **[critical] Misconfigurated login page able to lock login action for any account without user interaction** (None)
  - Signal: ## Summary While observing a few things about the login feature, I found that the account was locked after a certain number of requests. Although this feature is actually added to 
- **[critical] Identify the mobile number of a twitter user** (Information Disclosure)
  - Signal: **Summary:** By exploiting this security vulnerability we can detect the mobile number of a twitter user. **Description:** This security vulnerability is of type "Information discl

