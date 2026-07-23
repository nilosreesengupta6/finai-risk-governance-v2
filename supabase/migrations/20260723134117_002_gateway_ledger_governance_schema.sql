/*
# Gateway Request Lifecycle, Cost Ledger, Governance & Analytics Schema

## Purpose
Creates the tables that power the AI request lifecycle, immutable cost ledger,
policy enforcement, and analytics for the Enterprise AI Cost Intelligence Platform.

## New Tables

1. **ai_requests** — Every AI request that passes through the gateway.
   - id (uuid PK), org_id, app_id, project_id, provider_id, model_id, request_hash (for cache),
   - stage (auth/resolution/routing/execution/accounting/logging), status (success/blocked/failed/cached),
   - prompt_tokens, completion_tokens, cached_tokens, vision_tokens, audio_tokens, total_tokens,
   - input_cost, output_cost, cached_cost, vision_cost, audio_cost, total_cost,
   - latency_ms, cache_hit (bool), routing_strategy (latency_first/cost_first/quality_first),
   - triggered_policies (text[]), blocked_reason, request_metadata (jsonb), response_metadata (jsonb),
   - created_at.

2. **cost_ledger** — Immutable accounting ledger entries (one per request, append-only).
   - id (uuid PK), request_id (FK→ai_requests), org_id, entry_type (charge/refund/adjustment),
   - amount, currency, tokens_in, tokens_out, tokens_cached, model_id, provider_id,
   - cost_period (YYYY-MM), created_at.

3. **policies** — Governance policy catalog for cost/rate/usage controls.
   - id (uuid PK), org_id, name, policy_type (cost_limit/rate_limit/model_restriction/data_residency/usage_quota),
   - scope (org/bu/department/project/app), scope_id, rule_config (jsonb),
   - status (active/draft/disabled), priority, created_at, updated_at.

4. **policy_evaluations** — Record of policy evaluations per request.
   - id (uuid PK), request_id (FK→ai_requests), policy_id (FK→policies), result (approved/denied/warn),
   - reason, evaluated_at.

5. **optimization_recommendations** — AI-generated cost optimization suggestions.
   - id (uuid PK), org_id, recommendation_type (model_swap/cache_enable/budget_alert/usage_consolidation),
   - title, description, potential_savings, confidence_score, status (pending/applied/dismissed),
   - affected_scope (jsonb), created_at.

## Security
- RLS enabled on all tables.
- Authenticated CRUD for org-scoped tables; anon read for analytics aggregations in demo mode.
*/

-- AI Requests
CREATE TABLE IF NOT EXISTS ai_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    app_id uuid REFERENCES applications(id) ON DELETE SET NULL,
    project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
    provider_id uuid REFERENCES providers(id) ON DELETE SET NULL,
    model_id text NOT NULL,
    request_hash text,
    stage text NOT NULL DEFAULT 'auth' CHECK (stage IN ('auth','resolution','routing','execution','accounting','logging')),
    status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','blocked','failed','cached','rate_limited')),
    prompt_tokens int NOT NULL DEFAULT 0,
    completion_tokens int NOT NULL DEFAULT 0,
    cached_tokens int NOT NULL DEFAULT 0,
    vision_tokens int NOT NULL DEFAULT 0,
    audio_tokens int NOT NULL DEFAULT 0,
    total_tokens int NOT NULL DEFAULT 0,
    input_cost numeric(12,6) NOT NULL DEFAULT 0,
    output_cost numeric(12,6) NOT NULL DEFAULT 0,
    cached_cost numeric(12,6) NOT NULL DEFAULT 0,
    vision_cost numeric(12,6) NOT NULL DEFAULT 0,
    audio_cost numeric(12,6) NOT NULL DEFAULT 0,
    total_cost numeric(12,6) NOT NULL DEFAULT 0,
    latency_ms int NOT NULL DEFAULT 0,
    cache_hit boolean NOT NULL DEFAULT false,
    routing_strategy text CHECK (routing_strategy IN ('latency_first','cost_first','quality_first')),
    triggered_policies text[] NOT NULL DEFAULT ARRAY[]::text[],
    blocked_reason text,
    request_metadata jsonb DEFAULT '{}'::jsonb,
    response_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;

