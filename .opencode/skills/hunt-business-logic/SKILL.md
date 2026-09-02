---
name: hunt-business-logic
description: Business logic vulnerability hunting — race-multi-redemption, negative quantity, client-side checkout trust, price-per-unit mass assignment, archived-price swap TOCTOU, rate-limit bypass, UI-only verification gates, exposed internal storefronts; validation Gate 0. Use when checkout, order, subscription, payment, verify, webhook, coupon, or credit logic is in scope. Trigger keywords: business logic, coupon, checkout, payment bypass, negative quantity, webhook, double spend.
---

# Business Logic — Deep Hunting

## Highest-Yield Vectors (each with a monetized case)
- **Race-multi-redemption**: coupon/credit/gift-card redemption lacks idempotency/locking — Stripe $20k fee-credit replayed 30× in parallel (H1 $5k); Reverb gift card parallel-POST. Turbo Intruder over one TCP connection defeats uniqueness checks.
- **Negative quantity**: `{"items":[{"id":1,"qty":1,"price":50},{"id":2,"qty":-3,"price":50}]}` → total -$100, floors to ~0, goods fulfilled.
- **Client-side checkout trust**: tamper `amount=0.01&currency=...` mid-flow; webhook lacking HMAC accepts fake success.
- **Price-per-unit mass assignment**: `PUT /v2/seats` with server-trusted `price=1`.
- **Archived-price swap / cart TOCTOU**: start checkout on new payment-link, mid-flow swap `price_id` to archived cheaper price — missing join check "price.active AND price ∈ link.allowed_prices".
- **Rate-limit bypass**: rotate `X-Forwarded-For`/`X-Real-IP`/`CF-Connecting-IP` per request (IP from header, not socket).
- **UI-only verification gates**: hit post-verification API directly with unverified session; replay valid token on another account.
- **Exposed internal/employee storefronts**: unlisted Shopify private channels fully functional for checkout.

## Key Endpoints
`/checkout /order /subscribe /payment /verify /confirm /callback /webhook`, `/internal /employee /staff /admin`, payment notifies.

## Fingerprinting
`Set-Cookie` cart/order session state; payment provider names in responses; client-side price calc in JS (`grep "(price|amount|total)\s*[=*+]"`); webhooks without signature validation.

## Validation (Gate 0)
Concrete attacker action ("unauth user places order at $0"), concrete victim loss (financial/privacy/service abuse), 10-minute reproduction from fresh account.

## Common Mistakes
Vague impact ("flow looks weird"); no end-to-end chain; not chaining the race primitive to the money impact.

## PARAMETER COVERAGE — every field of money/workflow endpoints (MANDATORY)
The #1 miss: testing only the obvious `price`/`amount`/`qty` fields and
skipping the rest of the request and the adjacent endpoints.

1. **Enumerate** the FULL field set of every money/workflow endpoint
   (checkout, order, subscribe, verify, webhook, coupon, credit, refund,
   transfer): `price`/`amount`/`qty`/`total`, `currency`, `coupon`/`promo`,
   `status`, `role`/`plan`/`tier`, `items[]` (each nested item's fields),
   `price_id`/`plan_id`, `customer_id`, `return_url`, plus every query key and
   header (rate-limit IP headers, webhook signature headers).
2. **Sweep EACH field**:
   - negative / zero / huge / float-vs-string (`"100"` vs `1e2` vs `100.0`) /
     overflow on every numeric field
   - `price_id` swap to archived/cheaper plans; `coupon` replay and race
   - `status`/`role`/`tier`/`verified` mass-assignment on every write
   - workflow-skip: hit post-verification endpoints directly, reorder steps,
     bypass payment on each route
   - rate-limit: IP-rotation headers on each limit
3. **Race every check-then-act field** (coupon redeem, gift card, withdrawal,
   verify, vote): single-packet N=30, gate-open; watch for double-spend per
   endpoint.
4. **Webhooks**: enumerate every webhook field; missing-HMAC accepts fake
   success on each callback route.
5. **Re-sweep per tier** (free vs paid) and per auth context.
6. **Track** `endpoint → field → technique → result` in the journal; every
   unlogged field = gap.

## RATE-LIMIT / VERIFICATION-GATE BYPASS (MANDATORY)
Coupon codes, OTP gates, redemption caps and "X attempts" checks are all
limiter logic — apply the FULL bypass matrix from hunt-brute-force (§A–§H) to
every business-logic gate, not just auth endpoints:
1. Header spoofing (XFF/X-Real-IP/localhost), path normalization variants,
   equivalent endpoints (`/redeem` vs `/api/v1/redeem` vs GraphQL mutation),
   identity mutation (`+` alias, case, trailing dot), HPP (duplicate fields),
   protocol downgrade, session/cookie reset between attempts.
2. The verification gate may be UI-only — find the API it calls and hit the
   business endpoint directly (skip the check), or replay a validly-gated
   request while the limiter counts another key.
3. **Counter race**: gift-card/coupon redemption caps and OTP windows are the
   classic non-atomic counters — single-packet burst (hunt-race-condition §G
   here and the RATE-LIMIT COUNTER RACE section) to over-redeem.
4. Confirm via double-spend proof: the same code/token used twice (two
   successful redemptions / one code, two uses) — see Gate 0 in the gate below.
5. **Track** `gate → technique → result` in the journal.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: business-logic — 318 disclosed H1 reports (61 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `key`
- `email`
- `name`
- `load`
- `config`
- `lang`
- `amount`
- `client_id`
- `source`
- `xtl_coupon_code`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Unrestricted File Upload Leading to Remote Code Execution** (Business Logic Errors)
  - Signal: ### Description As an administrator user it is possible to create files and directories in any location on the file system of the server. This can be abused to write files to any s
- **[critical] An attacker can run pipeline jobs as arbitrary user** (Business Logic Errors)
  - Signal: ### Summary An attacker can run arbitrary pipeline jobs as a `victim` user. This means the attacker can access the user private repositories, member only repositories, registry, et
- **[critical] [yarn] yarn.lock integrity & hash check logic is broken** (Business Logic Errors)
  - Signal: I would like to report a vulnerability in `yarn`. It allows to pollute yarn cache via a crafted `yarn.lock` file and place a malicious package into cache under any name/version, by
- **[critical] Modify in-flight data to payment provider Smart2Pay** (Business Logic Errors)
  - Signal: I have found vulnerability which allows attacker to generate steam wallet balance. Firstly you will have to change yours steam account email to something like (I will explain why i

