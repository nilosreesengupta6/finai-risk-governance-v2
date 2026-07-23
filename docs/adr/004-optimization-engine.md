# ADR-004: Automated Cost Optimization Engine (Azure Advisor-Style)

## Status
Accepted

## Context
Enterprises need automated, actionable cost optimization recommendations — similar to
Azure Advisor — that analyze usage patterns and surface savings opportunities without
manual investigation.

## Decision
Implement the optimization engine in `app/optimization/router.py` with five
recommendation types:

1. **model_swap** — Detects premium models used for low-complexity queries and
   recommends cheaper alternatives (e.g., GPT-4o → GPT-4o-mini, saving ~94%)
2. **cache_enable** — Detects low cache hit rates (< 20%) and recommends enabling
   semantic caching, projecting 25% savings on uncached requests
3. **routing_change** — Detects expensive routing strategies (quality_first costing
   2x+ vs cost_first) and recommends shifting non-critical requests
4. **budget_alert** — Detects projects approaching budget limits (> 80%) and
   recommends increasing budget or implementing stricter policies
5. **usage_consolidation** — Detects spend spread across 3+ providers and recommends
   consolidating for volume discounts (~5% savings)

Each recommendation includes:
- Title, description with specific numbers
- Potential monthly savings ($)
- Confidence score (0-100%)
- Affected scope (JSON metadata)
- Status lifecycle: pending → applied / dismissed

The engine deduplicates against existing recommendations by title to avoid noise.

## Consequences
- FinOps teams get a prioritized, actionable savings backlog
- Recommendations are data-driven, not heuristic-only
- Apply/dismiss workflow tracks realized vs dismissed savings
- Integrates with the AI Copilot for natural-language interaction