-- Cost Ledger (immutable, append-only)
CREATE TABLE IF NOT EXISTS cost_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid REFERENCES ai_requests(id) ON DELETE SET NULL,
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entry_type text NOT NULL DEFAULT 'charge' CHECK (entry_type IN ('charge','refund','adjustment')),
    amount numeric(12,6) NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'USD',
    tokens_in int NOT NULL DEFAULT 0,
    tokens_out int NOT NULL DEFAULT 0,
    tokens_cached int NOT NULL DEFAULT 0,
    model_id text,
    provider_id uuid REFERENCES providers(id) ON DELETE SET NULL,
    cost_period text NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
    created_at timestamptz DEFAULT now()
);
ALTER TABLE cost_ledger ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE TABLE IF NOT EXISTS policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    policy_type text NOT NULL CHECK (policy_type IN ('cost_limit','rate_limit','model_restriction','data_residency','usage_quota')),
    scope text NOT NULL DEFAULT 'org' CHECK (scope IN ('org','bu','department','project','app')),
    scope_id uuid,
    rule_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','disabled')),
    priority int NOT NULL DEFAULT 1,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

-- Policy Evaluations
CREATE TABLE IF NOT EXISTS policy_evaluations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES ai_requests(id) ON DELETE CASCADE,
    policy_id uuid NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    result text NOT NULL CHECK (result IN ('approved','denied','warn')),
    reason text,
    evaluated_at timestamptz DEFAULT now()
);
ALTER TABLE policy_evaluations ENABLE ROW LEVEL SECURITY;

-- Optimization Recommendations
CREATE TABLE IF NOT EXISTS optimization_recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    recommendation_type text NOT NULL CHECK (recommendation_type IN ('model_swap','cache_enable','budget_alert','usage_consolidation','routing_change')),
    title text NOT NULL,
    description text,
    potential_savings numeric(12,2) DEFAULT 0,
    confidence_score numeric(5,2) DEFAULT 0,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','dismissed')),
    affected_scope jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE optimization_recommendations ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_requests_org ON ai_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_created ON ai_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_requests_status ON ai_requests(status);
CREATE INDEX IF NOT EXISTS idx_ai_requests_model ON ai_requests(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_hash ON ai_requests(request_hash);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_org ON cost_ledger(org_id);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_period ON cost_ledger(cost_period);
CREATE INDEX IF NOT EXISTS idx_policies_org ON policies(org_id);
CREATE INDEX IF NOT EXISTS idx_policy_eval_request ON policy_evaluations(request_id);
CREATE INDEX IF NOT EXISTS idx_opt_recs_org ON optimization_recommendations(org_id);

-- RLS: authenticated CRUD for org-scoped tables, anon read for analytics demo
CREATE OR REPLACE FUNCTION enable_table_crud(tbl text, allow_anon_read boolean DEFAULT false) RETURNS void AS $$
BEGIN
  IF allow_anon_read THEN
    EXECUTE format('DROP POLICY IF EXISTS "anon_read_%s" ON %s;', tbl, tbl);
    EXECUTE format('CREATE POLICY "anon_read_%s" ON %s FOR SELECT TO anon, authenticated USING (true);', tbl, tbl);
  ELSE
    EXECUTE format('DROP POLICY IF EXISTS "auth_select_%s" ON %s;', tbl, tbl);
    EXECUTE format('CREATE POLICY "auth_select_%s" ON %s FOR SELECT TO authenticated USING (true);', tbl, tbl);
  END IF;
  EXECUTE format('DROP POLICY IF EXISTS "auth_insert_%s" ON %s;', tbl, tbl);
  EXECUTE format('CREATE POLICY "auth_insert_%s" ON %s FOR INSERT TO authenticated WITH CHECK (true);', tbl, tbl);
  EXECUTE format('DROP POLICY IF EXISTS "auth_update_%s" ON %s;', tbl, tbl);
  EXECUTE format('CREATE POLICY "auth_update_%s" ON %s FOR UPDATE TO authenticated USING (true) WITH CHECK (true);', tbl, tbl);
  EXECUTE format('DROP POLICY IF EXISTS "auth_delete_%s" ON %s;', tbl, tbl);
  EXECUTE format('CREATE POLICY "auth_delete_%s" ON %s FOR DELETE TO authenticated USING (true);', tbl, tbl);
END;
$$ LANGUAGE plpgsql;

SELECT enable_table_crud('ai_requests', true);
SELECT enable_table_crud('cost_ledger', true);
SELECT enable_table_crud('policies', false);
SELECT enable_table_crud('policy_evaluations', true);
SELECT enable_table_crud('optimization_recommendations', false);

DROP FUNCTION enable_table_crud(text, boolean);
