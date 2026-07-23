"""
Analytics REST API: Executive KPIs, cost trends, provider comparison,
token usage breakdowns, and cost-by-dimension analysis.
"""

from fastapi import APIRouter, Query
from uuid import UUID
from datetime import datetime, timedelta, timezone

from app.core.supabase import supabase
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/kpis")
async def get_executive_kpis(org_id: UUID | None = None):
    """Executive dashboard KPIs: total cost, requests, avg latency, cache hit rate, etc."""
    filters = {"org_id": str(org_id)} if org_id else None
    requests = await supabase.select(
        "ai_requests",
        columns="total_cost,total_tokens,latency_ms,cache_hit,status,prompt_tokens,completion_tokens",
        filters=filters,
        limit=10000,
    )

    total_cost = sum(r["total_cost"] for r in requests)
    total_requests = len(requests)
    successful = [r for r in requests if r["status"] in ("success", "cached")]
    blocked = [r for r in requests if r["status"] == "blocked"]
    failed = [r for r in requests if r["status"] == "failed"]
    cached = [r for r in requests if r["cache_hit"]]
    avg_latency = sum(r["latency_ms"] for r in requests) / total_requests if total_requests else 0
    total_tokens = sum(r["total_tokens"] for r in requests)
    cache_hit_rate = (len(cached) / total_requests * 100) if total_requests else 0

    return {
        "total_cost": round(total_cost, 2),
        "total_requests": total_requests,
        "successful_requests": len(successful),
        "blocked_requests": len(blocked),
        "failed_requests": len(failed),
        "cached_requests": len(cached),
        "cache_hit_rate": round(cache_hit_rate, 1),
        "avg_latency_ms": round(avg_latency, 1),
        "total_tokens": total_tokens,
        "cost_per_request": round(total_cost / total_requests, 6) if total_requests else 0,
        "tokens_per_request": round(total_tokens / total_requests) if total_requests else 0,
    }


@router.get("/cost-trend")
async def get_cost_trend(org_id: UUID | None = None, days: int = Query(30, le=90)):
    """Daily cost trend for the last N days."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    requests = await supabase.select(
        "ai_requests",
        columns="total_cost,created_at,status",
        filters={"org_id": str(org_id)} if org_id else None,
        limit=10000,
    )

    # Group by date
    daily: dict[str, dict] = {}
    for r in requests:
        date = r["created_at"][:10]
        if date not in daily:
            daily[date] = {"date": date, "cost": 0, "requests": 0}
        daily[date]["cost"] += r["total_cost"]
        daily[date]["requests"] += 1

    result = sorted(daily.values(), key=lambda x: x["date"])
    for d in result:
        d["cost"] = round(d["cost"], 4)
    return result


@router.get("/cost-by-model")
async def get_cost_by_model(org_id: UUID | None = None):
    """Cost breakdown by model."""
    requests = await supabase.select(
        "ai_requests",
        columns="model_id,total_cost,total_tokens",
        filters={"org_id": str(org_id)} if org_id else None,
        limit=10000,
    )

    by_model: dict[str, dict] = {}
    for r in requests:
        model = r["model_id"]
        if model not in by_model:
            by_model[model] = {"model": model, "cost": 0, "tokens": 0, "requests": 0}
        by_model[model]["cost"] += r["total_cost"]
        by_model[model]["tokens"] += r["total_tokens"]
        by_model[model]["requests"] += 1

    result = sorted(by_model.values(), key=lambda x: x["cost"], reverse=True)
    for m in result:
        m["cost"] = round(m["cost"], 4)
    return result


@router.get("/cost-by-provider")
async def get_cost_by_provider(org_id: UUID | None = None):
    """Cost breakdown by provider."""
    requests = await supabase.select(
        "ai_requests",
        columns="provider_id,total_cost",
        filters={"org_id": str(org_id)} if org_id else None,
        limit=10000,
    )
    providers = await supabase.select("providers")
    provider_map = {p["id"]: p["name"] for p in providers}

    by_provider: dict[str, dict] = {}
    for r in requests:
        pid = str(r["provider_id"]) if r["provider_id"] else "unknown"
        name = provider_map.get(pid, "Unknown")
        if pid not in by_provider:
            by_provider[pid] = {"provider_id": pid, "provider": name, "cost": 0, "requests": 0}
        by_provider[pid]["cost"] += r["total_cost"]
        by_provider[pid]["requests"] += 1

    result = sorted(by_provider.values(), key=lambda x: x["cost"], reverse=True)
    for p in result:
        p["cost"] = round(p["cost"], 4)
    return result


@router.get("/token-usage")
async def get_token_usage(org_id: UUID | None = None, days: int = Query(30, le=90)):
    """Token usage breakdown over time."""
    requests = await supabase.select(
        "ai_requests",
        columns="prompt_tokens,completion_tokens,cached_tokens,created_at,model_id",
        filters={"org_id": str(org_id)} if org_id else None,
        limit=10000,
    )

    daily: dict[str, dict] = {}
    for r in requests:
        date = r["created_at"][:10]
        if date not in daily:
            daily[date] = {"date": date, "prompt": 0, "completion": 0, "cached": 0}
        daily[date]["prompt"] += r["prompt_tokens"]
        daily[date]["completion"] += r["completion_tokens"]
        daily[date]["cached"] += r["cached_tokens"]

    return sorted(daily.values(), key=lambda x: x["date"])


@router.get("/latency-distribution")
async def get_latency_distribution(org_id: UUID | None = None):
    """Latency distribution histogram."""
    requests = await supabase.select(
        "ai_requests",
        columns="latency_ms,model_id",
        filters={"org_id": str(org_id)} if org_id else None,
        limit=10000,
    )

    buckets = {"0-100": 0, "100-300": 0, "300-500": 0, "500-1000": 0, "1000-2000": 0, "2000+": 0}
    for r in requests:
        ms = r["latency_ms"]
        if ms < 100:
            buckets["0-100"] += 1
        elif ms < 300:
            buckets["100-300"] += 1
        elif ms < 500:
            buckets["300-500"] += 1
        elif ms < 1000:
            buckets["500-1000"] += 1
        elif ms < 2000:
            buckets["1000-2000"] += 1
        else:
            buckets["2000+"] += 1

    return [{"range": k, "count": v} for k, v in buckets.items()]
