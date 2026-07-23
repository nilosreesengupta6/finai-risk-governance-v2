"""
Forecasting Engine: projects future AI costs using linear regression on
historical daily spend. Produces Best/Expected/Worst case scenarios with
confidence intervals for weekly, monthly, and quarterly horizons.
"""

from datetime import datetime, timedelta, timezone, date
from typing import Any
from uuid import UUID

from app.core.supabase import supabase
from app.core.logging import get_logger

logger = get_logger(__name__)


def _linear_regression(x: list[float], y: list[float]) -> tuple[float, float, float]:
    """Returns (slope, intercept, r_squared) for a simple linear regression."""
    n = len(x)
    if n < 2:
        return 0.0, y[0] if y else 0.0, 0.0

    sum_x = sum(x)
    sum_y = sum(y)
    sum_xy = sum(xi * yi for xi, yi in zip(x, y))
    sum_x2 = sum(xi * xi for xi in x)

    denom = n * sum_x2 - sum_x * sum_x
    if denom == 0:
        return 0.0, sum_y / n, 0.0

    slope = (n * sum_xy - sum_x * sum_y) / denom
    intercept = (sum_y - slope * sum_x) / n

    # R-squared
    mean_y = sum_y / n
    ss_tot = sum((yi - mean_y) ** 2 for yi in y)
    ss_res = sum((yi - (slope * xi + intercept)) ** 2 for xi, yi in zip(x, y))
    r_sq = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    return slope, intercept, r_sq


def _project(slope: float, intercept: float, days_ahead: int,
             avg_daily: float, std_dev: float) -> tuple[float, float, float]:
    """Project cost for N days ahead. Returns (best, expected, worst)."""
    projected_daily = slope * (days_ahead) + intercept
    # Clamp to non-negative
    projected_daily = max(projected_daily, avg_daily * 0.5, 0.01)
    total = projected_daily * days_ahead

    # Confidence bands based on standard deviation
    margin = std_dev * days_ahead ** 0.5
    best = max(total - margin * 1.5, 0)
    worst = total + margin * 1.5
    expected = total

    return round(best, 2), round(expected, 2), round(worst, 2)


async def generate_forecast(org_id: str, period_type: str = "monthly") -> dict[str, Any]:
    """
    Generate a cost forecast for the given period type.
    Uses the last 30 days of daily spend as training data.
    """
    requests = await supabase.select(
        "ai_requests",
        columns="total_cost,created_at",
        filters={"org_id": org_id},
        limit=10000,
    )

    if not requests:
        return {"error": "No historical data for forecasting"}

    # Build daily spend series
    daily_spend: dict[str, float] = {}
    for r in requests:
        d = r["created_at"][:10]
        daily_spend[d] = daily_spend.get(d, 0.0) + r["total_cost"]

    sorted_dates = sorted(daily_spend.keys())
    if len(sorted_dates) < 3:
        return {"error": "Insufficient data points for forecasting (need at least 3 days)"}

    x = list(range(len(sorted_dates)))
    y = [daily_spend[d] for d in sorted_dates]

    slope, intercept, r_sq = _linear_regression(x, y)
    avg_daily = sum(y) / len(y)
    mean_y = sum(y) / len(y)
    variance = sum((yi - mean_y) ** 2 for yi in y) / len(y)
    std_dev = variance ** 0.5

    # Determine projection horizon
    today = date.today()
    if period_type == "weekly":
        days_ahead = 7
        target_date = today + timedelta(days=7)
    elif period_type == "quarterly":
        days_ahead = 90
        target_date = today + timedelta(days=90)
    else:  # monthly
        days_ahead = 30
        target_date = today + timedelta(days=30)

    best, expected, worst = _project(slope, intercept, days_ahead, avg_daily, std_dev)

    # Confidence interval (95% approx)
    ci_low = round(expected * 0.85, 2)
    ci_high = round(expected * 1.15, 2)

    # Confidence score based on R-squared and data volume
    confidence = round(min(r_sq * 100, 95.0), 1)
    if confidence < 30:
        confidence = 30.0  # minimum

    forecast_data = {
        "org_id": org_id,
        "period_type": period_type,
        "target_date": target_date.isoformat(),
        "best_case": best,
        "expected_case": expected,
        "worst_case": worst,
        "confidence_interval_low": ci_low,
        "confidence_interval_high": ci_high,
        "confidence_score": confidence,
        "model_metadata": {
            "algorithm": "linear_regression",
            "training_points": len(sorted_dates),
            "slope": round(slope, 6),
            "intercept": round(intercept, 6),
            "r_squared": round(r_sq, 4),
            "avg_daily_spend": round(avg_daily, 4),
            "std_dev": round(std_dev, 4),
            "trend": "increasing" if slope > 0 else "decreasing" if slope < 0 else "stable",
        },
    }

    # Persist forecast
    result = await supabase.insert("cost_forecasts", forecast_data)
    if isinstance(result, list) and result:
        forecast_data["id"] = result[0]["id"]

    return forecast_data


