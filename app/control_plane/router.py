"""
Control Plane REST API: Organizations, Business Units, Departments, Projects,
Applications, API Keys, and the Multi-Provider Catalog.
"""

from fastapi import APIRouter, HTTPException, Query
from uuid import UUID

from app.core.supabase import supabase
from app.core.logging import get_logger
from app.control_plane.models import (
    OrganizationCreate, Organization,
    BusinessUnitCreate, BusinessUnit,
    DepartmentCreate, Department,
    ProjectCreate, Project,
    ApplicationCreate, Application,
    APIKeyCreate, APIKey,
    ProviderCreate, Provider,
    ProviderModelCreate, ProviderModel,
    ProviderStatus,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/control-plane", tags=["Control Plane"])


# ─── Organizations ──────────────────────────────────────────────

@router.get("/organizations", response_model=list[Organization])
async def list_organizations(limit: int = Query(100, le=500)):
    return await supabase.select("organizations", limit=limit, order="created_at.desc")


@router.post("/organizations", response_model=Organization, status_code=201)
async def create_organization(body: OrganizationCreate):
    result = await supabase.insert("organizations", body.model_dump())
    if isinstance(result, list) and result:
        return result[0]
    return result


@router.get("/organizations/{org_id}", response_model=Organization)
async def get_organization(org_id: UUID):
    rows = await supabase.select("organizations", filters={"id": str(org_id)})
    if not rows:
        raise HTTPException(404, "Organization not found")
    return rows[0]


# ─── Business Units ──────────────────────────────────────────────

@router.get("/business-units", response_model=list[BusinessUnit])
async def list_business_units(org_id: UUID | None = None, limit: int = Query(100, le=500)):
    filters = {"org_id": str(org_id)} if org_id else None
    return await supabase.select("business_units", filters=filters, limit=limit, order="created_at.desc")


@router.post("/business-units", response_model=BusinessUnit, status_code=201)
async def create_business_unit(body: BusinessUnitCreate):
    result = await supabase.insert("business_units", body.model_dump())
    if isinstance(result, list) and result:
        return result[0]
    return result


# ─── Departments ──────────────────────────────────────────────────

@router.get("/departments", response_model=list[Department])
async def list_departments(org_id: UUID | None = None, limit: int = Query(100, le=500)):
    filters = {"org_id": str(org_id)} if org_id else None
    return await supabase.select("departments", filters=filters, limit=limit, order="created_at.desc")


@router.post("/departments", response_model=Department, status_code=201)
async def create_department(body: DepartmentCreate):
    result = await supabase.insert("departments", body.model_dump())
    if isinstance(result, list) and result:
        return result[0]
    return result


# ─── Projects ─────────────────────────────────────────────────────

@router.get("/projects", response_model=list[Project])
async def list_projects(org_id: UUID | None = None, limit: int = Query(100, le=500)):
    filters = {"org_id": str(org_id)} if org_id else None
    return await supabase.select("projects", filters=filters, limit=limit, order="created_at.desc")


@router.post("/projects", response_model=Project, status_code=201)
async def create_project(body: ProjectCreate):
    result = await supabase.insert("projects", body.model_dump())
    if isinstance(result, list) and result:
        return result[0]
    return result


# ─── Applications ─────────────────────────────────────────────────

@router.get("/applications", response_model=list[Application])
async def list_applications(org_id: UUID | None = None, limit: int = Query(100, le=500)):
    filters = {"org_id": str(org_id)} if org_id else None
    return await supabase.select("applications", filters=filters, limit=limit, order="created_at.desc")


@router.post("/applications", response_model=Application, status_code=201)
async def create_application(body: ApplicationCreate):
    result = await supabase.insert("applications", body.model_dump())
    if isinstance(result, list) and result:
        return result[0]
    return result


# ─── API Keys ─────────────────────────────────────────────────────

@router.get("/api-keys", response_model=list[APIKey])
async def list_api_keys(org_id: UUID | None = None, limit: int = Query(100, le=500)):
    filters = {"org_id": str(org_id)} if org_id else None
    return await supabase.select("api_keys", filters=filters, limit=limit, order="created_at.desc")


@router.post("/api-keys", response_model=dict, status_code=201)
async def create_api_key(body: APIKeyCreate):
    import hashlib
    import secrets

    raw_key = f"acig_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:12]

    data = {
        "org_id": str(body.org_id),
        "app_id": str(body.app_id),
        "key_hash": key_hash,
        "key_prefix": key_prefix,
        "name": body.name,
        "scopes": body.scopes,
        "status": "active",
    }
    result = await supabase.insert("api_keys", data)
    if isinstance(result, list) and result:
        return {"key": raw_key, "id": result[0]["id"], "prefix": key_prefix}
    return {"key": raw_key, "prefix": key_prefix}


# ─── Multi-Provider Catalog ────────────────────────────────────────

@router.get("/providers", response_model=list[Provider])
async def list_providers():
    return await supabase.select("providers", order="priority.asc")


@router.post("/providers", response_model=Provider, status_code=201)
async def create_provider(body: ProviderCreate):
    result = await supabase.insert("providers", body.model_dump())
    if isinstance(result, list) and result:
        return result[0]
    return result


@router.get("/providers/{provider_id}/models", response_model=list[ProviderModel])
async def list_provider_models(provider_id: UUID):
    return await supabase.select("provider_models", filters={"provider_id": str(provider_id)}, order="display_name.asc")


@router.post("/provider-models", response_model=ProviderModel, status_code=201)
async def create_provider_model(body: ProviderModelCreate):
    result = await supabase.insert("provider_models", body.model_dump())
    if isinstance(result, list) and result:
        return result[0]
    return result


@router.get("/providers/status", response_model=list[ProviderStatus])
async def get_provider_status():
    """Live provider status with latency, model count, and failover rank."""
    providers = await supabase.select("providers", order="priority.asc")
    statuses: list[dict] = []
    for i, p in enumerate(providers):
        models = await supabase.select("provider_models", filters={"provider_id": p["id"]})
        # Get average latency from recent requests
        recent = await supabase.select(
            "ai_requests",
            columns="latency_ms",
            filters={"provider_id": p["id"]},
            limit=50,
            order="created_at.desc",
        )
        avg_latency = sum(r["latency_ms"] for r in recent) / len(recent) if recent else 0
        statuses.append({
            "id": p["id"],
            "name": p["name"],
            "slug": p["slug"],
            "status": p["status"],
            "priority": p["priority"],
            "model_count": len(models),
            "avg_latency_ms": round(avg_latency, 1),
            "failover_rank": i + 1,
            "active_requests": 0,
        })
    return statuses
