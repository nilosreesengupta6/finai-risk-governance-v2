# Enterprise AI Cost Intelligence & Governance Platform

A production-grade Clean Modular Monolith that wraps every AI request in a
deterministic 6-stage gateway lifecycle: authentication, company resolution,
model routing, execution with semantic caching, token accounting, and immutable
cost ledger logging — with multi-provider failover, policy enforcement, and
AI-driven optimization recommendations.

## Executive Overview

| Capability                     | Technology                                      |
|-------------------------------|--------------------------------------------------|
| Backend                        | Python 3.11 FastAPI — modular domain packages    |
| Frontend                       | React 18 + TypeScript + Tailwind + Lucide + Recharts |
| Database                        | Supabase (PostgreSQL) — organizations, providers, requests, ledger |
| Cache                          | Redis (semantic response cache + circuit breaker) |
| LLM Providers                  | OpenAI, Anthropic, Google, Mistral, Cohere, Ollama |
| Auth                           | Supabase Auth (email/password) + JWT sessions     |
| Gateway                        | 6-stage lifecycle: auth → resolution → routing → execution → accounting → logging |
| Provider Routing               | Latency-first, Cost-first, Quality-first with circuit breaking |
| Governance                     | Policy engine: cost limits, rate limits, model restrictions, usage quotas |
| Observability                  | Prometheus, Grafana, Loki, Jaeger + structured JSON logging |

## Architecture Diagram

```
┌─────────────────────────── React Frontend ───────────────────────────┐
│  Dashboard · AI Requests · Cost Explorer · Provider Gateway ·       │
│  Policy Engine · Cost Ledger · AI Copilot · Optimization · Health  │
└───────────────────────────────────────┬──────────────────────────────┘
                                        │ REST / SSE
┌───────────────────────────────────────┴──────────────────────────────┐
│                    FastAPI Modular Monolith                          │
│  ┌────────┐ ┌─────────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──┐ │
│  │ core   │ │control_plane│ │gateway│ │analytics │ │governance│ │  │ │
│  │config  │ │orgs+providers│ │6-stage│ │KPIs+trends│ │policies │ │  │ │
│  │logging │ │API keys     │ │lifecycle│ │cost+tokens│ │eval     │ │  │ │
│  │middleware│ │failover    │ │cache  │ │latency   │ │decisions│ │  │ │
│  └────────┘ └─────────────┘ └────────┘ └──────────┘ └──────────┘ │  │ │
│  ┌────────┐ ┌──────────┐ ┌──────────────┐                          │ │
│  │ audit  │ │ copilot  │ │optimization  │                          │ │
│  │ledger  │ │NL queries│ │recommendations│                         │ │
│  │CSV     │ │insights  │ │savings       │                         │ │
│  └────────┘ └──────────┘ └──────────────┘                          │ │
│         Middleware: RequestID · CORS                                 │
└───────┬───────────────────┬───────────────────┬──────────────────────┘
        │                   │                   │
   ┌────┴────┐    ┌────────┴────────┐    ┌──────┴──────┐
   │Supabase │    │     Redis      │    │   Ollama    │
   │Postgres │    │   (cache)      │    │ (local LLM) │
   └─────────┘    └───────────────┘    └─────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │   Multi-Provider Gateway              │
                    │  OpenAI · Anthropic · Google          │
                    │  Mistral · Cohere · Meta (Ollama)     │
                    └───────────────────────────────────────┘
```

## 6-Stage AI Request Lifecycle

```
┌─────────┐   ┌────────────┐   ┌─────────┐   ┌──────────┐   ┌────────────┐   ┌─────────┐
│ Stage 1 │──▶│  Stage 2   │──▶│ Stage 3 │──▶│  Stage 4 │──▶│  Stage 5   │──▶│ Stage 6 │
│  Auth   │   │ Resolution │   │ Routing │   │Execution │   │ Accounting │   │ Logging │
│ API Key │   │ Org + Dept │   │ Model + │   │ + Cache  │   │ Tokens +  │   │ Ledger  │
│ JWT     │   │ App + Proj │   │ Provider│   │ < 15ms   │   │ Cost Calc │   │ + Telem │
└─────────┘   └────────────┘   └─────────┘   └──────────┘   └────────────┘   └─────────┘
```

## Quickstart

### Prerequisites

- Docker + Docker Compose
- Supabase project (already provisioned)

### Launch

```bash
# Configure environment
cp .env.example .env
# Edit .env: set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# Build and start all services
docker compose up --build

# The API is available at http://localhost:8000
# API docs at http://localhost:8000/docs
# The frontend dev server runs automatically
```

### Makefile shortcuts

```bash
make build          # Build all containers
make dev            # Start all services (foreground)
make up             # Start in background
make down           # Stop all services
make test           # Run PyTest suite
make lint           # Run ruff linter
make observability  # Start Prometheus + Grafana + Loki + Jaeger
make clean          # Remove containers + volumes
```

## Module Mapping (v1 → v2)

| v1: FinAI Governance          | v2: AI Cost Intelligence        |
|-------------------------------|----------------------------------|
| Financial Knowledge           | Gateway                          |
| Governance Console            | AI Operations Console            |
| Governed Chat                 | AI Copilot                       |
| Financial Search              | Cost Explorer                    |
| Risk Controls                 | Policy Engine                    |
| Financial Governance          | Cost Governance                  |
| Audit Trail                   | Cost Ledger                      |
| Knowledge                     | Provider Gateway                 |
| Documents                     | AI Requests                      |
| Financial Dashboard           | Executive Dashboard              |

## Project Structure

```
app/
├── core/           # Config, logging, middleware, Supabase client, health
├── control_plane/  # Organizations, providers, API keys, multi-provider registry
├── gateway/        # 6-stage lifecycle, provider abstraction, request routing
├── analytics/      # Cost KPIs, trends, token usage, latency distribution
├── governance/     # Policy engine, evaluations, governance decisions
├── audit/          # Immutable cost ledger, CSV export, audit trail
├── copilot/        # AI cost intelligence assistant
├── optimization/   # Cost optimization recommendations, savings tracking
└── main.py         # FastAPI app + lifespan + router wiring
src/
├── components/     # AppShell, Sidebar, TopBar, reusable UI components
├── pages/          # Dashboard, AIRequests, CostExplorer, Providers, Policies,
│                   # CostLedger, Copilot, Optimization, Health, AuthPage
├── lib/            # API client, Supabase client, auth context
└── types/          # TypeScript API types
observability/      # Prometheus config
```

## License

Enterprise — All rights reserved.
