-- Add anon read policies for tables the backend needs to resolve
-- (applications, organizations, projects) so the anon-key backend client
-- can join names for display in the Copilot and dashboards.

-- Applications: add anon read
DROP POLICY IF EXISTS "anon_read_applications" ON applications;
CREATE POLICY "anon_read_applications" ON applications FOR SELECT
  TO anon, authenticated USING (true);

-- Organizations: add anon read
DROP POLICY IF EXISTS "anon_read_organizations" ON organizations;
CREATE POLICY "anon_read_organizations" ON organizations FOR SELECT
  TO anon, authenticated USING (true);

-- Projects: add anon read
DROP POLICY IF EXISTS "anon_read_projects" ON projects;
CREATE POLICY "anon_read_projects" ON projects FOR SELECT
  TO anon, authenticated USING (true);

-- Cost ledger: add anon read (needed for audit/ledger endpoint)
DROP POLICY IF EXISTS "anon_read_cost_ledger" ON cost_ledger;
CREATE POLICY "anon_read_cost_ledger" ON cost_ledger FOR SELECT
  TO anon, authenticated USING (true);

-- Policies: add anon read
DROP POLICY IF EXISTS "anon_read_policies" ON policies;
CREATE POLICY "anon_read_policies" ON policies FOR SELECT
  TO anon, authenticated USING (true);

-- Optimization recommendations: add anon read
DROP POLICY IF EXISTS "anon_read_optimization_recommendations" ON optimization_recommendations;
CREATE POLICY "anon_read_optimization_recommendations" ON optimization_recommendations FOR SELECT
  TO anon, authenticated USING (true);

-- Optimization recommendations: add anon write (for insert/update from backend)
DROP POLICY IF EXISTS "anon_write_optimization_recommendations" ON optimization_recommendations;
CREATE POLICY "anon_write_optimization_recommendations" ON optimization_recommendations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_optimization_recommendations" ON optimization_recommendations;
CREATE POLICY "anon_update_optimization_recommendations" ON optimization_recommendations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Budgets: add anon write
DROP POLICY IF EXISTS "anon_write_budgets" ON budgets;
CREATE POLICY "anon_write_budgets" ON budgets FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_budgets" ON budgets;
CREATE POLICY "anon_update_budgets" ON budgets FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Cost forecasts: add anon write
DROP POLICY IF EXISTS "anon_write_cost_forecasts" ON cost_forecasts;
CREATE POLICY "anon_write_cost_forecasts" ON cost_forecasts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Policies: add anon write (for copilot create_policy action)
DROP POLICY IF EXISTS "anon_write_policies" ON policies;
CREATE POLICY "anon_write_policies" ON policies FOR INSERT
  TO anon, authenticated WITH CHECK (true);
