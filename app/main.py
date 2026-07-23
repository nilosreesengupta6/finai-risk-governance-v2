"""
FastAPI application entry point for the Enterprise AI Cost Intelligence & Governance Platform.

Modular domain routers:
- core/health: Health check
- control_plane: Organizations, providers, API keys
- gateway: AI request lifecycle proxy
- analytics: Cost intelligence KPIs and trends
- governance: Policy engine and evaluations
- audit: Immutable cost ledger
- copilot: AI cost intelligence assistant
- optimization: Cost optimization recommendations
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.core.middleware import RequestIDMiddleware, get_cors_middleware_kwargs
from app.core.health import router as health_router
from app.control_plane.router import router as control_plane_router
from app.gateway.router import router as gateway_router
from app.analytics.router import router as analytics_router
from app.governance.router import router as governance_router
from app.audit.router import router as audit_router
from app.copilot.router import router as copilot_router
from app.optimization.router import router as optimization_router
from app.forecasting.router import router as forecasting_router

configure_logging(settings.debug)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup", service=settings.app_name, version=settings.app_version)
    yield
    logger.info("shutdown", service=settings.app_name)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Enterprise AI Cost Intelligence & Governance Platform — "
                "LiteLLM-style gateway with 6-stage request lifecycle, "
                "multi-provider routing, token accounting, cost ledger, "
                "policy enforcement, and optimization recommendations.",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(RequestIDMiddleware)
app.add_middleware(CORSMiddleware, **get_cors_middleware_kwargs())

# Routers
app.include_router(health_router, tags=["Health"])
app.include_router(control_plane_router, prefix=settings.api_prefix)
app.include_router(gateway_router, prefix=settings.api_prefix)
app.include_router(analytics_router, prefix=settings.api_prefix)
app.include_router(governance_router, prefix=settings.api_prefix)
app.include_router(audit_router, prefix=settings.api_prefix)
app.include_router(copilot_router, prefix=settings.api_prefix)
app.include_router(optimization_router, prefix=settings.api_prefix)
app.include_router(forecasting_router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/health",
    }
