"""
Provider Abstraction Layer: unified interface for all LLM providers.
Handles authentication, health checks, cost metadata, token accounting,
retry policies, rate limiting, failover, and streaming support.
"""

import asyncio
import hashlib
import time
from abc import ABC, abstractmethod
from typing import Any

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.core.supabase import supabase

logger = get_logger(__name__)


class ProviderClient(ABC):
    """Abstract base for provider clients."""

    def __init__(self, provider: dict, models: list[dict]):
        self.provider = provider
        self.models = models
        self.base_url = provider["base_url"]
        self.auth_type = provider["auth_type"]
        self._circuit_open = False
        self._failure_count = 0

    @abstractmethod
    async def execute(self, model: str, messages: list[dict], temperature: float,
                      max_tokens: int | None) -> dict[str, Any]:
        """Execute a completion request. Returns dict with choices, usage, raw_response."""
        ...

    @abstractmethod
    def _build_headers(self) -> dict[str, str]:
        ...

    def get_model_pricing(self, model_id: str) -> dict[str, float]:
        for m in self.models:
            if m["model_id"] == model_id:
                return {
                    "input": float(m["input_price_per_1k"]),
                    "output": float(m["output_price_per_1k"]),
                    "cached": float(m.get("cached_input_price_per_1k") or 0),
                    "vision": float(m.get("vision_price_per_1k") or 0),
                    "audio": float(m.get("audio_price_per_1k") or 0),
                }
        return {"input": 0, "output": 0, "cached": 0, "vision": 0, "audio": 0}

    def is_circuit_open(self) -> bool:
        return self._circuit_open

    def record_failure(self) -> None:
        self._failure_count += 1
        if self._failure_count >= settings.circuit_breaker_threshold:
            self._circuit_open = True
            logger.warning("circuit_opened", provider=self.provider["slug"],
                           failures=self._failure_count)

    def record_success(self) -> None:
        self._failure_count = 0
        self._circuit_open = False

    async def health_check(self) -> dict[str, Any]:
        """Check provider health."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(self.base_url)
                return {
                    "provider": self.provider["slug"],
                    "healthy": resp.status_code < 500,
                    "status_code": resp.status_code,
                }
        except Exception as e:
            return {
                "provider": self.provider["slug"],
                "healthy": False,
                "error": str(e),
            }


class OpenAIProvider(ProviderClient):
    async def execute(self, model, messages, temperature, max_tokens):
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        f"{self.base_url}/chat/completions",
                        json=payload,
                        headers=self._build_headers(),
                    )
                    resp.raise_for_status()
                    self.record_success()
                    data = resp.json()
                    return {
                        "choices": data.get("choices", []),
                        "usage": data.get("usage", {}),
                    }
            except Exception as e:
                logger.warning("provider_retry", provider="openai", attempt=attempt + 1, error=str(e))
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                else:
                    self.record_failure()
                    raise

    def _build_headers(self):
        return {"Authorization": f"Bearer {_get_provider_key('openai')}", "Content-Type": "application/json"}


class AnthropicProvider(ProviderClient):
    async def execute(self, model, messages, temperature, max_tokens):
        # Convert OpenAI-style messages to Anthropic format
        system_msg = ""
        user_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_msg += msg["content"]
            else:
                user_messages.append(msg)

        payload = {
            "model": model,
            "messages": user_messages,
            "system": system_msg,
            "max_tokens": max_tokens or 4096,
            "temperature": temperature,
        }

        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        f"{self.base_url}/messages",
                        json=payload,
                        headers=self._build_headers(),
                    )
                    resp.raise_for_status()
                    self.record_success()
                    data = resp.json()
                    return {
                        "choices": [{"message": {"role": "assistant", "content": data.get("content", "")}}],
                        "usage": {
                            "prompt_tokens": data.get("usage", {}).get("input_tokens", 0),
                            "completion_tokens": data.get("usage", {}).get("output_tokens", 0),
                        },
                    }
            except Exception as e:
                logger.warning("provider_retry", provider="anthropic", attempt=attempt + 1, error=str(e))
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                else:
                    self.record_failure()
                    raise

    def _build_headers(self):
        key = _get_provider_key("anthropic")
        return {"x-api-key": key, "Content-Type": "application/json", "anthropic-version": "2023-06-01"}


class GoogleProvider(ProviderClient):
    async def execute(self, model, messages, temperature, max_tokens):
        # Convert to Gemini format
        contents = []
        system_instruction = None
        for msg in messages:
            if msg["role"] == "system":
                system_instruction = {"parts": [{"text": msg["content"]}]}
            else:
                role = "user" if msg["role"] == "user" else "model"
                contents.append({"role": role, "parts": [{"text": msg["content"]}]})

        payload = {"contents": contents, "generationConfig": {"temperature": temperature}}
        if system_instruction:
            payload["systemInstruction"] = system_instruction

        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        f"{self.base_url}/models/{model}:generateContent?key={_get_provider_key('google')}",
                        json=payload,
                        headers={"Content-Type": "application/json"},
                    )
                    resp.raise_for_status()
                    self.record_success()
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    text = ""
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        text = " ".join(p.get("text", "") for p in parts)
                    usage_meta = data.get("usageMetadata", {})
                    return {
                        "choices": [{"message": {"role": "assistant", "content": text}}],
                        "usage": {
                            "prompt_tokens": usage_meta.get("promptTokenCount", 0),
                            "completion_tokens": usage_meta.get("candidatesTokenCount", 0),
                        },
                    }
            except Exception as e:
                logger.warning("provider_retry", provider="google", attempt=attempt + 1, error=str(e))
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                else:
                    self.record_failure()
                    raise

    def _build_headers(self):
        return {"Content-Type": "application/json"}


class OllamaProvider(ProviderClient):
    """Local Ollama provider — OpenAI-compatible endpoint."""
    async def execute(self, model, messages, temperature, max_tokens):
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        f"{self.base_url}/chat/completions",
                        json=payload,
                        headers=self._build_headers(),
                    )
                    resp.raise_for_status()
                    self.record_success()
                    data = resp.json()
                    return {
                        "choices": data.get("choices", []),
                        "usage": data.get("usage", {"prompt_tokens": 0, "completion_tokens": 0}),
                    }
            except Exception as e:
                logger.warning("provider_retry", provider="ollama", attempt=attempt + 1, error=str(e))
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                else:
                    self.record_failure()
                    raise

    def _build_headers(self):
        return {"Content-Type": "application/json"}


def _get_provider_key(slug: str) -> str:
    """Get API key from environment — falls back to empty string for local providers."""
    import os
    env_map = {
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "google": "GOOGLE_API_KEY",
        "mistral": "MISTRAL_API_KEY",
        "cohere": "COHERE_API_KEY",
    }
    return os.environ.get(env_map.get(slug, ""), "")


# ─── Provider Registry ────────────────────────────────────────────

PROVIDER_REGISTRY: dict[str, type[ProviderClient]] = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "google": GoogleProvider,
    "mistral": OpenAIProvider,  # Mistral uses OpenAI-compatible API
    "cohere": OpenAIProvider,  # Cohere has OpenAI-compatible endpoint
    "meta": OllamaProvider,
}

# In-memory provider client cache
_provider_clients: dict[str, ProviderClient] = {}


async def get_provider_client(provider_slug: str) -> ProviderClient:
    """Get or create a provider client instance."""
    if provider_slug in _provider_clients:
        return _provider_clients[provider_slug]

    providers = await supabase.select("providers", filters={"slug": provider_slug})
    if not providers:
        raise ValueError(f"Provider '{provider_slug}' not found")

    provider = providers[0]
    models = await supabase.select("provider_models", filters={"provider_id": provider["id"]})

    client_class = PROVIDER_REGISTRY.get(provider_slug, OpenAIProvider)
    client = client_class(provider, models)
    _provider_clients[provider_slug] = client
    return client


async def get_all_providers() -> list[dict]:
    """Get all providers with their models."""
    providers = await supabase.select("providers", order="priority.asc")
    for p in providers:
        models = await supabase.select("provider_models", filters={"provider_id": p["id"]})
        p["models"] = models
    return providers
