# ADR-002: Immutable PostgreSQL Cost Ledger

## Status
Accepted

## Context
Enterprise FinOps requires an immutable, auditable record of every AI cost transaction.
The ledger must capture who (user), what (agent, model, provider), how much (tokens, cost),
and when (timestamp, cost period) for compliance and chargeback.

## Decision
Use the `cost_ledger` PostgreSQL table (via Supabase) as an append-only immutable ledger:

- **Append-only**: No UPDATE or DELETE operations in application code
- **Entry types**: `charge` (normal), `refund` (reversal), `adjustment` (correction)
- **Fields**: request_id, org_id, entry_type, amount, currency, tokens_in/out/cached,
  model_id, provider_id, cost_period (YYYY-MM), user_email, agent_name, department_name
- **RLS**: Row-level security enabled, authenticated CRUD policies
- **CSV export**: `/api/v1/audit/ledger/export` endpoint for compliance reporting
- **Period summary**: Aggregated by cost_period for monthly reconciliation

The `ai_requests` table stores the full request lifecycle metadata; the `cost_ledger`
is the financial accounting projection — one ledger entry per successful/cached request.

## Consequences
- Full audit trail for every dollar spent on AI
- Supports chargeback to departments and cost centers
- CSV export for external compliance and reporting tools
- RLS ensures tenant isolation
