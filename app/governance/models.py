"""
Pydantic models for the Governance & Policy Engine.
"""

from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Any


class PolicyBase(BaseModel):
    org_id: UUID
    name: str
    policy_type: str  # cost_limit, rate_limit, model_restriction, data_residency, usage_quota
    scope: str = "org"  # org, bu, department, project, app
    scope_id: UUID | None = None
    rule_config: dict[str, Any] = Field(default_factory=dict)
    status: str = "active"
    priority: int = 1


class PolicyCreate(PolicyBase):
    pass


class Policy(PolicyBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PolicyEvaluationResult(BaseModel):
    policy_id: UUID
    policy_name: str
    policy_type: str
    result: str  # approved, denied, warn
    reason: str
    rule_config: dict[str, Any]


class GovernanceDecision(BaseModel):
    """Overall governance decision for a request."""
    decision: str  # APPROVED, REVIEW_REQUIRED
    risk_tier: str  # LOW, MEDIUM, HIGH
    evaluations: list[PolicyEvaluationResult]
    triggered_policies: list[str]
    blocked: bool = False
    blocked_reason: str | None = None
