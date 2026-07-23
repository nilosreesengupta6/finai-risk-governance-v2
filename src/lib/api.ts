// API client for the FastAPI backend. Uses the Vite proxy or direct fetch.

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`API ${resp.status}: ${text || resp.statusText}`);
  }
  return resp.json() as Promise<T>;
}

export const api = {
  // Control Plane
  getOrganizations: () => apiFetch<any[]>('/control-plane/organizations'),
  getProviders: () => apiFetch<any[]>('/control-plane/providers'),
  getProviderStatus: () => apiFetch<any[]>('/control-plane/providers/status'),
  getProviderModels: (providerId: string) =>
    apiFetch<any[]>(`/control-plane/providers/${providerId}/models`),
  getApplications: (orgId?: string) =>
    apiFetch<any[]>(`/control-plane/applications${orgId ? `?org_id=${orgId}` : ''}`),
  getProjects: (orgId?: string) =>
    apiFetch<any[]>(`/control-plane/projects${orgId ? `?org_id=${orgId}` : ''}`),
  getBusinessUnits: (orgId?: string) =>
    apiFetch<any[]>(`/control-plane/business-units${orgId ? `?org_id=${orgId}` : ''}`),
  getDepartments: (orgId?: string) =>
    apiFetch<any[]>(`/control-plane/departments${orgId ? `?org_id=${orgId}` : ''}`),
  getApiKeys: (orgId?: string) =>
    apiFetch<any[]>(`/control-plane/api-keys${orgId ? `?org_id=${orgId}` : ''}`),

  // Gateway
  getRequests: (params?: { org_id?: string; status?: string; model?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.org_id) qs.set('org_id', params.org_id);
    if (params?.status) qs.set('status', params.status);
    if (params?.model) qs.set('model', params.model);
    if (params?.limit) qs.set('limit', String(params.limit));
    return apiFetch<any[]>(`/gateway/requests?${qs}`);
  },
  getRequest: (id: string) => apiFetch<any>(`/gateway/requests/${id}`),
  getLifecycleTrace: (id: string) => apiFetch<any>(`/gateway/lifecycle/trace/${id}`),
  getModels: () => apiFetch<any[]>('/gateway/models'),
  sendChat: (body: any) =>
    apiFetch<any>('/gateway/chat/completions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Analytics
  getKPIs: (orgId?: string) =>
    apiFetch<any>(`/analytics/kpis${orgId ? `?org_id=${orgId}` : ''}`),
  getCostTrend: (orgId?: string, days = 30) =>
    apiFetch<any[]>(`/analytics/cost-trend?days=${days}${orgId ? `&org_id=${orgId}` : ''}`),
  getCostByModel: (orgId?: string) =>
    apiFetch<any[]>(`/analytics/cost-by-model${orgId ? `?org_id=${orgId}` : ''}`),
  getCostByProvider: (orgId?: string) =>
    apiFetch<any[]>(`/analytics/cost-by-provider${orgId ? `?org_id=${orgId}` : ''}`),
  getTokenUsage: (orgId?: string, days = 30) =>
    apiFetch<any[]>(`/analytics/token-usage?days=${days}${orgId ? `&org_id=${orgId}` : ''}`),
  getLatencyDistribution: (orgId?: string) =>
    apiFetch<any[]>(`/analytics/latency-distribution${orgId ? `?org_id=${orgId}` : ''}`),

  // Governance
  getPolicies: (orgId?: string, status?: string) => {
    const qs = new URLSearchParams();
    if (orgId) qs.set('org_id', orgId);
    if (status) qs.set('status', status);
    return apiFetch<any[]>(`/governance/policies?${qs}`);
  },
  createPolicy: (body: any) =>
    apiFetch<any>('/governance/policies', { method: 'POST', body: JSON.stringify(body) }),
  evaluateRequest: (orgId: string, modelId: string, estimatedCost = 0) =>
    apiFetch<any>(`/governance/evaluate?org_id=${orgId}&model_id=${modelId}&estimated_cost=${estimatedCost}`, {
      method: 'POST',
    }),

  // Audit
  getLedger: (params?: { org_id?: string; entry_type?: string; cost_period?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.org_id) qs.set('org_id', params.org_id);
    if (params?.entry_type) qs.set('entry_type', params.entry_type);
    if (params?.cost_period) qs.set('cost_period', params.cost_period);
    if (params?.limit) qs.set('limit', String(params.limit));
    return apiFetch<any[]>(`/audit/ledger?${qs}`);
  },
  getLedgerSummary: (orgId?: string) =>
    apiFetch<any[]>(`/audit/ledger/summary${orgId ? `?org_id=${orgId}` : ''}`),
  getLedgerCsvUrl: (orgId?: string) =>
    `${API_BASE}/audit/ledger/export${orgId ? `?org_id=${orgId}` : ''}`,

  // Copilot
  queryCopilot: (query: string, orgId: string) =>
    apiFetch<any>('/copilot/query', {
      method: 'POST',
      body: JSON.stringify({ query, org_id: orgId }),
    }),
  executeCopilotAction: (actionType: string, orgId: string, params: Record<string, unknown>) =>
    apiFetch<any>('/copilot/action', {
      method: 'POST',
      body: JSON.stringify({ action_type: actionType, org_id: orgId, params }),
    }),

  // Optimization
  getRecommendations: (orgId?: string, status?: string) => {
    const qs = new URLSearchParams();
    if (orgId) qs.set('org_id', orgId);
    if (status) qs.set('status', status);
    return apiFetch<any[]>(`/optimization/recommendations?${qs}`);
  },
  updateRecommendation: (id: string, status: string) =>
    apiFetch<any>(`/optimization/recommendations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getSavings: (orgId?: string) =>
    apiFetch<any>(`/optimization/savings${orgId ? `?org_id=${orgId}` : ''}`),
  generateRecommendations: (orgId: string) =>
    apiFetch<any>(`/optimization/generate?org_id=${orgId}`, { method: 'POST' }),
  simulateScenario: (orgId: string, fromModel: string, toModel: string) =>
    apiFetch<any>(`/optimization/scenario?org_id=${orgId}&from_model=${fromModel}&to_model=${toModel}`, {
      method: 'POST',
    }),

  // Forecasting
  generateForecast: (orgId: string, periodType: string = 'monthly') =>
    apiFetch<any>('/forecasting/generate', {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId, period_type: periodType }),
    }),
  getForecasts: (orgId?: string, periodType?: string) => {
    const qs = new URLSearchParams();
    if (orgId) qs.set('org_id', orgId);
    if (periodType) qs.set('period_type', periodType);
    return apiFetch<any[]>(`/forecasting/forecasts?${qs}`);
  },
  runScenarioAnalysis: (orgId: string, fromModel: string, toModel: string) =>
    apiFetch<any>('/forecasting/scenario', {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId, from_model: fromModel, to_model: toModel }),
    }),
  getBudgets: (orgId?: string) =>
    apiFetch<any[]>(`/forecasting/budgets${orgId ? `?org_id=${orgId}` : ''}`),
  refreshBudgets: (orgId: string) =>
    apiFetch<any>(`/forecasting/budgets/refresh?org_id=${orgId}`, { method: 'POST' }),
};
