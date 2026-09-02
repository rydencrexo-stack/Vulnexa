from __future__ import annotations

import logging
import os
import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import active_scanner, admin, agent, agent_bridge, ai, auth, combo, dashboard, findings, inventory, mobile, notifications, recon, recon_real, reports, scanner, scans, settings as settings_api, targets, workspaces
from app.config import Settings
from app.repositories.json_repository import (
    RepositoryConflictError,
    RepositoryCorruptError,
    RepositoryError,
    RepositoryNotFoundError,
)
from app.repositories.registry import RepositoryRegistry
from app.services.acunetix import AcunetixSyncPoller, build_acunetix_adapter
from app.services.ai import build_ai_adapter
from app.services.reports import ReportService
from app.services.simulation import MockJobRunner
from app.utils.errors import AppError


logger = logging.getLogger("pan.api")


def _error_payload(request: Request, code: str, message: str, details: Any | None = None) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "requestId": getattr(request.state, "request_id", None),
        }
    }


def create_app(settings: Settings | None = None) -> FastAPI:
    if settings is None:
        loaded = Settings.from_env()
        if loaded.environment == "production" and not os.getenv("JWT_SECRET"):
            raise RuntimeError("JWT_SECRET is required when PAN_ENV=production")
        settings = loaded
    settings.prepare_directories()
    repositories = RepositoryRegistry(settings.data_directory, backups=settings.repository_backups)
    repositories.initialize_all()
    job_runner = MockJobRunner(repositories, settings)
    job_runner.recover_scheduled_scans()
    job_runner.recover_running_scans()
    job_runner.start_demo_autopilot()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        job_runner.stop_all()
        app.state.acunetix_sync.stop()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description=(
            "Authorized attack-surface management and security assessment API. "
            "The MVP defaults to safe mock scanner execution."
        ),
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.repositories = repositories
    app.state.job_runner = job_runner
    app.state.acunetix = build_acunetix_adapter(settings)
    app.state.acunetix_sync = AcunetixSyncPoller(repositories, app.state.acunetix)
    app.state.acunetix_sync.start()
    app.state.ai_adapter = build_ai_adapter(settings)
    app.state.report_service = ReportService(repositories, settings.report_directory)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Accept", "Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next: Any) -> Any:
        request.state.request_id = request.headers.get("x-request-id", str(uuid.uuid4()))[:128]
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if request.url.path.startswith("/api/auth"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(request, exc.code, exc.message, exc.details),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Do not echo request inputs: login/registration validation may contain passwords.
        details = [
            {"location": list(error["loc"]), "message": error["msg"], "type": error["type"]}
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=_error_payload(request, "validation_error", "Request validation failed", details),
        )

    @app.exception_handler(HTTPException)
    async def http_error_handler(request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(request, "http_error", str(exc.detail)),
            headers=exc.headers,
        )

    @app.exception_handler(RepositoryNotFoundError)
    async def repository_not_found_handler(request: Request, exc: RepositoryNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content=_error_payload(request, "not_found", str(exc)))

    @app.exception_handler(RepositoryConflictError)
    async def repository_conflict_handler(request: Request, exc: RepositoryConflictError) -> JSONResponse:
        return JSONResponse(status_code=409, content=_error_payload(request, "repository_conflict", str(exc)))

    @app.exception_handler(RepositoryCorruptError)
    async def repository_corrupt_handler(request: Request, exc: RepositoryCorruptError) -> JSONResponse:
        logger.exception("Repository corruption request_id=%s", request.state.request_id)
        return JSONResponse(
            status_code=503,
            content=_error_payload(request, "storage_unavailable", "A data collection is unavailable"),
        )

    @app.exception_handler(RepositoryError)
    async def repository_error_handler(request: Request, exc: RepositoryError) -> JSONResponse:
        logger.exception("Repository error request_id=%s", request.state.request_id)
        return JSONResponse(status_code=500, content=_error_payload(request, "storage_error", "Data storage operation failed"))

    app.include_router(auth.router)
    app.include_router(workspaces.router)
    app.include_router(dashboard.router)
    app.include_router(targets.router)
    app.include_router(inventory.assets_router)
    app.include_router(inventory.endpoints_router)
    app.include_router(recon.router)
    app.include_router(recon_real.router)
    app.include_router(combo.router)
    app.include_router(active_scanner.router)
    app.include_router(scanner.router)
    app.include_router(scans.router)
    app.include_router(findings.router)
    app.include_router(ai.router)
    app.include_router(agent.router)
    app.include_router(agent_bridge.router)
    app.include_router(mobile.router)
    app.include_router(reports.router)
    app.include_router(notifications.router)
    app.include_router(settings_api.router)
    app.include_router(admin.router)

    @app.get("/api/health", tags=["system"])
    def health() -> dict[str, object]:
        return {
            "status": "healthy",
            "service": "pan-api",
            "version": "0.1.0",
            "scannerMode": "mock" if settings.scanner_mock_mode else "disabled",
        }

    return app


app = create_app()

