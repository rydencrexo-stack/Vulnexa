# PAN backend

PAN (Proactive Attack Navigator) is a FastAPI backend for an authorized web and API security workflow. This hackathon implementation is fully runnable with structured JSON storage and safe mock workers. It does not execute scanner binaries or send attack traffic.

## Quick start

From `backend/`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:JWT_SECRET = python -c "import secrets; print(secrets.token_urlsafe(48))"
$env:SCANNER_MOCK_MODE = "true"
python -m app.seed_data --force
uvicorn app.main:app --reload --port 8000
```

The interactive API documentation is at `http://localhost:8000/api/docs`; health is at `http://localhost:8000/api/health`. The frontend origin defaults to `http://localhost:3000` and credentialed CORS is restricted to that origin.

For Bash, set variables with `export JWT_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"`.

## Development-only demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@pan.local` | `PanAdmin!2026` |
| Analyst | `analyst@pan.local` | `PanAnalyst!2026` |

These accounts are intentionally documented for local demonstration only. Delete/reseed them and set a strong `JWT_SECRET` before any deployment.

## Architecture

Route handlers depend on a `RepositoryRegistry`, not JSON files directly. Every collection has a Pydantic record model. `JsonRepository` validates on read and write, performs a locked read-modify-write cycle, fsyncs a same-directory temporary file, atomically replaces the collection, and retains the immediately previous `.bak` copy. IDs are UUID-based and timestamps are UTC ISO-8601 values.

Authentication uses bcrypt-SHA256 password hashes and signed JWT access tokens in `HttpOnly`, `SameSite=Lax` cookies. Set `COOKIE_SECURE=true` behind HTTPS. Admin and analyst actions are enforced by backend dependencies, and cross-workspace resource lookups are returned as not found to prevent enumeration. Password hashes are stripped from every user response.

The scan/recon runner uses daemon threads only to create realistic progress, events, and inventory records. The runner passes validated `ScannerTask` objects to mock adapters. No adapter launches a process. The specialist scanner classes are explicit disabled interfaces for a later isolated worker implementation.

Target creation requires an authorization acknowledgement. Jobs require a verified target, consistent included/excluded scope, an in-scope start URL, allowed port, platform request/concurrency limits, and another authorization acknowledgement. `CLOUD_MODE=true` additionally rejects private, loopback, link-local, reserved, multicast, and unspecified destinations. Redirects can be checked through the same scope evaluator.

AI analysis is provider-neutral and mock by default. It receives only stored, sanitized evidence context, treats target content as untrusted, cites evidence IDs, and cannot change `verificationState`. Provider calls require explicit credentials plus `ALLOW_EXTERNAL_INTEGRATIONS=true`.

Reports are generated as HTML, JSON, CSV, and PDF. Filenames are server-generated, downloads resolve inside the configured report directory, and responses use private/no-store headers.

## JSON collections

The seed script initializes all required collections under `data/`: users, organizations, workspaces, targets, assets, endpoints, recon jobs, scans, scan events, findings, reports, notifications, AI conversations, learning progress, scanner tools, scan workers, templates, plans, settings, and audit logs. Each uses:

```json
{
  "version": 1,
  "updatedAt": "2026-08-27T00:00:00Z",
  "items": []
}
```

Secrets, cookies, reset tokens, API keys, and provider credentials are never JSON fields.

## Functional versus mocked

Functional:

- registration, login, logout, current-user session, password hashing, roles, and workspace isolation;
- workspace and target CRUD, simulated ownership verification, and exact scope evaluation;
- JSON repository filtering, sorting, pagination, locking, backups, validation, and atomic writes;
- inventory queries, dashboard aggregation, scan state controls, finding lifecycle, retest records, notifications, settings, audit logs, and admin views;
- HTML, JSON, CSV, and PDF report generation/download.

Mocked or deliberately disconnected:

- Subfinder, HTTPx, Naabu, Katana, Wayback, JavaScript extraction, technology detection, and screenshots return structured mock observations;
- XSS, SQLi, Schemathesis, secrets, Nuclei, and custom execution boundaries never launch tools;
- Acunetix supplies a realistic mock adapter by default; without mock mode it is disconnected, and an explicitly enabled configured adapter only tests connectivity;
- AI returns evidence-bounded deterministic mock analysis unless a provider is explicitly enabled;
- forgot-password always returns a non-enumerating demo response and creates no token.

## Tests

```powershell
pytest
```

Tests use isolated temporary data/report/evidence directories and cover repository behavior, password/JWT auth, roles, scope safety, target verification, scan/recon guards and controls, finding lifecycle, AI confirmation isolation, reports, and critical API authorization.

See [API.md](./API.md) for endpoint notes and the generated OpenAPI document for complete schemas.
