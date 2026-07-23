"""
Optimization REST API: cost optimization recommendations and savings tracking.
"""

from fastapi import APIRouter, HTTPException, Query
from uuid import UUID
from pydantic import BaseModel

from app.core.supabase import supabase
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/optimization", tags=["Optimization"])


class RecommendationUpdate(BaseModel):
    status: str  # pending, applied, dismissed


@router.get("/recommendations")
async def list_recommendations(
    org_id: UUID | None = None,
    status: str | None = None,
    limit: int = Query(50, le=200),
):
    """List optimization recommendations."""
    filters: dict = {}
    if org_id:
        filters["org_id"] = str(org_id)
    if status:
        filters["status"] = status
    return await supabase.select(
        "optimization_recommendations",
        filters=filters or None,
        limit=limit,
        order="potential_savings.desc",
    )


@router.patch("/recommendations/{rec_id}")
async def update_recommendation(rec_id: UUID, body: RecommendationUpdate):
    """Update recommendation status (apply/dismiss)."""
    result = await supabase.update(
        "optimization_recommendations",
        {"id": str(rec_id)},
        {"status": body.status},
    )
    if not result:
        raise HTTPException(404, "Recommendation not found")
    return result[0]


@router.get("/savings")
async def get_savings_summary(org_id: UUID | None = None):
    """Summary of potential and realized savings."""
    recs = await supabase.select(
        "optimization_recommendations",
        filters={"org_id": str(org_id)} if org_id else None,
        limit=200,
    )
    pending = [r for r in recs if r["status"] == "pending"]
    applied = [r for r in recs if r["status"] == "applied"]
    dismissed = [r for r in recs if r["status"] == "dismissed"]

    return {
        "potential_savings": round(sum(r["potential_savings"] for r in pending), 2),
        "realized_savings": round(sum(r["potential_savings"] for r in applied), 2),
        "dismissed_savings": round(sum(r["potential_savings"] for r in dismissed), 2),
        "pending_count": len(pending),
        "applied_count": len(applied),
        "dismissed_count": len(dismissed),
        "total_recommendations": len(recs),
    }


@router.post("/generate")
async def generate_recommendations(org_id: str):
    """Analyze usage patterns and generate new optimization recommendations."""
    requests = await supabase.select(
        "ai_requests",
        columns="model_id,total_cost,prompt_tokens,completion_tokens,cache_hit",
        filters={"org_id": org_id},
        limit=10000,
    )

    recommendations: list[dict] = []

    # Analyze model usage for swap opportunities
    by_model: dict[str, dict] = {}
    for r in requests:
        m = r["model_id"]
        if m not in by_model:
            by_model[m] = {"cost": 0, "count": 0, "tokens": 0}
        by_model[m]["cost"] += r["total_cost"]
        by_model[m]["count"] += 1
        by_model[m]["tokens"] += r["prompt_tokens"] + r["completion_tokens"]

    # Check if expensive models are used for potentially simple queries
    if "gpt-4o" in by_model and by_model["gpt-4o"]["count"] > 10:
        gpt4o_cost = by_model["gpt-4o"]["cost"]
        potential = gpt4o_cost * 0.94  # 94% savings by switching to mini
        recommendations.append({
            "org_id": org_id,
            "recommendation_type": "model_swap",
            "title": f"Switch GPT-4o to GPT-4o-mini for low-complexity queries",
            "description": f"GPT-4o accounts for ${gpt4o_cost:.2f} across {by_model['gpt-4o']['count']} requests. Routing low-complexity queries to GPT-4o-mini could save ~94%.",
            "potential_savings": round(potential, 2),
            "confidence_score": 85.0,
            "status": "pending",
            "affected_scope": {"model": "gpt-4o", "target": "gpt-4o-mini"},
        })

    # Check cache utilization
    total = len(requests)
    cached = len([r for r in requests if r["cache_hit"]])
    if total > 0 and cached / total < 0.15:
        uncached_cost = sum(r["total_cost"] for r in requests if not r["cache_hit"])
        potential = uncached_cost * 0.25
        recommendations.append({
            "org_id": org_id,
            "recommendation_type": "cache_enable",
            "title": "Enable semantic caching to reduce redundant API calls",
            "description": f"Cache hit rate is only {cached/total*100:.1f}%. Enabling semantic caching could save ~25% of uncached request costs.",
            "potential_savings": round(potential, 2),
            "confidence_score": 90.0,
            "status": "pending",
            "affected_scope": {"current_cache_rate": f"{cached/total*100:.1f}%"},
        })

    # Insert new recommendations
    inserted = []
    for rec in recommendations:
        result = await supabase.insert("optimization_recommendations", rec)
        if isinstance(result, list) and result:
            inserted.append(result[0])

    return {"generated": len(inserted), "recommendations": inserted}
