// TypeScript types mirroring the FastAPI backend models.

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan_tier: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessUnit {
  id: string;
  org_id: string;
  name: string;
  code: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  org_id: string;
  bu_id: string | null;
  name: string;
  cost_center: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  org_id: string;
  dept_id: string | null;
  name: string;
  description: string | null;
  status: string;
  budget_monthly: number;
  created_at: string;
}

export interface Application {
  id: string;
  org_id: string;
  project_id: string | null;
  name: string;
  app_type: string;
  status: string;
  created_at: string;
}

export interface APIKey {
  id: string;
  org_id: string;
  app_id: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  status: string;
  created_at: string;
  last_used_at: string | null;
}

export interface Provider {
  id: string;
  name: string;
  slug: string;
  base_url: string;
  status: string;
  priority: number;
  auth_type: string;
  supported_models: string[];
  created_at: string;
}

export interface ProviderModel {
  id: string;
  provider_id: string;
  model_id: string;
  display_name: string;
  context_window: number;
  input_price_per_1k: number;
  output_price_per_1k: number;
  cached_input_price_per_1k: number;
  vision_price_per_1k: number;
  audio_price_per_1k: number;
  max_output_tokens: number;
  status: string;
}

export interface ProviderStatus {
  id: string;
  name: string;
  slug: string;
  status: string;
  priority: number;
  model_count: number;
  avg_latency_ms: number;
  failover_rank: number;
  active_requests: number;
}

export interface AIRequest {
  id: string;
  org_id: string;
  app_id: string | null;
  project_id: string | null;
  provider_id: string | null;
  model_id: string;
  stage: string;
  status: string;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  total_tokens: number;
  input_cost: number;
  output_cost: number;
  cached_cost: number;
  total_cost: number;
  latency_ms: number;
  cache_hit: boolean;
  routing_strategy: string | null;
  triggered_policies: string[];
  blocked_reason: string | null;
  created_at: string;
}

export interface CostLedgerEntry {
  id: string;
  request_id: string | null;
  org_id: string;
  entry_type: string;
  amount: number;
  currency: string;
  tokens_in: number;
  tokens_out: number;
  tokens_cached: number;
  model_id: string | null;
  provider_id: string | null;
  cost_period: string;
  created_at: string;
}

export interface Policy {
  id: string;
  org_id: string;
  name: string;
  policy_type: string;
  scope: string;
  scope_id: string | null;
  rule_config: Record<string, unknown>;
  status: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface PolicyEvaluation {
  policy_id: string;
  policy_name: string;
  policy_type: string;
  result: string;
  reason: string;
  rule_config: Record<string, unknown>;
}

export interface GovernanceDecision {
  decision: string;
  risk_tier: string;
  evaluations: PolicyEvaluation[];
  triggered_policies: string[];
  blocked: boolean;
  blocked_reason: string | null;
}

export interface OptimizationRecommendation {
  id: string;
  org_id: string;
  recommendation_type: string;
  title: string;
  description: string | null;
  potential_savings: number;
  confidence_score: number;
  status: string;
  affected_scope: Record<string, unknown>;
  created_at: string;
}

export interface KPIs {
  total_cost: number;
  total_requests: number;
  successful_requests: number;
  blocked_requests: number;
  failed_requests: number;
  cached_requests: number;
  cache_hit_rate: number;
  avg_latency_ms: number;
  total_tokens: number;
  cost_per_request: number;
  tokens_per_request: number;
}

export interface CostTrendPoint {
  date: string;
  cost: number;
  requests: number;
}

export interface CostByModel {
  model: string;
  cost: number;
  tokens: number;
  requests: number;
}

export interface CostByProvider {
  provider_id: string;
  provider: string;
  cost: number;
  requests: number;
}

export interface TokenUsagePoint {
  date: string;
  prompt: number;
  completion: number;
  cached: number;
}

export interface LatencyBucket {
  range: string;
  count: number;
}

export interface CopilotResponse {
  answer: string;
  data: Record<string, unknown>;
  suggested_actions: string[];
  sources: string[];
}

export interface ChatResponse {
  id: string;
  model: string;
  provider: string;
  choices: Array<Record<string, unknown>>;
  usage: Record<string, number>;
  cost: Record<string, number>;
  latency_ms: number;
  cache_hit: boolean;
  routing_strategy: string;
  triggered_policies: string[];
  stage: string;
  status: string;
}

export interface LifecycleTrace {
  request_id: string;
  model: string;
  status: string;
  stage: string;
  cache_hit: boolean;
  routing_strategy: string;
  latency_ms: number;
  total_cost: number;
  tokens: {
    prompt: number;
    completion: number;
    cached: number;
    total: number;
  };
  cost_breakdown: {
    input: number;
    output: number;
    cached: number;
    total: number;
  };
  triggered_policies: string[];
  blocked_reason: string | null;
  created_at: string;
}

export interface LedgerSummary {
  period: string;
  total_amount: number;
  total_tokens_in: number;
  total_tokens_out: number;
  entry_count: number;
}

export interface SavingsSummary {
  potential_savings: number;
  realized_savings: number;
  dismissed_savings: number;
  pending_count: number;
  applied_count: number;
  dismissed_count: number;
  total_recommendations: number;
}
