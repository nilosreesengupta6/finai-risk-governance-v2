"""
Application configuration using Pydantic v2 BaseSettings.
All settings are environment-driven with sensible defaults for local development.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "Enterprise AI Cost Intelligence & Governance Platform"
    app_version: str = "2.0.0"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # PostgreSQL (for docker-compose internal networking)
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "finai"
    postgres_password: str = "finai_secret"
    postgres_db: str = "finai_governance"

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    # JWT / Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Gateway
    default_routing_strategy: str = "cost_first"
    cache_ttl_seconds: int = 3600
    circuit_breaker_threshold: int = 5
    circuit_breaker_timeout_seconds: int = 60

    # CORS
    cors_origins: list[str] = ["*"]


settings = Settings()
