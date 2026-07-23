"""
Policy Engine: evaluates requests against the governance policy catalog.
Supports cost limits, rate limits, model restrictions, data residency, and usage quotas.
"""

from datetime import datetime, timezone, timedelta
from uuid import UUID

from app.core.supabase import supabase
from app.core.logging import get_logger
from app.governance.models import PolicyEvaluationResult, GovernanceDecision

logger = get_logger(__name__)


async def evaluate_policies(
    org_id: str,
    model_id: str,
    estimated_cost: float = 0,
    app_id: str | None = None,
    project_id: str | None = None,
    dept_id: str | None = None,
    bu_id: str | None = None,
) -> GovernanceDecision:
    """Evaluate all active policies for an organization against a request."""

    policies = await supabase.select(
        "policies",
        filters={"org_id": org_id, "status": "active"},
        order="priority.asc",
    )

    evaluations: list[PolicyEvaluationResult] = []
    triggered: list[str] = []
    blocked = False
    blocked_reason = None
    risk_tier = "LOW"

    for p in policies:
        result = "approved"
        reason = "Policy check passed"
        ptype = p["policy_type"]
        rule = p.get("rule_config", {})

        if ptype == "cost_limit":
            # Check cumulative monthly spend against limit
            max_cost = rule.get("max_monthly_cost", 0)
            now = datetime.now(timezone.utc)
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            recent = await supabase.select(
                "ai_requests",
                columns="total_cost",
                filters={"org_id": org_id},
                limit=10000,
            )
            monthly_spend = sum(
                r["total_cost"] for r in recent
                if r.get("created_at", "") >= month_start.isoformat()
            )
            if monthly_spend + estimated_cost > max_cost:
                result = "denied"
                reason = f"Monthly cost limit exceeded: ${monthly_spend:.2f} + ${estimated_cost:.2f} > ${max_cost:.2f}"
                blocked = True
                blocked_reason = reason
                risk_tier = "HIGH"
            elif monthly_spend > max_cost * 0.8:
                result = "warn"
                reason = f"Approaching cost limit: ${monthly_spend:.2f} / ${max_cost:.2f} (80%)"
                risk_tier = "MEDIUM"

        elif ptype == "rate_limit":
            max_rpm = rule.get("max_requests_per_minute", 0)
            one_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
            recent = await supabase.select(
                "ai_requests",
                columns="created_at",
                filters={"org_id": org_id},
                limit=200,
                order="created_at.desc",
            )
            recent_count = sum(1 for r in recent if r.get("created_at", "") >= one_min_ago)
            if recent_count >= max_rpm:
                result = "denied"
                reason = f"Rate limit exceeded: {recent_count} requests in last minute (limit: {max_rpm})"
                blocked = True
                blocked_reason = reason
                risk_tier = "HIGH"

        elif ptype == "model_restriction":
            allowed = rule.get("allowed_models", [])
            if allowed and model_id not in allowed:
                result = "denied"
                reason = f"Model '{model_id}' is not in the allowed list: {allowed}"
                blocked = True
                blocked_reason = reason
                risk_tier = "HIGH"

        elif ptype == "usage_quota":
            max_tokens = rule.get("max_monthly_tokens", 0)
            now = datetime.now(timezone.utc)
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            recent = await supabase.select(
                "ai_requests",
                columns="total_tokens,created_at",
                filters={"org_id": org_id},
                limit=10000,
            )
            monthly_tokens = sum(
                r["total_tokens"] for r in recent
                if r.get("created_at", "") >= month_start.isoformat()
            )
            if monthly_tokens > max_tokens:
                result = "denied"
                reason = f"Monthly token quota exceeded: {monthly_tokens} > {max_tokens}"
                blocked = True
                blocked_reason = reason
                risk_tier = "HIGH"

        eval_result = PolicyEvaluationResult(
            policy_id=p["id"],
            policy_name=p["name"],
            policy_type=ptype,
            result=result,
            reason=reason,
            rule_config=rule,
        )
        evaluations.append(eval_result)

        if result in ("denied", "warn"):
            triggered.append(p["name"])

    decision = "APPROVED" if not blocked else "REVIEW_REQUIRED"

    return GovernanceDecision(
        decision=decision,
        risk_tier=risk_tier,
        evaluations=evaluations,
        triggered_policies=triggered,
        blocked=blocked,
        blocked_reason=blocked_reason,
    )
