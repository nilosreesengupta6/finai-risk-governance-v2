"""
Forecasting REST API: cost projections, scenario analysis, and budget tracking.
"""

from datetime import datetime
from fastapi import APIRouter, Query
from pydantic import BaseModel
from uuid import UUID

from app.core.supabase import supabase
from app.core.logging import get_logger
from app.forecasting.engine import generate_forecast, get_forecasts, get_scenario_analysis

logger = get_logger(__name__)

router = APIRouter(prefix="/forecasting", tags=["Forecasting"])


class ForecastRequest(BaseModel):
    org_id: str
    period_type: str = "monthly"  # weekly, monthly, quarterly


class ScenarioRequest(BaseModel):
    org_id: str
    from_model: str
    to_model: str


@router.post("/generate")
async def create_forecast(body: ForecastRequest):
    """Generate a new cost forecast projection."""
    return await generate_forecast(body.org_id, body.period_type)


@router.get("/forecasts")
async def list_forecasts(
    org_id: UUID | None = None,
    period_type: str | None = None,
):
    """List stored forecasts."""
    return await get_forecasts(str(org_id) if org_id else "", period_type or "")


@router.post("/scenario")
async def run_scenario_analysis(body: ScenarioRequest):
    """Simulate savings from switching one model to another."""
    return await get_scenario_analysis(body.org_id, body.from_model, body.to_model)


@router.get("/budgets")
async def list_budgets(org_id: UUID | None = None):
    """List budget tracking records with utilization."""
    filters = {"org_id": str(org_id)} if org_id else None
    budgets = await supabase.select("budgets", filters=filters, limit=100, order="period.desc")

    # Enrich with project names
    if budgets:
        projects = await supabase.select("projects")
        proj_map = {p["id"]: p for p in projects}
        for b in budgets:
            p = proj_map.get(b.get("project_id"))
            b["project_name"] = p["name"] if p else None

    return budgets


@router.post("/budgets/refresh")
async def refresh_budgets(org_id: str):
    """Recalculate actual spend and utilization for all budgets in the current period."""
    budgets = await supabase.select("budgets", filters={"org_id": org_id}, limit=100)

    now = datetime.utcnow()
    current_period = now.strftime("%Y-%m")
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    updated = []
    for b in budgets:
        # Get actual spend for this month
        all_requests = await supabase.select(
            "ai_requests",
            columns="total_cost,created_at",
            filters={"org_id": org_id},
            limit=10000,
        )
        actual = sum(
            r["total_cost"] for r in all_requests
            if r.get("created_at", "") >= month_start.isoformat()
        )

        # Simple forecast: actual so far * (30 / days_elapsed)
        days_elapsed = max(now.day, 1)
        forecast = actual * (30 / days_elapsed) if days_elapsed < 30 else actual

        limit = b["budget_limit"]
        utilization = (actual / limit * 100) if limit > 0 else 0
        status = "exceeded" if actual > limit else "critical" if actual > limit * 0.9 else "warning" if actual > limit * 0.8 else "on_track"

        result = await supabase.update("budgets", {"id": b["id"]}, {
            "actual_spend": round(actual, 2),
            "forecast_spend": round(forecast, 2),
            "utilization_pct": round(utilization, 1),
            "status": status,
            "period": current_period,
            "updated_at": now.isoformat(),
        })
        if result:
            updated.append(result[0])

    return {"updated": len(updated), "budgets": updated}
