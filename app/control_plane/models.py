"""
Pydantic models for the Control Plane & Multi-Provider Registry.
"""

from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID


class OrganizationBase(BaseModel):
    name: str
    slug: str
    status: str = "active"
    plan_tier: str = "enterprise"


class OrganizationCreate(OrganizationBase):
    pass


class Organization(OrganizationBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BusinessUnitBase(BaseModel):
    org_id: UUID
    name: str
    code: str | None = None


class BusinessUnitCreate(BusinessUnitBase):
    pass


class BusinessUnit(BusinessUnitBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class DepartmentBase(BaseModel):
    org_id: UUID
    bu_id: UUID | None = None
    name: str
    cost_center: str | None = None


class DepartmentCreate(DepartmentBase):
    pass


class Department(DepartmentBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    org_id: UUID
    dept_id: UUID | None = None
    name: str
    description: str | None = None
    status: str = "active"
    budget_monthly: float = 0


class ProjectCreate(ProjectBase):
    pass


class Project(ProjectBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class ApplicationBase(BaseModel):
    org_id: UUID
    project_id: UUID | None = None
    name: str
    app_type: str = "chat"
    status: str = "active"


class ApplicationCreate(ApplicationBase):
    pass


class Application(ApplicationBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class APIKeyCreate(BaseModel):
    org_id: UUID
    app_id: UUID
    name: str
    scopes: list[str] = Field(default_factory=lambda: ["chat"])


class APIKey(APIKeyCreate):
    id: UUID
    key_prefix: str
    status: str = "active"
    created_at: datetime
    last_used_at: datetime | None = None


class ProviderBase(BaseModel):
    name: str
    slug: str
    base_url: str
    status: str = "active"
    priority: int = 1
    auth_type: str = "bearer"
    supported_models: list[str] = Field(default_factory=list)


class ProviderCreate(ProviderBase):
    pass


class Provider(ProviderBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class ProviderModelBase(BaseModel):
    provider_id: UUID
    model_id: str
    display_name: str
    context_window: int = 4096
    input_price_per_1k: float = 0
    output_price_per_1k: float = 0
    cached_input_price_per_1k: float = 0
    vision_price_per_1k: float = 0
    audio_price_per_1k: float = 0
    max_output_tokens: int = 4096
    status: str = "active"


class ProviderModelCreate(ProviderModelBase):
    pass


class ProviderModel(ProviderModelBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class ProviderStatus(BaseModel):
    """Live provider status for the multi-provider catalog."""
    id: UUID
    name: str
    slug: str
    status: str
    priority: int
    model_count: int
    avg_latency_ms: float
    failover_rank: int
    active_requests: int
