# Enterprise AI Cost Intelligence & Governance Platform

A production-grade Clean Modular Monolith that wraps every AI request in a
deterministic 6-stage gateway lifecycle: authentication, company resolution,
model routing, execution with semantic caching, token accounting, and immutable
cost ledger logging — with multi-provider failover, policy enforcement,
AI-driven optimization recommendations, forecasting, and an actionable
FinOps copilot.

## Executive Overview

| Capability                     | Technology                                      |
|-------------------------------|--------------------------------------------------|
| Backend                        | Python 3.11 FastAPI — modular domain packages    |
| Frontend                       | React 18 + TypeScript + Tailwind + Lucide + Recharts |
| Database                        | Supabase (PostgreSQL) — organizations, providers, requests, ledger, forecasts, budgets |
| Cache                          | Redis (semantic response cache + circuit breaker) |
| LLM Providers                  | OpenAI, Anthropic, Google, Mistral, Cohere, Ollama |
| Auth                           | Supabase Auth (email/password) + JWT sessions     |
| Gateway                        | 6-stage lifecycle: auth → resolution → routing → execution → accounting → logging |
| Provider Routing               | Latency-first, Cost-first, Quality-first with circuit breaking |
| Governance                     | Policy engine: cost limits, rate limits, model restrictions, usage quotas |
| Forecasting                    | Linear regression with Best/Expected/Worst case confidence intervals |
| Optimization                   | Azure Advisor-style: model swap, cache, routing, budget, consolidation |
| Copilot                        | Actionable FinOps assistant with query + action execution |
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
│  ┌────────┐ ┌─────────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐     │
│  │ core   │ │control_plane│ │gateway│ │analytics │ │governance│     │
│  │config  │ │orgs+providers│ │6-stage│ │KPIs+trends│ │policies │     │
│  │logging │ │API keys     │ │lifecycle│ │forecast  │ │eval     │     │
│  │middleware│ │failover   │ │cache  │ │budgets   │ │decisions│     │
│  └────────┘ └─────────────┘ └────────┘ └──────────┘ └──────────┘     │
│  ┌────────┐ ┌──────────┐ ┌──────────────┐ ┌─────────────┐            │
│  │ audit  │ │ copilot  │ │optimization  │ │forecasting  │            │
│  │ledger  │ │FinOps QA │ │Advisor-style │ │projections  │            │
│  │CSV     │ │actions   │ │savings       │ │scenarios    │            │
│  └────────┘ └──────────┘ └──────────────┘ └─────────────┘            │
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

## Advanced Features

### Actionable AI Copilot
- Natural-language FinOps queries ("Show top 10 expensive agents")
- Savings simulation ("Simulate switching from gpt-4o to gpt-4o-mini")
- Forecast generation ("Forecast next month's costs")
- Budget tracking ("How's our budget utilization?")
- Action execution: apply recommendations, create policies, generate forecasts

### Forecasting & Scenario Analysis
- Weekly, monthly, and quarterly projections
- Best/Expected/Worst case with 95% confidence intervals
- Linear regression on 30-day daily spend with R² confidence scoring
- Model switch scenario analysis with quality impact notes

### Automated Cost Optimization (Azure Advisor-Style)
- **model_swap**: Switch premium models to cheaper alternatives for low-complexity queries
- **cache_enable**: Enable semantic caching when hit rate < 20%
- **routing_change**: Shift from quality_first to cost_first for non-critical requests
- **budget_alert**: Alert when projects approach budget limits
- **usage_consolidation**: Consolidate provider spend for volume discounts

### Executive Dashboard KPIs
- Total Spend, Today's Spend, Monthly Spend, Monthly Forecast
- Budget Utilization with per-project health cards
- Total Requests, Avg Latency, Cache Hit Rate
- Cost per Request, Tokens per Request

## Architecture Decision Records (ADRs)

| ADR   | Title                                      | Path                          |
|-------|--------------------------------------------|-------------------------------|
| ADR-001 | LiteLLM-Style Gateway with 6-Stage Lifecycle | `docs/adr/001-litellm-gateway.md` |
| ADR-002 | Immutable PostgreSQL Cost Ledger              | `docs/adr/002-cost-ledger.md`     |
| ADR-003 | Linear Regression Forecasting                | `docs/adr/003-forecasting.md`     |
| ADR-004 | Automated Cost Optimization Engine           | `docs/adr/004-optimization-engine.md` |
| ADR-005 | Prompt Intelligence via AI Copilot           | `docs/adr/005-prompt-intelligence.md` |

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
├── copilot/        # Actionable FinOps assistant with query + action execution
├── optimization/   # Azure Advisor-style recommendations, scenario analysis
├── forecasting/    # Cost projections, confidence intervals, budget tracking
└── main.py         # FastAPI app + lifespan + router wiring
src/
├── components/     # AppShell, Sidebar, TopBar, reusable UI components
├── pages/          # Dashboard, AIRequests, CostExplorer, Providers, Policies,
│                   # CostLedger, Copilot, Optimization, Health, AuthPage
├── lib/            # API client, Supabase client, auth context
└── types/          # TypeScript API types
docs/adr/           # Architecture Decision Records (001-005)
observability/      # Prometheus config
```

## API Endpoints

### Control Plane (`/api/v1/control-plane`)
- `GET/POST /organizations` — Organization CRUD
- `GET /providers` — Multi-provider catalog
- `GET /providers/status` — Live provider status with failover matrix
- `GET/POST /api-keys` — API key management

### Gateway (`/api/v1/gateway`)
- `POST /chat/completions` — Process AI request through 6-stage lifecycle
- `GET /requests` — Request history with filters
- `GET /lifecycle/trace/{id}` — Full lifecycle trace for a request
- `GET /models` — All available models with pricing

### Analytics (`/api/v1/analytics`)
- `GET /kpis` — Executive KPIs (total, today, monthly, forecast, budget)
- `GET /cost-trend` — Daily cost trend
- `GET /cost-by-model` — Cost breakdown by model
- `GET /cost-by-provider` — Cost breakdown by provider
- `GET /token-usage` — Token usage over time
- `GET /latency-distribution` — Latency histogram

### Governance (`/api/v1/governance`)
- `GET/POST /policies` — Policy CRUD
- `POST /evaluate` — Evaluate a request against policies

### Audit (`/api/v1/audit`)
- `GET /ledger` — Immutable cost ledger entries
- `GET /ledger/summary` — Summary by cost period
- `GET /ledger/export` — CSV export
- `GET /requests` — Audit trail

### Copilot (`/api/v1/copilot`)
- `POST /query` — Natural-language FinOps query
- `POST /action` — Execute a recommended action

### Optimization (`/api/v1/optimization`)
- `GET /recommendations` — List recommendations
- `PATCH /recommendations/{id}` — Apply/dismiss
- `GET /savings` — Savings summary
- `POST /generate` — Generate Azure Advisor-style recommendations
- `POST /scenario` — Simulate model switch savings

### Forecasting (`/api/v1/forecasting`)
- `POST /generate` — Generate cost forecast
- `GET /forecasts` — List stored forecasts
- `POST /scenario` — Model switch scenario analysis
- `GET /budgets` — Budget tracking with utilization
- `POST /budgets/refresh` — Recalculate budget utilization

## License

Enterprise — All rights reserved.
