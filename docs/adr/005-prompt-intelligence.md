# ADR-005: Prompt Intelligence via AI Copilot

## Status
Accepted

## Context
FinOps stakeholders need a natural-language interface to query AI costs, simulate
savings, generate forecasts, and execute optimization actions — without navigating
multiple dashboards or writing SQL.

## Decision
Implement the AI Copilot in `app/copilot/router.py` as a pattern-matching conversational
engine with two endpoints:

**`POST /copilot/query`** — Natural-language FinOps queries:
- Cost analysis ("What's our total AI spend?")
- Top expensive agents ("Show top 10 expensive agents")
- Savings simulation ("Simulate switching from gpt-4o to gpt-4o-mini")
- Forecasting ("Forecast next month's costs")
- Budget tracking ("How's our budget utilization?")
- Optimization ("Show me optimization opportunities")
- Provider/routing queries ("Which providers are we using?")

Each response includes:
- Natural-language answer with specific numbers
- Structured data (KPIs, tables, scenario results)
- Suggested follow-up actions (clickable in the UI)
- Source attribution (which APIs were queried)
- `actionable` flag indicating whether actions can be executed

**`POST /copilot/action`** — Execute recommended actions:
- `apply_recommendation` — Apply an optimization recommendation
- `simulate_savings` — Run a model switch scenario
- `generate_forecast` — Generate a cost forecast
- `create_policy` — Create a governance policy

The copilot delegates to the forecasting engine, optimization engine, and governance
module rather than duplicating logic.

## Consequences
- Non-technical stakeholders can self-serve FinOps queries
- Actions are executable directly from the chat interface
- The copilot is a thin orchestration layer — all business logic lives in domain modules
- Pattern matching is extensible: new query types can be added without touching the UI