async def get_forecasts(org_id: str, period_type: str | None = None) -> list[dict]:
    """Retrieve stored forecasts."""
    filters: dict = {"org_id": org_id}
    if period_type:
        filters["period_type"] = period_type
    return await supabase.select(
        "cost_forecasts",
        filters=filters,
        limit=50,
        order="created_at.desc",
    )


async def get_scenario_analysis(org_id: str, from_model: str, to_model: str) -> dict[str, Any]:
    """
    Simulate savings from switching one model to another.
    Compares actual spend on from_model vs projected spend on to_model.
    """
    # Get pricing for both models
    all_models = await supabase.select("provider_models", order="display_name.asc")
    from_pricing = None
    to_pricing = None
    for m in all_models:
        if m["model_id"] == from_model:
            from_pricing = m
        if m["model_id"] == to_model:
            to_pricing = m

    if not from_pricing or not to_pricing:
        return {"error": f"Could not find pricing for {from_model} or {to_model}"}

    # Get all requests using the from_model
    requests = await supabase.select(
        "ai_requests",
        columns="prompt_tokens,completion_tokens,total_cost,created_at",
        filters={"org_id": org_id, "model_id": from_model},
        limit=10000,
    )

    if not requests:
        return {"error": f"No requests found for model {from_model}"}

    # Calculate actual spend and simulated spend
    total_actual = sum(r["total_cost"] for r in requests)
    total_prompt = sum(r["prompt_tokens"] for r in requests)
    total_completion = sum(r["completion_tokens"] for r in requests)

    from_input_price = float(from_pricing["input_price_per_1k"])
    from_output_price = float(from_pricing["output_price_per_1k"])
    to_input_price = float(to_pricing["input_price_per_1k"])
    to_output_price = float(to_pricing["output_price_per_1k"])

    simulated_input_cost = total_prompt * to_input_price / 1000.0
    simulated_output_cost = total_completion * to_output_price / 1000.0
    total_simulated = simulated_input_cost + simulated_output_cost

    savings = total_actual - total_simulated
    savings_pct = (savings / total_actual * 100) if total_actual > 0 else 0

    # Monthly projection
    if len(requests) > 0:
        dates = [r["created_at"][:10] for r in requests]
        date_range = (max(dates) >= min(dates))
        if date_range:
            from datetime import datetime as dt
            d0 = dt.fromisoformat(min(dates))
            d1 = dt.fromisoformat(max(dates))
            days = max((d1 - d0).days, 1)
            monthly_actual = (total_actual / days) * 30
            monthly_simulated = (total_simulated / days) * 30
            monthly_savings = monthly_actual - monthly_simulated
        else:
            monthly_savings = savings
    else:
        monthly_savings = savings

    return {
        "from_model": from_model,
        "to_model": to_model,
        "from_pricing": {
            "input_per_1k": from_input_price,
            "output_per_1k": from_output_price,
        },
        "to_pricing": {
            "input_per_1k": to_input_price,
            "output_per_1k": to_output_price,
        },
        "total_requests": len(requests),
        "total_prompt_tokens": total_prompt,
        "total_completion_tokens": total_completion,
        "actual_spend": round(total_actual, 4),
        "simulated_spend": round(total_simulated, 4),
        "total_savings": round(savings, 4),
        "savings_percentage": round(savings_pct, 1),
        "projected_monthly_savings": round(monthly_savings, 2),
        "quality_note": _quality_note(from_model, to_model),
    }


def _quality_note(from_model: str, to_model: str) -> str:
    """Generate a quality impact note based on model comparison."""
    premium_models = {"gpt-4o", "o1", "o1-mini", "claude-3-opus-20240229", "gemini-1.5-pro"}
    if from_model in premium_models and to_model not in premium_models:
        return "Expect minor quality degradation on complex reasoning tasks. Recommend A/B testing before full rollout."
    if to_model in premium_models and from_model not in premium_models:
        return "Expect quality improvement. This upgrade may justify the cost for high-value use cases."
    return "Similar model tier — quality impact should be minimal."
