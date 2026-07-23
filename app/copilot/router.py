"""
AI Copilot REST API: actionable enterprise FinOps assistant.

Supports natural-language queries for cost analysis, top expensive agents,
savings simulation, forecasting, and can execute recommended actions
(apply optimization, create policy, generate forecast).
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body
from pydantic import BaseModel, Field

from app.core.supabase import supabase
from app.core.logging import get_logger
from app.forecasting.engine import generate_forecast, get_scenario_analysis

logger = get_logger(__name__)

router = APIRouter(prefix="/copilot", tags=["AI Copilot"])


class CopilotQuery(BaseModel):
    query: str
    org_id: str
    context: dict[str, Any] = Field(default_factory=dict)


class CopilotAction(BaseModel):
    action_type: str  # apply_recommendation, simulate_savings, generate_forecast, create_policy
    org_id: str
    params: dict[str, Any] = Field(default_factory=dict)


class CopilotResponse(BaseModel):
    answer: str
    data: dict[str, Any] = Field(default_factory=dict)
    suggested_actions: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    actionable: bool = False


@router.post("/query", response_model=CopilotResponse)
async def copilot_query(body: CopilotQuery):
    """Answer a natural language FinOps question about AI costs and usage."""
    query_lower = body.query.lower()
    kpis = await _get_kpis(body.org_id)
    cost_by_model = await _get_cost_by_model(body.org_id)
    cost_by_provider = await _get_cost_by_provider(body.org_id)
    cost_by_agent = await _get_cost_by_agent(body.org_id)

    # ─── Top expensive agents ──────────────────────────────
    if any(w in query_lower for w in ["top", "expensive", "costliest", "biggest spender", "most expensive"]) and any(w in query_lower for w in ["agent", "app", "application"]):
        top = cost_by_agent[:10]
        lines = [f"{i+1}. {a['agent']} — ${a['cost']:.2f} across {a['requests']} requests" for i, a in enumerate(top)]
        answer = f"Here are your top {len(top)} most expensive AI agents:\n\n" + "\n".join(lines)
        return CopilotResponse(
            answer=answer,
            data={"top_agents": top},
            suggested_actions=["Show me how to reduce costs for the top agent", "Simulate savings from switching models"],
            sources=["ai_requests", "applications"],
            actionable=True,
        )

    # ─── Simulate savings / model switch ───────────────────
    if any(w in query_lower for w in ["simulat", "switch", "swap model", "what if", "replace"]):
        # Try to detect model names in the query
        models = await supabase.select("provider_models", order="display_name.asc")
        model_ids = [m["model_id"] for m in models]
        found_from = None
        found_to = None
        for mid in model_ids:
            if mid in body.query.lower():
                if not found_from:
                    found_from = mid
                elif not found_to:
                    found_to = mid

        if found_from and found_to:
            scenario = await get_scenario_analysis(body.org_id, found_from, found_to)
            if "error" not in scenario:
                answer = (
                    f"Simulating switch from {found_from} to {found_to}:\n\n"
                    f"• Current spend on {found_from}: ${scenario['actual_spend']:.2f}\n"
                    f"• Projected spend on {found_to}: ${scenario['simulated_spend']:.2f}\n"
                    f"• Total savings: ${scenario['total_savings']:.2f} ({scenario['savings_percentage']}%)\n"
                    f"• Projected monthly savings: ${scenario['projected_monthly_savings']:.2f}\n\n"
                    f"Quality note: {scenario['quality_note']}"
                )
                return CopilotResponse(
                    answer=answer,
                    data={"scenario": scenario},
                    suggested_actions=[f"Apply this model switch", "Show me other optimization opportunities"],
                    sources=["ai_requests", "provider_models"],
                    actionable=True,
                )

        # Generic simulation prompt
        top_models = cost_by_model[:5]
        answer = (
            "I can simulate savings from switching models. "
            "For example, ask me: 'Simulate switching from gpt-4o to gpt-4o-mini'\n\n"
            "Your top models by cost:\n"
            + "\n".join(f"• {m['model']} — ${m['cost']:.2f}" for m in top_models)
        )
        return CopilotResponse(
            answer=answer,
            data={"top_models": top_models},
            suggested_actions=[
                "Simulate switching from gpt-4o to gpt-4o-mini",
                "Simulate switching from gemini-1.5-pro to gemini-2.0-flash",
            ],
            sources=["ai_requests", "provider_models"],
            actionable=True,
        )

    # ─── Forecast / projection ─────────────────────────────
    if any(w in query_lower for w in ["forecast", "project", "predict", "future cost", "next month", "next quarter", "next week"]):
        period = "monthly"
        if "week" in query_lower:
            period = "weekly"
        elif "quarter" in query_lower:
            period = "quarterly"

        forecast = await generate_forecast(body.org_id, period)
        if "error" in forecast:
            answer = f"I couldn't generate a forecast: {forecast['error']}"
            return CopilotResponse(answer=answer, data={}, sources=["ai_requests"])

        meta = forecast.get("model_metadata", {})
        answer = (
            f"Here's your {period} cost forecast:\n\n"
            f"• Best case: ${forecast['best_case']:.2f}\n"
            f"• Expected: ${forecast['expected_case']:.2f}\n"
            f"• Worst case: ${forecast['worst_case']:.2f}\n"
            f"• Confidence: {forecast['confidence_score']:.1f}%\n"
            f"• Trend: {meta.get('trend', 'unknown')}\n"
            f"• Based on {meta.get('training_points', 0)} days of data (R²={meta.get('r_squared', 0):.2f})\n\n"
            f"95% confidence interval: ${forecast['confidence_interval_low']:.2f} – ${forecast['confidence_interval_high']:.2f}"
        )
        return CopilotResponse(
            answer=answer,
            data={"forecast": forecast},
            suggested_actions=["Generate a quarterly forecast", "Show me how to reduce the projected spend"],
            sources=["ai_requests", "cost_forecasts"],
            actionable=True,
        )

    # ─── Budget / utilization ─────────────────────────────
    if any(w in query_lower for w in ["budget", "utilization", "utilise", "spending limit", "over budget"]):
        budgets = await supabase.select("budgets", filters={"org_id": body.org_id}, limit=50)
        projects = await supabase.select("projects")
        proj_map = {p["id"]: p for p in projects}

        lines = []
        for b in budgets:
            p = proj_map.get(b.get("project_id"))
            name = p["name"] if p else "Org-wide"
            pct = b["utilization_pct"]
            status = b["status"]
            lines.append(f"• {name}: ${b['actual_spend']:.2f} / ${b['budget_limit']:.2f} ({pct:.0f}% — {status})")

        answer = "Here's your budget utilization:\n\n" + "\n".join(lines) if lines else "No budgets configured yet."
        return CopilotResponse(
            answer=answer,
            data={"budgets": budgets},
            suggested_actions=["Set up a new budget alert", "Show me how to reduce spending"],
            sources=["budgets", "projects"],
            actionable=True,
        )

    # ─── Cost / spend ──────────────────────────────────────
    if any(w in query_lower for w in ["cost", "spend", "spending", "expense", "how much"]):
        today_cost = await _get_today_spend(body.org_id)
        month_cost = await _get_month_spend(body.org_id)
        answer = (
            f"Here's your AI spend summary:\n\n"
            f"• Total spend: ${kpis['total_cost']:.2f}\n"
            f"• Today's spend: ${today_cost:.2f}\n"
            f"• This month's spend: ${month_cost:.2f}\n"
            f"• Average per request: ${kpis['cost_per_request']:.4f}\n\n"
        )
        if cost_by_model:
            top = cost_by_model[0]
            answer += f"Highest-cost model: {top['model']} at ${top['cost']:.2f}\n"
        if cost_by_agent:
            top = cost_by_agent[0]
            answer += f"Highest-cost agent: {top['agent']} at ${top['cost']:.2f}\n"
        if cost_by_provider:
            top = cost_by_provider[0]
            answer += f"Highest-cost provider: {top['provider']} at ${top['cost']:.2f}"

        return CopilotResponse(
            answer=answer,
            data={"kpis": kpis, "today_cost": today_cost, "month_cost": month_cost,
                  "cost_by_model": cost_by_model[:5], "cost_by_agent": cost_by_agent[:5],
                  "cost_by_provider": cost_by_provider[:5]},
            suggested_actions=["Show top 10 expensive agents", "Generate a monthly forecast", "Show optimization opportunities"],
            sources=["analytics/kpis", "ai_requests"],
            actionable=True,
        )

    # ─── Latency / performance ─────────────────────────────
    if any(w in query_lower for w in ["latency", "speed", "slow", "fast", "performance"]):
        answer = (
            f"Your average request latency is {kpis['avg_latency_ms']:.0f}ms. "
            f"The cache hit rate is {kpis['cache_hit_rate']:.1f}%, which "
            f"{'is excellent' if kpis['cache_hit_rate'] > 20 else 'could be improved'}. "
        )
        return CopilotResponse(
            answer=answer,
            data={"kpis": kpis},
            suggested_actions=["Enable semantic caching for repeat queries", "Consider routing to faster models"],
            sources=["analytics/kpis", "analytics/latency-distribution"],
            actionable=True,
        )

    # ─── Token usage ───────────────────────────────────────
    if any(w in query_lower for w in ["token", "usage", "volume", "consumption"]):
        answer = (
            f"Your total token usage is {kpis['total_tokens']:,} tokens across {kpis['total_requests']} requests. "
            f"Average tokens per request: {kpis['tokens_per_request']:.0f}."
        )
        return CopilotResponse(
            answer=answer,
            data={"kpis": kpis, "cost_by_model": cost_by_model[:5]},
            suggested_actions=["Review token usage trends in Cost Explorer", "Consider prompt optimization"],
            sources=["analytics/kpis", "analytics/token-usage"],
            actionable=True,
        )

    # ─── Optimization / savings ─────────────────────────────
    if any(w in query_lower for w in ["optim", "save", "saving", "reduce", "cheap", "cut cost"]):
        recs = await supabase.select(
            "optimization_recommendations",
            filters={"org_id": body.org_id, "status": "pending"},
            order="potential_savings.desc",
        )
        total_savings = sum(r["potential_savings"] for r in recs)
        answer = f"I found {len(recs)} optimization opportunities with ${total_savings:.2f}/month in potential savings.\n\n"
        for r in recs[:5]:
            answer += f"• {r['title']} — ${r['potential_savings']:.2f}/mo ({r['confidence_score']:.0f}% confidence)\n"
        return CopilotResponse(
            answer=answer,
            data={"recommendations": recs, "total_potential_savings": total_savings},
            suggested_actions=[f"Apply: {r['title']}" for r in recs[:3]],
            sources=["optimization/recommendations"],
            actionable=True,
        )

    # ─── Provider / routing ─────────────────────────────────
    if any(w in query_lower for w in ["provider", "model", "routing", "failover"]):
        providers = await supabase.select("providers", order="priority.asc")
        answer = f"You have {len(providers)} providers configured:\n\n"
        for p in providers:
            answer += f"• {p['name']} — {p['status']} (priority {p['priority']})\n"
        return CopilotResponse(
            answer=answer,
            data={"providers": providers},
            suggested_actions=["Review the Provider Gateway page", "Compare model pricing across providers"],
            sources=["control-plane/providers"],
            actionable=True,
        )

    # ─── Default / help ────────────────────────────────────
    answer = (
        f"I'm your AI Cost Intelligence Copilot. I can help with:\n\n"
        f"• Cost analysis — 'What's our total AI spend?'\n"
        f"• Top agents — 'Show top 10 expensive agents'\n"
        f"• Savings simulation — 'Simulate switching from gpt-4o to gpt-4o-mini'\n"
        f"• Forecasting — 'Forecast next month's costs'\n"
        f"• Budget tracking — 'How's our budget utilization?'\n"
        f"• Optimization — 'Show me optimization opportunities'\n\n"
        f"Current stats: ${kpis['total_cost']:.2f} total spend, {kpis['total_requests']} requests, "
        f"{kpis['avg_latency_ms']:.0f}ms avg latency, {kpis['cache_hit_rate']:.1f}% cache hit rate."
    )
    return CopilotResponse(
        answer=answer,
        data={"kpis": kpis},
        suggested_actions=[
            "What's our total AI spend?",
            "Show top 10 expensive agents",
            "Show me optimization opportunities",
            "Forecast next month's costs",
        ],
        sources=["analytics/kpis"],
    )


@router.post("/action", response_model=dict)
async def execute_action(body: CopilotAction):
    """Execute a recommended action from the copilot."""
    if body.action_type == "apply_recommendation":
        rec_id = body.params.get("recommendation_id")
        if not rec_id:
            return {"error": "recommendation_id required"}
        result = await supabase.update("optimization_recommendations", {"id": str(rec_id)}, {"status": "applied"})
        return {"action": "applied", "result": result[0] if result else None}

    elif body.action_type == "simulate_savings":
        from_model = body.params.get("from_model")
        to_model = body.params.get("to_model")
        if not from_model or not to_model:
            return {"error": "from_model and to_model required"}
        return await get_scenario_analysis(body.org_id, from_model, to_model)

    elif body.action_type == "generate_forecast":
        period = body.params.get("period_type", "monthly")
        return await generate_forecast(body.org_id, period)

    elif body.action_type == "create_policy":
        name = body.params.get("name")
        policy_type = body.params.get("policy_type", "cost_limit")
        rule_config = body.params.get("rule_config", {})
        data = {
            "org_id": body.org_id,
            "name": name,
            "policy_type": policy_type,
            "scope": "org",
            "rule_config": rule_config,
            "status": "active",
            "priority": 1,
        }
        result = await supabase.insert("policies", data)
        return {"action": "created", "result": result[0] if isinstance(result, list) and result else result}

    return {"error": f"Unknown action type: {body.action_type}"}


# ─── Helpers ──────────────────────────────────────────────

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


async def _get_today_spend(org_id: str) -> float:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    requests = await supabase.select(
        "ai_requests",
        columns="total_cost,created_at",
        filters={"org_id": org_id},
        limit=10000,
    )
    return round(sum(r["total_cost"] for r in requests if r["created_at"][:10] == today), 2)


async def _get_month_spend(org_id: str) -> float:
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    requests = await supabase.select(
        "ai_requests",
        columns="total_cost,created_at",
        filters={"org_id": org_id},
        limit=10000,
    )
    return round(sum(r["total_cost"] for r in requests if r["created_at"][:7] == month), 2)


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


async def _get_cost_by_agent(org_id: str) -> list[dict]:
    """Get cost breakdown by AI agent/application."""
    requests = await supabase.select(
        "ai_requests",
        columns="app_id,total_cost",
        filters={"org_id": org_id},
        limit=10000,
    )
    apps = await supabase.select("applications")
    app_map = {a["id"]: a["name"] for a in apps}

    by_agent: dict[str, dict] = {}
    for r in requests:
        aid = str(r["app_id"]) if r["app_id"] else "unknown"
        name = app_map.get(aid, "Unknown")
        if aid not in by_agent:
            by_agent[aid] = {"agent": name, "cost": 0, "requests": 0}
        by_agent[aid]["cost"] += r["total_cost"]
        by_agent[aid]["requests"] += 1
    return sorted(by_agent.values(), key=lambda x: x["cost"], reverse=True)
