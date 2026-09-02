# PAN architecture

PAN is split into a Next.js application and a FastAPI service. The browser never receives scanner or AI provider credentials. It talks only to authenticated `/api/*` routes, using an HTTP-only JWT cookie.

```text
Next.js UI
  |  credentialed HTTP + role-aware navigation
  v
FastAPI route layer
  |-- auth and authorization dependencies
  |-- target verification and scope policy
  |-- scan/recon orchestration
  |-- finding, AI, and report services
  v
Repository interfaces
  |-- JsonRepository (MVP)
  `-- PostgreSQL repository (future, no route changes)

Scanner adapters              Provider adapters
  |-- safe mock adapters         |-- mock AI analyst
  |-- recon tool contracts       |-- provider-neutral HTTP AI
  `-- specialist contracts      `-- Acunetix REST adapter
```

## Trust boundaries

- A target must be verified before recon or scanning can begin.
- Every request candidate is validated against included hosts, paths, ports, exclusions, and redirect scope.
- Cloud mode rejects private, loopback, link-local, and reserved addresses.
- Scanner adapters accept validated task objects and structured argument arrays. Raw user input is never interpolated into a shell command.
- Target responses, JavaScript, logs, and evidence are untrusted. The AI service sees sanitized evidence envelopes and cannot alter scope or finding verification state.
- Passwords are one-way hashed. JWTs, credentials, authentication secrets, scanner keys, and provider keys are never written to JSON collections.

## JSON persistence

Each collection has an independent lock and envelope version. Writes read the latest data, validate records, write a temporary sibling, optionally preserve a backup, and atomically replace the collection. Repository consumers rely on an interface rather than filesystem details.

This design intentionally favors a stable single-node demonstration. Production migration should replace background tasks with a durable queue, JSON repositories with transactional PostgreSQL repositories, local evidence with object storage, and the development cookie configuration with strict HTTPS settings.

## Scan lifecycle

```text
queued -> scope_validation -> reconnaissance -> endpoint_discovery
       -> passive_analysis -> active_testing -> verification
       -> ai_analysis -> report_generation -> completed
```

A job can be paused, resumed, or cancelled by its workspace members. State transitions and material security actions emit scan events and audit records.

