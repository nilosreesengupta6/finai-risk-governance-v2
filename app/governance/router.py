"""
Governance REST API: Policy CRUD and policy evaluation.
"""

from fastapi import APIRouter, HTTPException, Query
from uuid import UUID

from app.core.supabase import supabase
from app.core.logging import get_logger
from app.governance.models import PolicyCreate, Policy, GovernanceDecision
from app.governance.engine import evaluate_policies

logger = get_logger(__name__)

router = APIRouter(prefix="/governance", tags=["Governance"])


@router.get("/policies", response_model=list[Policy])
async def list_policies(org_id: UUID | None = None, status: str | None = None):
    filters: dict = {}
    if org_id:
        filters["org_id"] = str(org_id)
    if status:
        filters["status"] = status
    return await supabase.select("policies", filters=filters or None, order="priority.asc")


@router.post("/policies", response_model=Policy, status_code=201)
async def create_policy(body: PolicyCreate):
    result = await supabase.insert("policies", body.model_dump())
    if isinstance(result, list) and result:
        return result[0]
    return result


@router.get("/policies/{policy_id}", response_model=Policy)
async def get_policy(policy_id: UUID):
    rows = await supabase.select("policies", filters={"id": str(policy_id)})
    if not rows:
        raise HTTPException(404, "Policy not found")
    return rows[0]


@router.patch("/policies/{policy_id}", response_model=Policy)
async def update_policy(policy_id: UUID, body: dict):
    result = await supabase.update("policies", {"id": str(policy_id)}, body)
    if not result:
        raise HTTPException(404, "Policy not found")
    return result[0]


@router.delete("/policies/{policy_id}")
async def delete_policy(policy_id: UUID):
    await supabase.delete("policies", {"id": str(policy_id)})
    return {"deleted": True}


@router.post("/evaluate", response_model=GovernanceDecision)
async def evaluate_request(
    org_id: str,
    model_id: str,
    estimated_cost: float = 0,
    app_id: str | None = None,
    project_id: str | None = None,
):
    """Evaluate a request against all active governance policies."""
    return await evaluate_policies(org_id, model_id, estimated_cost, app_id, project_id)
