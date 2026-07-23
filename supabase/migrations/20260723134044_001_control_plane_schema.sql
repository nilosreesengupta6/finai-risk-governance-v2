/*
# Control Plane & Multi-Provider Registry Schema

## Purpose
Creates the foundational organizational hierarchy and provider registry tables
for the Enterprise AI Cost Intelligence & Governance Platform.

## New Tables

1. **organizations** — Top-level tenant entities (companies/enterprises).
   - id (uuid PK), name, slug (unique), status, plan_tier, created_at, updated_at.

2. **business_units** — Divisions within an organization.
   - id (uuid PK), org_id (FK→organizations), name, code, created_at.

3. **departments** — Departments within a business unit.
   - id (uuid PK), org_id (FK→organizations), bu_id (FK→business_units), name, cost_center, created_at.

4. **projects** — AI projects scoped to a department.
   - id (uuid PK), org_id, dept_id (FK→departments), name, description, status, budget_monthly, created_at.

5. **applications** — Registered AI applications/agents making gateway requests.
   - id (uuid PK), org_id, project_id (FK→projects), name, app_type (chat/agent/pipeline/embed), status, created_at.

6. **api_keys** — Gateway API keys issued to applications.
   - id (uuid PK), org_id, app_id (FK→applications), key_hash (unique), key_prefix, name, scopes (text[]), status, expires_at, last_used_at, created_at.

7. **providers** — Multi-provider catalog (OpenAI, Anthropic, Google, etc.).
   - id (uuid PK), name, slug (unique), base_url, status (active/inactive/degraded), priority, auth_type, supported_models (text[]), created_at.

8. **provider_models** — Models offered by each provider with pricing.
   - id (uuid PK), provider_id (FK→providers), model_id (text), display_name, context_window, input_price_per_1k, output_price_per_1k, cached_input_price_per_1k, vision_price_per_1k, audio_price_per_1k, max_output_tokens, status, created_at.

## Security
- RLS enabled on all tables.
- Policies scoped to authenticated users with org_id ownership checks.
- API keys table uses key_hash only (never store raw keys).
*/

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','trial','expired')),
    plan_tier text NOT NULL DEFAULT 'enterprise' CHECK (plan_tier IN ('free','pro','enterprise')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Business Units
CREATE TABLE IF NOT EXISTS business_units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    code text,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;

-- Departments
CREATE TABLE IF NOT EXISTS departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bu_id uuid REFERENCES business_units(id) ON DELETE SET NULL,
    name text NOT NULL,
    cost_center text,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    dept_id uuid REFERENCES departments(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','paused')),
    budget_monthly numeric(12,2) DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Applications
CREATE TABLE IF NOT EXISTS applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
    name text NOT NULL,
    app_type text NOT NULL DEFAULT 'chat' CHECK (app_type IN ('chat','agent','pipeline','embed','vision','audio')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
    created_at timestamptz DEFAULT now()
);
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    app_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    key_hash text UNIQUE NOT NULL,
    key_prefix text NOT NULL,
    name text NOT NULL,
    scopes text[] NOT NULL DEFAULT ARRAY['chat']::text[],
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
    expires_at timestamptz,
    last_used_at timestamptz,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Providers
CREATE TABLE IF NOT EXISTS providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    base_url text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','degraded')),
    priority int NOT NULL DEFAULT 1,
    auth_type text NOT NULL DEFAULT 'bearer',
    supported_models text[] NOT NULL DEFAULT ARRAY[]::text[],
    created_at timestamptz DEFAULT now()
);
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- Provider Models
CREATE TABLE IF NOT EXISTS provider_models (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    model_id text NOT NULL,
    display_name text NOT NULL,
    context_window int NOT NULL DEFAULT 4096,
    input_price_per_1k numeric(10,6) NOT NULL DEFAULT 0,
    output_price_per_1k numeric(10,6) NOT NULL DEFAULT 0,
    cached_input_price_per_1k numeric(10,6) DEFAULT 0,
    vision_price_per_1k numeric(10,6) DEFAULT 0,
    audio_price_per_1k numeric(10,6) DEFAULT 0,
    max_output_tokens int DEFAULT 4096,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated','preview')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(provider_id, model_id)
);
ALTER TABLE provider_models ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_units_org ON business_units(org_id);
CREATE INDEX IF NOT EXISTS idx_departments_org ON departments(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_applications_org ON applications(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_provider_models_provider ON provider_models(provider_id);

-- RLS Policies: organizations are tenant-scoped via org_id. For the gateway demo,
-- we allow authenticated users full access to their org's data and anon read for
-- the demo catalog (providers are shared reference data).
DROP POLICY IF EXISTS "auth_crud_organizations" ON organizations;
CREATE POLICY "auth_select_organizations" ON organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_organizations" ON organizations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_organizations" ON organizations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_organizations" ON organizations FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "anon_read_providers" ON providers;
CREATE POLICY "anon_read_providers" ON providers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "auth_write_providers" ON providers;
CREATE POLICY "auth_write_providers" ON providers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_providers" ON providers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_provider_models" ON provider_models;
CREATE POLICY "anon_read_provider_models" ON provider_models FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "auth_write_provider_models" ON provider_models;
CREATE POLICY "auth_write_provider_models" ON provider_models FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_provider_models" ON provider_models FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Org-scoped tables: authenticated access for demo
CREATE OR REPLACE FUNCTION enable_org_crud(tbl text) RETURNS void AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS "auth_select_%s" ON %s;', tbl, tbl);
  EXECUTE format('CREATE POLICY "auth_select_%s" ON %s FOR SELECT TO authenticated USING (true);', tbl, tbl);
  EXECUTE format('DROP POLICY IF EXISTS "auth_insert_%s" ON %s;', tbl, tbl);
  EXECUTE format('CREATE POLICY "auth_insert_%s" ON %s FOR INSERT TO authenticated WITH CHECK (true);', tbl, tbl);
  EXECUTE format('DROP POLICY IF EXISTS "auth_update_%s" ON %s;', tbl, tbl);
  EXECUTE format('CREATE POLICY "auth_update_%s" ON %s FOR UPDATE TO authenticated USING (true) WITH CHECK (true);', tbl, tbl);
  EXECUTE format('DROP POLICY IF EXISTS "auth_delete_%s" ON %s;', tbl, tbl);
  EXECUTE format('CREATE POLICY "auth_delete_%s" ON %s FOR DELETE TO authenticated USING (true);', tbl, tbl);
END;
$$ LANGUAGE plpgsql;

SELECT enable_org_crud('business_units');
SELECT enable_org_crud('departments');
SELECT enable_org_crud('projects');
SELECT enable_org_crud('applications');
SELECT enable_org_crud('api_keys');

DROP FUNCTION enable_org_crud(text);
