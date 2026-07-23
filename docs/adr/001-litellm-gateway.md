# ADR-001: LiteLLM-Style Gateway with 6-Stage Request Lifecycle

## Status
Accepted

## Context
The platform needs a unified gateway that intercepts every AI request, routes it to the
appropriate provider, accounts for token costs, and logs to an immutable ledger — all
while enforcing governance policies and maintaining sub-15ms cache hits.

## Decision
Implement a 6-stage pipeline architecture in `app/gateway/lifecycle.py`:

1. **Authentication & Authorization** — API key hash validation or JWT
2. **Company & Department Resolution** — org → app → project → department hierarchy
3. **Model Routing & Provider Selection** — latency-first, cost-first, or quality-first
   with automatic circuit breaking (5 failures opens the circuit for 60s)
4. **Request Execution & Semantic Response Cache** — SHA-256 hash of model+messages+temperature,
   cache lookup before provider call, target < 15ms hit via Redis
5. **Token Accounting & Cost Calculation** — prompt, completion, cached, vision, audio tokens
   priced per provider model rates
6. **Immutable Cost Ledger Logging** — append-only `cost_ledger` entry + telemetry stream

A Provider Abstraction Layer (`app/gateway/provider_abstraction.py`) normalizes OpenAI,
Anthropic, Google, and Ollama protocols behind a unified `ProviderClient` interface with
retry (3 attempts, exponential backoff), rate limiting, and failover.

## Consequences
- Every request is fully traceable through all 6 stages
- Cost accounting is deterministic and auditable
- Circuit breaking prevents cascading provider failures
- New providers can be added by implementing `ProviderClient` and registering in `PROVIDER_REGISTRY`
