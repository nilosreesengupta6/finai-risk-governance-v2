"""
AI Copilot REST API: conversational interface for cost intelligence queries.
The copilot answers questions about costs, usage, and optimization opportunities
by querying the analytics data and generating natural language insights.
"""

from fastapi import APIRouter, Body
from pydantic import BaseModel, Field
from typing import Any
from uuid import UUID

from app.core.supabase import supabase
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/copilot", tags=["AI Copilot"])


class CopilotQuery(BaseModel):
    query: str
    org_id: str
    context: dict[str, Any] = Field(default_factory=dict)


class CopilotResponse(BaseModel):
    answer: str
    data: dict[str, Any] = Field(default_factory=dict)
    suggested_actions: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)


@router.post("/query", response_model=CopilotResponse)
async def copilot_query(body: CopilotQuery):
    """Answer a natural language question about AI costs and usage."""
    query_lower = body.query.lower()

    # Gather context data
    kpis = await _get_kpis(body.org_id)
    cost_by_model = await _get_cost_by_model(body.org_id)
    cost_by_provider = await _get_cost_by_provider(body.org_id)

    # Pattern-match the query to determine intent
    if any(w in query_lower for w in ["cost", "spend", "spending", "expense", "budget"]):
        answer = (
            f"Your total AI spend is ${kpis['total_cost']:.2f} across {kpis['total_requests']} requests. "
            f"The average cost per request is ${kpis['cost_per_request']:.4f}. "
        )
        if cost_by_model:
            top_model = cost_by_model[0]
            answer += f"Your highest-cost model is {top_model['model']} at ${top_model['cost']:.2f}. "
        if cost_by_provider:
            top_provider = cost_by_provider[0]
            answer += f"Your highest-cost provider is {top_provider['provider']} at ${top_provider['cost']:.2f}. "

        suggested = [
            "Review the Cost Explorer for detailed breakdowns",
            "Check optimization recommendations for potential savings",
            "Set up budget alerts for your top-spending projects",
        ]
        return CopilotResponse(
            answer=answer,
            data={"kpis": kpis, "cost_by_model": cost_by_model[:5], "cost_by_provider": cost_by_provider[:5]},
            suggested_actions=suggested,
            sources=["analytics/kpis", "analytics/cost-by-model", "analytics/cost-by-provider"],
        )

    elif any(w in query_lower for w in ["latency", "speed", "slow", "fast", "performance"]):
        answer = (
            f"Your average request latency is {kpis['avg_latency_ms']:.0f}ms. "
            f"The cache hit rate is {kpis['cache_hit_rate']:.1f}%, which "
            f"{'is excellent' if kpis['cache_hit_rate'] > 20 else 'could be improved'}. "
        )
        suggested = [
            "Enable semantic caching for repeat queries",
            "Consider routing to faster models for low-complexity requests",
            "Review the latency distribution in analytics",
        ]
        return CopilotResponse(
            answer=answer,
            data={"kpis": kpis},
            suggested_actions=suggested,
            sources=["analytics/kpis", "analytics/latency-distribution"],
        )

    elif any(w in query_lower for w in ["token", "usage", "volume", "consumption"]):
        answer = (
            f"Your total token usage is {kpis['total_tokens']:,} tokens across {kpis['total_requests']} requests. "
            f"Average tokens per request: {kpis['tokens_per_request']:.0f}. "
        )
        suggested = [
            "Review token usage trends in the dashboard",
            "Consider prompt optimization to reduce token consumption",
            "Check which models consume the most tokens",
        ]
        return CopilotResponse(
            answer=answer,
            data={"kpis": kpis, "cost_by_model": cost_by_model[:5]},
            suggested_actions=suggested,
            sources=["analytics/kpis", "analytics/token-usage"],
        )

    elif any(w in query_lower for w in ["optim", "save", "saving", "reduce", "cheap"]):
        recs = await supabase.select(
            "optimization_recommendations",
            filters={"org_id": body.org_id, "status": "pending"},
            order="potential_savings.desc",
        )
        total_savings = sum(r["potential_savings"] for r in recs)
        answer = f"I found {len(recs)} optimization opportunities with a total potential savings of ${total_savings:.2f}/month. "
        if recs:
            top = recs[0]
            answer += f"Top recommendation: {top['title']} — potential savings of ${top['potential_savings']:.2f}/month with {top['confidence_score']:.0f}% confidence."
        suggested = [f"Apply: {r['title']}" for r in recs[:3]]
        return CopilotResponse(
            answer=answer,
            data={"recommendations": recs, "total_potential_savings": total_savings},
            suggested_actions=suggested,
            sources=["optimization/recommendations"],
        )

    elif any(w in query_lower for w in ["provider", "model", "routing", "failover"]):
        providers = await supabase.select("providers", order="priority.asc")
        answer = f"You have {len(providers)} providers configured. "
        for p in providers:
            answer += f"{p['name']} is {p['status']} with priority {p['priority']}. "
        suggested = [
            "Review the Provider Gateway page for live status",
            "Check failover priority matrix",
            "Compare model pricing across providers",
        ]
        return CopilotResponse(
            answer=answer,
            data={"providers": providers},
            suggested_actions=suggested,
            sources=["control-plane/providers"],
        )

    else:
        answer = (
            f"I can help you analyze AI costs, usage, latency, providers, and optimization opportunities. "
            f"Your current stats: ${kpis['total_cost']:.2f} total spend, {kpis['total_requests']} requests, "
            f"{kpis['avg_latency_ms']:.0f}ms avg latency, {kpis['cache_hit_rate']:.1f}% cache hit rate. "
            f"Try asking about cost trends, token usage, or optimization recommendations."
        )
        return CopilotResponse(
            answer=answer,
            data={"kpis": kpis},
            suggested_actions=[
                "Ask about cost breakdowns by model or provider",
                "Ask about optimization opportunities",
                "Ask about latency performance",
            ],
            sources=["analytics/kpis"],
        )


