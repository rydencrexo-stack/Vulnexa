---
name: hunt-laravel
description: Laravel security hunting — APP_DEBUG=true → Ignition RCE (CVE-2021-3129), Telescope/Horizon leaks, .env exposure and variants, APP_KEY → cookie forge + session ATO, signed URL manipulation, mass assignment, cookie deserialization via phpggc. Use when laravel_session cookie, Whoops/Ignition error page, or .env reachable detected. Trigger keywords: Laravel, Ignition, Telescope, .env, APP_KEY, debug mode.
---

# Laravel — Deep Hunting

## THE GATE
Crown jewel: `APP_DEBUG=true` in production → Ignition RCE (CVE-2021-3129, Laravel < 8.4.2) via unauthenticated `/_ignition/execute-solution`.

## Attack Vectors
- **Ignition log-file RCE**: `MakeViewVariableOptionalSolution` + `viewFile: php://filter/write=convert.base64-decode/resource=../storage/logs/laravel.log` → log poisoning → include → code exec (requires writable storage/logs).
- **Telescope** (`/telescope`) — requests, commands, redis, environment API endpoints leak tokens/DB queries. **Horizon** (`/horizon`) — failed jobs often contain full payloads with API keys/PII.
- **`.env` leak** → `APP_KEY` → decrypt all encrypted cookies, forge session → ATO; also try `.env.backup/.env.local/.env.production`.
- **Signed URL manipulation**: test every param, removing signature, appending extra params.
- **Mass assignment**: `{"is_admin": true, "role": "admin", "verified": true}` on profile/register.
- **Cookie deserialization**: with APP_KEY, forge session via `phpggc Laravel/RCE5 system 'id'` + laravel-cookie-forge.

## Key Endpoints
`/_ignition/health-check`, `/_ignition/execute-solution`, `/telescope/api/{requests,commands,redis,environment}`, `/horizon/api/jobs/failed`, `/.env*`, `/storage/logs/laravel.log`.

## Fingerprinting
`laravel_session` cookie; `X-Powered-By: PHP`; Whoops/Ignition error page; `/storage` paths reachable.

## Validation
Ignition returns `id` output; forged session cookie returns another user's profile; mass assignment grants admin; debug-mode confirmed before attempting Ignition.

## Common Mistakes
Testing Ignition without confirming debug mode; only grabbing `/.env` not variants; ignoring Telescope's `environment` endpoint which dumps env vars.