/*
# Cost Ledger Enrichment & Forecasting Schema

## Purpose
Extends the cost_ledger with user/agent fields and creates a cost_forecasts table
for weekly/monthly/quarterly projections with Best/Expected/Worst case intervals.

## Changes

1. **cost_ledger** (modified) — Added columns:
   - user_email (text, nullable) — the user who triggered the request
   - agent_name (text, nullable) — the AI agent/application name
   - department_name (text, nullable) — resolved department name at log time

2. **cost_forecasts** (new) — Stores forecast projections:
   - id (uuid PK), org_id (FK→organizations)
   - period_type (weekly/monthly/quarterly)
   - target_date (date the forecast covers)
   - best_case, expected_case, worst_case (numeric projected spend)
   - confidence_interval_low, confidence_interval_high (numeric)
   - confidence_score (numeric 0-100)
   - model_metadata (jsonb — algorithm, data points, assumptions)
   - created_at

3. **budgets** (new) — Monthly budget tracking per project/org:
   - id (uuid PK), org_id, project_id (nullable), department_id (nullable)
   - budget_limit, actual_spend, forecast_spend, utilization_pct
   - period (YYYY-MM), status (on_track/warning/critical/exceeded)
   - created_at, updated_at

## Security
- RLS enabled on new tables.
- Authenticated CRUD policies applied.
*/

-- Extend cost_ledger with user/agent/department fields
ALTER TABLE cost_ledger ADD COLUMN IF NOT EXISTS user_email text;
ALTER TABLE cost_ledger ADD COLUMN IF NOT EXISTS agent_name text;
ALTER TABLE cost_ledger ADD COLUMN IF NOT EXISTS department_name text;

-- Cost Forecasts table
CREATE TABLE IF NOT EXISTS cost_forecasts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_type text NOT NULL CHECK (period_type IN ('weekly','monthly','quarterly')),
    target_date date NOT NULL,
    best_case numeric(12,2) NOT NULL DEFAULT 0,
    expected_case numeric(12,2) NOT NULL DEFAULT 0,
    worst_case numeric(12,2) NOT NULL DEFAULT 0,
    confidence_interval_low numeric(12,2) NOT NULL DEFAULT 0,
    confidence_interval_high numeric(12,2) NOT NULL DEFAULT 0,
    confidence_score numeric(5,2) NOT NULL DEFAULT 0,
    model_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE cost_forecasts ENABLE ROW LEVEL SECURITY;

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
    department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
    budget_limit numeric(12,2) NOT NULL DEFAULT 0,
    actual_spend numeric(12,2) NOT NULL DEFAULT 0,
    forecast_spend numeric(12,2) NOT NULL DEFAULT 0,
    utilization_pct numeric(5,2) NOT NULL DEFAULT 0,
    period text NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
    status text NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track','warning','critical','exceeded')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cost_forecasts_org ON cost_forecasts(org_id);
CREATE INDEX IF NOT EXISTS idx_cost_forecasts_period ON cost_forecasts(period_type, target_date);
CREATE INDEX IF NOT EXISTS idx_budgets_org ON budgets(org_id);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period);

-- RLS Policies
CREATE OR REPLACE FUNCTION enable_table_crud2(tbl text, allow_anon_read boolean DEFAULT false) RETURNS void AS $$
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

SELECT enable_table_crud2('cost_forecasts', true);
SELECT enable_table_crud2('budgets', true);

DROP FUNCTION enable_table_crud2(text, boolean);

-- Backfill user_email and agent_name on existing ledger entries
UPDATE cost_ledger cl
SET
  user_email = COALESCE(cl.user_email, 'demo@acme-financial.com'),
  agent_name = COALESCE(cl.agent_name, CASE
    WHEN cl.request_id IN (SELECT id FROM ai_requests WHERE app_id IN (SELECT id FROM applications WHERE name = 'Risk Copilot Agent'))
    THEN 'Risk Copilot Agent'
    WHEN cl.request_id IN (SELECT id FROM ai_requests WHERE app_id IN (SELECT id FROM applications WHERE name = 'Portfolio Commentator'))
    THEN 'Portfolio Commentator'
    ELSE 'Unknown Agent'
  END),
  department_name = COALESCE(cl.department_name, CASE
    WHEN cl.request_id IN (SELECT id FROM ai_requests WHERE project_id IN (SELECT id FROM projects WHERE name = 'AI Risk Copilot'))
    THEN 'Quantitative Research'
    WHEN cl.request_id IN (SELECT id FROM ai_requests WHERE project_id IN (SELECT id FROM projects WHERE name = 'Portfolio Insights Engine'))
    THEN 'Portfolio Analytics'
    ELSE 'General'
  END);

-- Seed budgets for the demo org
INSERT INTO budgets (org_id, project_id, budget_limit, actual_spend, forecast_spend, utilization_pct, period, status)
SELECT o.id, p.id, p.budget_monthly,
  COALESCE((SELECT SUM(total_cost) FROM ai_requests WHERE project_id = p.id), 0),
  COALESCE((SELECT SUM(total_cost) FROM ai_requests WHERE project_id = p.id), 0) * 1.15,
  CASE WHEN p.budget_monthly > 0
    THEN LEAST(100, (COALESCE((SELECT SUM(total_cost) FROM ai_requests WHERE project_id = p.id), 0) / p.budget_monthly) * 100)
    ELSE 0
  END,
  to_char(now(), 'YYYY-MM'),
  CASE
    WHEN COALESCE((SELECT SUM(total_cost) FROM ai_requests WHERE project_id = p.id), 0) > p.budget_monthly THEN 'exceeded'
    WHEN COALESCE((SELECT SUM(total_cost) FROM ai_requests WHERE project_id = p.id), 0) > p.budget_monthly * 0.8 THEN 'warning'
    ELSE 'on_track'
  END
FROM organizations o, projects p
WHERE o.slug = 'acme-financial' AND p.org_id = o.id
ON CONFLICT DO NOTHING;
