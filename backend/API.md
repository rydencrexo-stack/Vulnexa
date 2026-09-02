# PAN API notes

All application endpoints are under `/api`. Except health, registration, login, forgot-password, and generated OpenAPI documentation, endpoints require the `pan_session` HttpOnly cookie (or a Bearer token for API testing). JSON fields use camelCase. Errors have one stable envelope:

```json
{
  "error": {
    "code": "scope_safety_violation",
    "message": "Target ownership must be verified before reconnaissance or scanning",
    "details": null,
    "requestId": "..."
  }
}
```

Collection endpoints return `{ items, total, page, pageSize, pages }`. Default maximum page size is 200.

## Core endpoints

| Group | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /login`, `POST /logout`, `GET /me`, `POST /forgot-password` |
| Workspaces | `GET/POST /api/workspaces`, `GET /api/workspaces/{id}` |
| Dashboard | `GET /api/dashboard/summary`, `GET /activity` |
| Targets | `GET/POST /api/targets`, `GET/PATCH/DELETE /{id}`, `POST /{id}/verify`, `GET /{id}/scope-check?url=` |
| Inventory | `GET /api/assets`, `GET /api/assets/{id}`, `GET /api/endpoints`, `GET /api/endpoints/{id}` |
| Recon | `GET /api/recon/overview`, `POST/GET /jobs`, `GET /jobs/{id}`, `POST /jobs/{id}/cancel` |
| Scans | `POST/GET /api/scans`, `GET /{id}`, `GET /{id}/events`, `POST /{id}/pause|resume|cancel` |
| Active scanner | `GET /api/active-scanner/status`, `POST /test-connection`, `POST /sync-targets`, `POST /scans`, `GET /scans/{id}`, `POST /scans/{id}/stop|sync-findings` |
| Scanner modules | `GET /api/scanner/overview`, `GET /modules`, `GET /{module}`, `POST /{module}/jobs` |
| Findings | `GET /api/findings`, `GET/PATCH /{id}`, analyst-only `POST /{id}/confirm|false-positive|accept-risk|mark-fixed|retest` |
| AI | `POST /api/ai/chat`, `POST /analyze-finding`, `POST /generate-remediation`, `GET /conversations` |
| Reports | `POST/GET /api/reports`, `GET /{id}`, `GET /{id}/download?format=pdf|html|json|csv` |
| Notifications | `GET /api/notifications`, `PATCH /{id}`, `POST /read-all` |
| Settings | `GET /api/settings/capabilities`, `GET/PUT /{workspaceId}/{category}` |
| Admin | `GET /api/admin/overview|users|organizations|plans|scan-workers|scanner-tools|templates|system-health|abuse-monitoring|audit-logs`; selected resources also expose detail/update routes |

State-changing scan and recon requests must include `authorizationAcknowledged: true`. Target verification requests require the same acknowledgement. An AI result never constitutes deterministic confirmation and the AI routes never write a confirmed state.