async def _get_kpis(org_id: str) -> dict:
    requests = await supabase.select(
        "ai_requests",
        columns="total_cost,total_tokens,latency_ms,cache_hit,status",
        filters={"org_id": org_id},
        limit=10000,
    )
    total_cost = sum(r["total_cost"] for r in requests)
    total_requests = len(requests)
    avg_latency = sum(r["latency_ms"] for r in requests) / total_requests if total_requests else 0
    cached = len([r for r in requests if r["cache_hit"]])
    total_tokens = sum(r["total_tokens"] for r in requests)
    return {
        "total_cost": round(total_cost, 2),
        "total_requests": total_requests,
        "avg_latency_ms": round(avg_latency, 1),
        "cache_hit_rate": round(cached / total_requests * 100, 1) if total_requests else 0,
        "total_tokens": total_tokens,
        "cost_per_request": round(total_cost / total_requests, 6) if total_requests else 0,
        "tokens_per_request": round(total_tokens / total_requests) if total_requests else 0,
    }


async def _get_cost_by_model(org_id: str) -> list[dict]:
    requests = await supabase.select(
        "ai_requests",
        columns="model_id,total_cost",
        filters={"org_id": org_id},
        limit=10000,
    )
    by_model: dict[str, dict] = {}
    for r in requests:
        m = r["model_id"]
        if m not in by_model:
            by_model[m] = {"model": m, "cost": 0, "requests": 0}
        by_model[m]["cost"] += r["total_cost"]
        by_model[m]["requests"] += 1
    return sorted(by_model.values(), key=lambda x: x["cost"], reverse=True)


async def _get_cost_by_provider(org_id: str) -> list[dict]:
    requests = await supabase.select(
        "ai_requests",
        columns="provider_id,total_cost",
        filters={"org_id": org_id},
        limit=10000,
    )
    providers = await supabase.select("providers")
    pmap = {p["id"]: p["name"] for p in providers}
    by_p: dict[str, dict] = {}
    for r in requests:
        pid = str(r["provider_id"]) if r["provider_id"] else "unknown"
        name = pmap.get(pid, "Unknown")
        if pid not in by_p:
            by_p[pid] = {"provider": name, "cost": 0, "requests": 0}
        by_p[pid]["cost"] += r["total_cost"]
        by_p[pid]["requests"] += 1
    return sorted(by_p.values(), key=lambda x: x["cost"], reverse=True)
