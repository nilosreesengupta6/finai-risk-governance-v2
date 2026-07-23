"""
Optimization REST API: automated cost optimization engine with
Azure Advisor-style savings insights, scenario analysis, and tracking.

Recommendation types:
- model_swap: Switch to a cheaper model for low-complexity queries
- cache_enable: Enable semantic caching to reduce redundant API calls
- routing_change: Change routing strategy to optimize cost or latency
- budget_alert: Set up budget alerts for high-spending projects
- usage_consolidation: Consolidate usage across providers for volume discounts
"""

from fastapi import APIRouter, HTTPException, Query
from uuid import UUID
from pydantic import BaseModel
from typing import Any

from app.core.supabase import supabase
from app.core.logging import get_logger
from app.forecasting.engine import get_scenario_analysis

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
    """
    Analyze usage patterns and generate Azure Advisor-style optimization
    recommendations. Examines model usage, cache utilization, routing
    efficiency, and budget utilization.
    """
    requests = await supabase.select(
        "ai_requests",
        columns="model_id,total_cost,prompt_tokens,completion_tokens,cache_hit,latency_ms,app_id,project_id,routing_strategy",
        filters={"org_id": org_id},
        limit=10000,
    )
    models = await supabase.select("provider_models", order="display_name.asc")
    apps = await supabase.select("applications", filters={"org_id": org_id})
    app_map = {a["id"]: a["name"] for a in apps}
    budgets = await supabase.select("budgets", filters={"org_id": org_id}, limit=50)

    recommendations: list[dict] = []

    # Aggregate by model
    by_model: dict[str, dict] = {}
    for r in requests:
        m = r["model_id"]
        if m not in by_model:
            by_model[m] = {"cost": 0, "count": 0, "tokens": 0, "latency_sum": 0}
        by_model[m]["cost"] += r["total_cost"]
        by_model[m]["count"] += 1
        by_model[m]["tokens"] += r["prompt_tokens"] + r["completion_tokens"]
        by_model[m]["latency_sum"] += r["latency_ms"]

    # 1. Model swap recommendations (Azure Advisor-style)
    model_pricing = {m["model_id"]: m for m in models}
    premium_models = {"gpt-4o", "gpt-4-turbo", "o1", "o1-mini", "claude-3-opus-20240229", "gemini-1.5-pro"}

    for model_id, stats in by_model.items():
        if model_id in premium_models and stats["count"] > 5:
            # Find a cheaper alternative
            cheaper = None
            if model_id == "gpt-4o":
                cheaper = "gpt-4o-mini"
            elif model_id == "gpt-4-turbo":
                cheaper = "gpt-4o-mini"
            elif model_id == "o1" or model_id == "o1-mini":
                cheaper = "gpt-4o-mini"
            elif model_id == "claude-3-opus-20240229":
                cheaper = "claude-3-5-haiku-20241022"
            elif model_id == "gemini-1.5-pro":
                cheaper = "gemini-2.0-flash"

            if cheaper and cheaper in model_pricing:
                from_price = float(model_pricing[model_id]["input_price_per_1k"])
                to_price = float(model_pricing[cheaper]["input_price_per_1k"])
                savings_pct = ((from_price - to_price) / from_price * 100) if from_price > 0 else 0
                monthly_savings = stats["cost"] * (savings_pct / 100)

                recommendations.append({
                    "org_id": org_id,
                    "recommendation_type": "model_swap",
                    "title": f"Switch {model_id} → {cheaper} for low-complexity queries",
                    "description": (
                        f"{model_id} accounts for ${stats['cost']:.2f} across {stats['count']} requests. "
                        f"Routing low-complexity queries to {cheaper} could save ~{savings_pct:.0f}% "
                        f"(${monthly_savings:.2f}/month). "
                        f"Input price: ${from_price:.6f} → ${to_price:.6f} per 1K tokens."
                    ),
                    "potential_savings": round(monthly_savings, 2),
                    "confidence_score": 85.0,
                    "status": "pending",
                    "affected_scope": {"model": model_id, "target": cheaper, "requests": stats["count"]},
                })

    # 2. Cache enablement recommendations
    total = len(requests)
    cached = len([r for r in requests if r["cache_hit"]])
    if total > 0 and cached / total < 0.20:
        uncached_cost = sum(r["total_cost"] for r in requests if not r["cache_hit"])
        potential = uncached_cost * 0.25
        recommendations.append({
            "org_id": org_id,
            "recommendation_type": "cache_enable",
            "title": "Enable semantic caching to reduce redundant API calls",
            "description": (
                f"Cache hit rate is only {cached/total*100:.1f}%. "
                f"Enabling semantic caching could save ~25% of uncached request costs "
                f"(${potential:.2f}/month). Target: increase cache hit rate to 30%+."
            ),
            "potential_savings": round(potential, 2),
            "confidence_score": 92.0,
            "status": "pending",
            "affected_scope": {"current_cache_rate": f"{cached/total*100:.1f}%", "target_cache_rate": "30%"},
        })

    # 3. Routing strategy recommendations
    by_strategy: dict[str, dict] = {}
    for r in requests:
        s = r.get("routing_strategy", "unknown")
        if s not in by_strategy:
            by_strategy[s] = {"cost": 0, "count": 0, "latency_sum": 0}
        by_strategy[s]["cost"] += r["total_cost"]
        by_strategy[s]["count"] += 1
        by_strategy[s]["latency_sum"] += r["latency_ms"]

    # If quality_first is expensive and latency_first is cheap, suggest switching
    if "quality_first" in by_strategy and "cost_first" in by_strategy:
        q_cost = by_strategy["quality_first"]["cost"]
        c_cost = by_strategy["cost_first"]["cost"]
        q_count = by_strategy["quality_first"]["count"]
        if q_count > 10 and q_cost > c_cost * 2:
            potential = q_cost * 0.3
            recommendations.append({
                "org_id": org_id,
                "recommendation_type": "routing_change",
                "title": "Shift quality_first routing to cost_first for non-critical requests",
                "description": (
                    f"Quality-first routing costs ${q_cost:.2f} across {q_count} requests, "
                    f"significantly more than cost-first (${c_cost:.2f}). "
                    f"Switching non-critical requests to cost-first could save ${potential:.2f}/month."
                ),
                "potential_savings": round(potential, 2),
                "confidence_score": 75.0,
                "status": "pending",
                "affected_scope": {"from_strategy": "quality_first", "to_strategy": "cost_first"},
            })

    # 4. Budget alert recommendations
    for b in budgets:
        if b["utilization_pct"] > 80 and b["status"] != "exceeded":
            recommendations.append({
                "org_id": org_id,
                "recommendation_type": "budget_alert",
                "title": f"Budget warning: {b.get('project_name', 'project')} at {b['utilization_pct']:.0f}% utilization",
                "description": (
                    f"Budget for this project is at ${b['actual_spend']:.2f} of ${b['budget_limit']:.2f} "
                    f"({b['utilization_pct']:.0f}%). Projected to reach ${b['forecast_spend']:.2f} by month-end. "
                    f"Consider increasing the budget or implementing stricter policies."
                ),
                "potential_savings": 0,
                "confidence_score": 95.0,
                "status": "pending",
                "affected_scope": {"budget_id": b["id"], "utilization": b["utilization_pct"]},
            })

    # 5. Usage consolidation recommendations
    # Check if there's spend spread across many providers that could be consolidated
    by_provider: dict[str, float] = {}
    for r in requests:
        pid = str(r.get("provider_id", "unknown"))
        by_provider[pid] = by_provider.get(pid, 0) + r["total_cost"]

    if len(by_provider) > 3:
        total_spend = sum(by_provider.values())
        top_provider = max(by_provider, key=by_provider.get)
        top_pct = (by_provider[top_provider] / total_spend * 100) if total_spend > 0 else 0
        if top_pct < 50:
            potential = total_spend * 0.05  # 5% volume discount
            recommendations.append({
                "org_id": org_id,
                "recommendation_type": "usage_consolidation",
                "title": "Consolidate provider usage for volume discounts",
                "description": (
                    f"Your spend is spread across {len(by_provider)} providers. "
                    f"Consolidating to your top provider could unlock volume discounts "
                    f"and simplify governance (~5% savings = ${potential:.2f}/month)."
                ),
                "potential_savings": round(potential, 2),
                "confidence_score": 60.0,
                "status": "pending",
                "affected_scope": {"provider_count": len(by_provider), "top_provider_share": f"{top_pct:.0f}%"},
            })

    # Insert new recommendations (avoid duplicates by checking existing titles)
    existing = await supabase.select(
        "optimization_recommendations",
        filters={"org_id": org_id},
        limit=500,
    )
    existing_titles = {r["title"] for r in existing}

    inserted = []
    for rec in recommendations:
        if rec["title"] not in existing_titles:
            result = await supabase.insert("optimization_recommendations", rec)
            if isinstance(result, list) and result:
                inserted.append(result[0])

    return {
        "generated": len(inserted),
        "total_analyzed": len(recommendations),
        "recommendations": inserted,
        "summary": {
            "total_potential_savings": round(sum(r["potential_savings"] for r in inserted), 2),
            "by_type": _group_by_type(inserted),
        },
    }


@router.post("/scenario")
async def simulate_scenario(org_id: str, from_model: str, to_model: str):
    """Simulate savings from switching models. Delegates to the forecasting engine."""
    return await get_scenario_analysis(org_id, from_model, to_model)


def _group_by_type(recs: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for r in recs:
        t = r["recommendation_type"]
        counts[t] = counts.get(t, 0) + 1
    return counts
