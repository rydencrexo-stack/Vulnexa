# PAN — Proactive Attack Navigator

PAN is an authorized web and API security workspace for attack-surface discovery, passive analysis, scanner orchestration, evidence review, AI-assisted triage, vulnerability management, and reporting.

The repository contains a Next.js/TypeScript interface and a FastAPI/Pydantic service backed by atomic JSON repositories. The default configuration is a safe, complete demonstration: scanner work is simulated, provider credentials are optional, and unverified or out-of-scope targets cannot be scanned.

> Use PAN only on systems you own or have explicit written permission to test. The MVP does not implement destructive exploitation.

## What works

- HTTP-only cookie authentication, bcrypt/Argon2-compatible password storage, workspace roles, and admin-only APIs
- Target onboarding, simulated ownership verification, exact include/exclude scope, and URL/address safety validation
- Dashboard, target, asset, endpoint, recon, scan, finding, AI, report, settings, learning, and administrator workflows
- Background recon and scan simulation with events, progress, statistics, pause/resume/cancel, and polling-ready state
- Normalized findings with evidence, sanitized HTTP excerpts, analyst decisions, activity, and retesting
- Provider-neutral AI and Acunetix adapters with explicit disconnected states and realistic mock behavior
- Executive, technical, recon, full-scan, findings-only, and comparison reports in HTML, JSON, CSV, and PDF-compatible form
- Atomic, per-file-locked JSON persistence behind repository interfaces that can later be replaced by PostgreSQL
---

## Live Preview: https://vulnexa-atharva.vercel.app/

---


## Quick start

Prerequisites: Node.js 20 or newer and Python 3.11 or newer.

1. Copy `.env.example` to `.env`. Keep `SCANNER_MOCK_MODE=true` for the self-contained demo and replace `JWT_SECRET` outside local development.
2. Start the API:

   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   python -m app.seed_data --force
   uvicorn app.main:app --reload --port 8000
   ```

3. In another terminal, start the interface:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

4. In a third terminal, start the standalone mobile app:

   ```powershell
   cd mobile-app
   npm start
   ```

5. Open `http://localhost:3000/login`. The mobile app is at `http://localhost:4000` (sign in with `admin` / `admin`). FastAPI's interactive documentation is at `http://localhost:8000/api/docs`.

On macOS or Linux, activate the Python environment with `source .venv/bin/activate`.

> Prefer the one-shot launcher on Windows: `.\start.ps1` starts opencode, the backend, the web UI, and the mobile app, then prints every reachable URL (localhost + LAN IPs) for desktop and phone access.

## Development-only accounts

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@pan.local` | `PanAdmin!2026` |
| Security analyst | `analyst@pan.local` | `PanAnalyst!2026` |

These credentials are deterministic seed data for local demos only. Delete or replace them before exposing the service to other users.

The standalone mobile app (`mobile-app/`) uses its own dev-only credentials: username `admin`, password `admin` (hard-coded in `mobile-app/app.js`).

## Configuration

The root `.env.example` documents every supported variable. The only browser-visible value is `NEXT_PUBLIC_API_URL`; all JWT, Acunetix, and AI secrets remain in the backend process.

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Signs short-lived authentication tokens |
| `FRONTEND_URL` / `BACKEND_URL` | CORS and service origins |
| `ACUNETIX_BASE_URL` / `ACUNETIX_API_KEY` | Optional Acunetix REST integration |
| `AI_PROVIDER` / `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | Optional compatible AI provider |
| `EVIDENCE_DIRECTORY` / `REPORT_DIRECTORY` | Local generated-artifact paths |
| `SCANNER_MOCK_MODE` | Safe simulated scanner workers; defaults to `true` |
| `PAN_CLOUD_MODE` | Blocks private, loopback, link-local, and reserved destinations when enabled |

## Functional and mocked boundaries

| Area | MVP state |
|---|---|
| Authentication, roles, audit logging, JSON repositories | Functional |
| Target CRUD, scope policy, simulated verification | Functional; ownership verification is deliberately simulated |
| Recon, passive, XSS, SQLi, API, secrets, Nuclei/CVE workers | Structured adapter contracts with realistic mock jobs; no external binaries run by default |
| Scan state machine and controls | Functional JSON-backed simulation |
| Finding workflow and deterministic analyst actions | Functional |
| AI Analyst | Validated mock analysis by default; provider-neutral HTTP adapter when configured |
| Acunetix | Full REST v1 client (target sync, scan start/stop, progress sync, vulnerability import, reports) when `SCANNER_MOCK_MODE=false` and `ALLOW_EXTERNAL_INTEGRATIONS=true`; realistic mock mode without credentials |
| Reports | Generated from repository data; formats depend on installed optional PDF runtime |
| Email password recovery | Safe demo acknowledgement; no external mail provider |
| Screenshots/browser verification | Adapter-ready and Playwright-ready; simulated evidence in the default seed |

## Repository map

```text
frontend/                  Next.js App Router application
  app/                     Public, onboarding, product, and admin routes
  components/              Accessible shell, tables, cards, badges, and feedback
  features/                Feature-specific models and composed views
  services/                Credentialed API client and demo-safe fallbacks

mobile-app/                Vulnexa Live - standalone installable mobile PWA
  server.js                Static server + /api reverse proxy to the backend
  index.html / app.js      Login + mobile shell and views (admin / admin demo login)
  styles.css / sw.js       Mobile-first theme and offline cache
  manifest.webmanifest     PWA install manifest

mobile-certs/              Self-signed TLS demo certificates for mobile-app :4443

backend/
  app/api/                 FastAPI route groups
  app/repositories/        Persistence interfaces and JsonRepository
  app/security/            Authentication, authorization, and scope policy
  app/services/            Orchestration, AI, Acunetix, and reporting
  app/scanners/            Validated scanner adapter contracts and mocks
  data/                    Versioned JSON collections
  evidence/                Generated evidence (ignored by Git)
  reports/                 Generated reports (ignored by Git)
  tests/                   Repository, auth, scope, and API tests
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for trust boundaries, persistence, and the scan lifecycle. Backend endpoint details are also available through OpenAPI at `/api/docs` and `/api/openapi.json` while the API is running.

## Verification

```powershell
cd backend
pytest

cd ..\frontend
npm run lint
npm run build
```

The generated JSON data is intentionally human-inspectable, but it is application state. Stop the API before manually editing it. Never place passwords, cookies, API tokens, authentication headers, or provider credentials in any collection.

---

## 🚀 Author:

## Atharva A. Deshmukh

---

## Educational Purpose & Responsible Use

Vulnexa is developed **strictly for educational, research, and authorized security-testing purposes**.

- Use Vulnexa only on systems you own or have explicit permission to test.
- Do **not** use it to hack, attack, scan, or access someone else's systems without authorization.
- The author is not responsible for misuse of this project.
- By using Vulnexa, you agree to comply with applicable laws and regulations.

