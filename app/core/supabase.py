"""
Supabase client singleton for database access.
Uses the service role key for server-side operations.
"""

import httpx
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class SupabaseRESTClient:
    """
    Lightweight Supabase REST client using the PostgREST API.
    Avoids the need for the supabase-py package in the Python backend.
    """

    def __init__(self) -> None:
        self.base_url = f"{settings.supabase_url}/rest/v1"
        self.headers = {
            "apikey": settings.supabase_service_role_key or settings.supabase_anon_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key or settings.supabase_anon_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    async def select(self, table: str, columns: str = "*", filters: dict | None = None,
                      limit: int | None = None, offset: int | None = None,
                      order: str | None = None) -> list[dict]:
        params = {"select": columns}
        if filters:
            for key, value in filters.items():
                if isinstance(value, dict):
                    for op, val in value.items():
                        params[key] = f"{op}.{val}"
                else:
                    params[key] = f"eq.{value}"
        if limit is not None:
            params["limit"] = str(limit)
        if offset is not None:
            params["offset"] = str(offset)
        if order:
            params["order"] = order

        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.base_url}/{table}", params=params, headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    async def insert(self, table: str, data: dict | list[dict]) -> dict | list[dict]:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.base_url}/{table}", json=data, headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    async def update(self, table: str, filters: dict, data: dict) -> list[dict]:
        params = {}
        for key, value in filters.items():
            params[key] = f"eq.{value}"
        async with httpx.AsyncClient() as client:
            resp = await client.patch(f"{self.base_url}/{table}", params=params, json=data, headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    async def delete(self, table: str, filters: dict) -> list[dict]:
        params = {}
        for key, value in filters.items():
            params[key] = f"eq.{value}"
        async with httpx.AsyncClient() as client:
            resp = await client.delete(f"{self.base_url}/{table}", params=params, headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    async def rpc(self, function_name: str, params: dict | None = None) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.supabase_url}/rest/v1/rpc/{function_name}",
                json=params or {},
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()


supabase = SupabaseRESTClient()
