"""
Gateway REST API: AI request proxy, lifecycle traces, request history.
"""

from fastapi import APIRouter, HTTPException, Query, Body
from uuid import UUID

from app.core.supabase import supabase
from app.core.logging import get_logger
from app.gateway.models import ChatRequest, ChatResponse, AIRequestRecord
from app.gateway.lifecycle import process_request, GatewayLifecycle

logger = get_logger(__name__)

router = APIRouter(prefix="/gateway", tags=["Gateway"])


@router.post("/chat/completions", response_model=ChatResponse)
async def gateway_chat(
    body: ChatRequest,
    org_id: str = Body(..., embed=True, description="Organization ID"),
    app_id: str | None = Body(None, embed=True),
    api_key: str | None = Body(None, embed=True),
):
    """Process an AI request through the full 6-stage gateway lifecycle."""
    result = await process_request(body, org_id, app_id, api_key)
    return result


@router.get("/requests", response_model=list[AIRequestRecord])
async def list_requests(
    org_id: UUID | None = None,
    status: str | None = None,
    model: str | None = None,
    limit: int = Query(50, le=500),
    offset: int = 0,
):
    """List AI requests with optional filters."""
    filters: dict = {}
    if org_id:
        filters["org_id"] = str(org_id)
    if status:
        filters["status"] = status
    if model:
        filters["model_id"] = model
    return await supabase.select(
        "ai_requests",
        filters=filters or None,
        limit=limit,
        offset=offset,
        order="created_at.desc",
    )


@router.get("/requests/{request_id}", response_model=AIRequestRecord)
async def get_request(request_id: UUID):
    rows = await supabase.select("ai_requests", filters={"id": str(request_id)})
    if not rows:
        raise HTTPException(404, "Request not found")
    return rows[0]


@router.get("/lifecycle/trace/{request_id}")
async def get_lifecycle_trace(request_id: UUID):
    """Get the full lifecycle trace for a request."""
    rows = await supabase.select("ai_requests", filters={"id": str(request_id)})
    if not rows:
        raise HTTPException(404, "Request not found")

    req = rows[0]
    # Reconstruct lifecycle events from the stored data
    return {
        "request_id": str(request_id),
        "model": req["model_id"],
        "status": req["status"],
        "stage": req["stage"],
        "cache_hit": req["cache_hit"],
        "routing_strategy": req["routing_strategy"],
        "latency_ms": req["latency_ms"],
        "total_cost": req["total_cost"],
        "tokens": {
            "prompt": req["prompt_tokens"],
            "completion": req["completion_tokens"],
            "cached": req["cached_tokens"],
            "total": req["total_tokens"],
        },
        "cost_breakdown": {
            "input": req["input_cost"],
            "output": req["output_cost"],
            "cached": req["cached_cost"],
            "total": req["total_cost"],
        },
        "triggered_policies": req.get("triggered_policies", []),
        "blocked_reason": req.get("blocked_reason"),
        "created_at": req["created_at"],
    }


@router.get("/models")
async def list_available_models():
    """List all available models across all providers with pricing."""
    models = await supabase.select("provider_models", order="display_name.asc")
    providers = await supabase.select("providers")
    provider_map = {p["id"]: p for p in providers}
    result = []
    for m in models:
        p = provider_map.get(m["provider_id"], {})
        result.append({
            **m,
            "provider_name": p.get("name", ""),
            "provider_slug": p.get("slug", ""),
        })
    return result
