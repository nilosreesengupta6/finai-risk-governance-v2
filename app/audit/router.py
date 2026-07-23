"""
Audit REST API: Immutable Cost Ledger, CSV export, and audit trail queries.
"""

import csv
import io
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from uuid import UUID
from datetime import datetime, timezone

from app.core.supabase import supabase
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/ledger")
async def list_ledger_entries(
    org_id: UUID | None = None,
    entry_type: str | None = None,
    cost_period: str | None = None,
    limit: int = Query(50, le=500),
    offset: int = 0,
):
    """List immutable cost ledger entries."""
    filters: dict = {}
    if org_id:
        filters["org_id"] = str(org_id)
    if entry_type:
        filters["entry_type"] = entry_type
    if cost_period:
        filters["cost_period"] = cost_period
    return await supabase.select(
        "cost_ledger",
        filters=filters or None,
        limit=limit,
        offset=offset,
        order="created_at.desc",
    )


@router.get("/ledger/summary")
async def get_ledger_summary(org_id: UUID | None = None):
    """Summary of ledger entries by cost period."""
    entries = await supabase.select(
        "cost_ledger",
        columns="amount,tokens_in,tokens_out,cost_period,entry_type",
        filters={"org_id": str(org_id)} if org_id else None,
        limit=10000,
    )

    by_period: dict[str, dict] = {}
    for e in entries:
        period = e["cost_period"]
        if period not in by_period:
            by_period[period] = {
                "period": period,
                "total_amount": 0,
                "total_tokens_in": 0,
                "total_tokens_out": 0,
                "entry_count": 0,
            }
        by_period[period]["total_amount"] += float(e["amount"])
        by_period[period]["total_tokens_in"] += e["tokens_in"]
        by_period[period]["total_tokens_out"] += e["tokens_out"]
        by_period[period]["entry_count"] += 1

    result = sorted(by_period.values(), key=lambda x: x["period"], reverse=True)
    for r in result:
        r["total_amount"] = round(r["total_amount"], 4)
    return result


@router.get("/ledger/export")
async def export_ledger_csv(org_id: UUID | None = None):
    """Export the full cost ledger as CSV."""
    entries = await supabase.select(
        "cost_ledger",
        filters={"org_id": str(org_id)} if org_id else None,
        limit=10000,
        order="created_at.desc",
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "request_id", "org_id", "entry_type", "amount", "currency",
        "tokens_in", "tokens_out", "tokens_cached", "model_id", "provider_id",
        "cost_period", "created_at",
    ])
    for e in entries:
        writer.writerow([
            e.get("id", ""),
            e.get("request_id", ""),
            e.get("org_id", ""),
            e.get("entry_type", ""),
            e.get("amount", 0),
            "USD",
            e.get("tokens_in", 0),
            e.get("tokens_out", 0),
            e.get("tokens_cached", 0),
            e.get("model_id", ""),
            e.get("provider_id", ""),
            e.get("cost_period", ""),
            e.get("created_at", ""),
        ])

    output.seek(0)
    filename = f"cost_ledger_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/requests")
async def list_audit_requests(
    org_id: UUID | None = None,
    status: str | None = None,
    limit: int = Query(50, le=500),
    offset: int = 0,
):
    """Audit trail of all AI requests with governance metadata."""
    filters: dict = {}
    if org_id:
        filters["org_id"] = str(org_id)
    if status:
        filters["status"] = status
    return await supabase.select(
        "ai_requests",
        filters=filters or None,
        limit=limit,
        offset=offset,
        order="created_at.desc",
    )
