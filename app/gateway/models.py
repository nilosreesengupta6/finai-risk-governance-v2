"""
Pydantic models for the AI Gateway request lifecycle.
"""

from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Any


class ChatRequest(BaseModel):
    """Incoming AI request to the gateway."""
    model: str = "gpt-4o-mini"
    messages: list[dict[str, Any]] = Field(default_factory=list)
    temperature: float = 0.7
    max_tokens: int | None = None
    stream: bool = False
    routing_strategy: str | None = None  # latency_first, cost_first, quality_first
    metadata: dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    """Gateway response with full lifecycle metadata."""
    id: str
    model: str
    provider: str
    choices: list[dict[str, Any]]
    usage: dict[str, int]
    cost: dict[str, float]
    latency_ms: int
    cache_hit: bool
    routing_strategy: str
    triggered_policies: list[str]
    stage: str
    status: str


class GatewayLifecycleEvent(BaseModel):
    """A single stage event in the 6-stage lifecycle."""
    stage: str
    status: str
    duration_ms: int
    details: dict[str, Any] = Field(default_factory=dict)


class GatewayLifecycleTrace(BaseModel):
    """Full lifecycle trace for a request."""
    request_id: str
    events: list[GatewayLifecycleEvent]
    total_latency_ms: int
    cache_hit: bool
    total_cost: float
    routing_strategy: str


class AIRequestRecord(BaseModel):
    """A stored AI request record."""
    id: UUID
    org_id: UUID
    app_id: UUID | None = None
    project_id: UUID | None = None
    provider_id: UUID | None = None
    model_id: str
    stage: str
    status: str
    prompt_tokens: int
    completion_tokens: int
    cached_tokens: int
    total_tokens: int
    input_cost: float
    output_cost: float
    cached_cost: float
    total_cost: float
    latency_ms: int
    cache_hit: bool
    routing_strategy: str | None = None
    triggered_policies: list[str] = Field(default_factory=list)
    blocked_reason: str | None = None
    created_at: datetime
