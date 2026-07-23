// Optimization: Azure Advisor-style cost optimization with scenario analysis.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingDown, Check, X, RefreshCw, Lightbulb, DollarSign,
  ArrowRight, GitCompare,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import {
  Card, PageHeader, StatusBadge, LoadingSpinner, EmptyState, KPICard, formatCurrency,
} from '@/components/ui';

const REC_TYPE_COLORS: Record<string, string> = {
  model_swap: 'bg-blue-500/10 text-blue-400',
  cache_enable: 'bg-green-500/10 text-green-400',
  routing_change: 'bg-purple-500/10 text-purple-400',
  budget_alert: 'bg-orange-500/10 text-orange-400',
  usage_consolidation: 'bg-teal-500/10 text-teal-400',
};

export function Optimization() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const [showScenario, setShowScenario] = useState(false);
  const [fromModel, setFromModel] = useState('gpt-4o');
  const [toModel, setToModel] = useState('gpt-4o-mini');

  const { data: recommendations, isLoading } = useQuery({
    queryKey: ['recommendations', orgId],
    queryFn: () => api.getRecommendations(orgId || undefined),
  });

  const { data: savings } = useQuery({
    queryKey: ['savings', orgId],
    queryFn: () => api.getSavings(orgId || undefined),
  });

  const { data: models } = useQuery({
    queryKey: ['allModels'],
    queryFn: () => api.getModels(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateRecommendation(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations', orgId] });
      queryClient.invalidateQueries({ queryKey: ['savings', orgId] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => api.generateRecommendations(orgId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations', orgId] });
      queryClient.invalidateQueries({ queryKey: ['savings', orgId] });
    },
  });

  const scenarioMutation = useMutation({
    mutationFn: () => api.simulateScenario(orgId!, fromModel, toModel),
  });

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Optimization"
        subtitle="Azure Advisor-style cost optimization recommendations and scenario analysis"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setShowScenario(!showScenario)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#161B22] text-[#E6EDF3] text-sm hover:bg-[#1C2330] border border-[#30363D] transition-colors"
            >
              <GitCompare className="w-4 h-4" /> Scenario
            </button>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={!orgId || generateMutation.isPending}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#3B82F6] text-white text-sm hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${generateMutation.isPending ? 'animate-spin' : ''}`} /> Generate
            </button>
          </div>
        }
      />

      {/* Savings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPICard label="Potential Savings" value={formatCurrency(savings?.potential_savings || 0)} sub={`${savings?.pending_count || 0} pending`} icon={<DollarSign className="w-5 h-5" />} accent />
        <KPICard label="Realized Savings" value={formatCurrency(savings?.realized_savings || 0)} sub={`${savings?.applied_count || 0} applied`} icon={<TrendingDown className="w-5 h-5" />} />
        <KPICard label="Dismissed" value={formatCurrency(savings?.dismissed_savings || 0)} sub={`${savings?.dismissed_count || 0} dismissed`} icon={<X className="w-5 h-5" />} />
      </div>

      {/* Scenario Analysis Panel */}
      {showScenario && (
        <Card className="p-5 mb-6 animate-fadeIn">
          <h3 className="text-sm font-medium text-[#E6EDF3] mb-4 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-[#3B82F6]" /> Model Switch Scenario Analysis
          </h3>
          <div className="flex gap-3 items-end mb-4">
            <div className="flex-1">
              <label className="block text-xs text-[#8B949E] mb-1">From Model</label>
              <select
                value={fromModel}
                onChange={(e) => setFromModel(e.target.value)}
                className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] focus:border-[#3B82F6] focus:outline-none"
              >
                {(models || []).map((m: any) => (
                  <option key={m.model_id} value={m.model_id}>{m.display_name}</option>
                ))}
              </select>
            </div>
            <ArrowRight className="w-5 h-5 text-[#6E7681] mb-2" />
            <div className="flex-1">
              <label className="block text-xs text-[#8B949E] mb-1">To Model</label>
              <select
                value={toModel}
                onChange={(e) => setToModel(e.target.value)}
                className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] focus:border-[#3B82F6] focus:outline-none"
              >
                {(models || []).map((m: any) => (
                  <option key={m.model_id} value={m.model_id}>{m.display_name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => scenarioMutation.mutate()}
              disabled={!orgId || scenarioMutation.isPending}
              className="px-4 py-2 rounded-lg bg-[#3B82F6] text-white text-sm hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
            >
              {scenarioMutation.isPending ? 'Simulating...' : 'Simulate'}
            </button>
          </div>

          {scenarioMutation.data && !scenarioMutation.data.error && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 animate-fadeIn">
              <div className="p-3 rounded-lg bg-[#161B22] border border-[#30363D]">
                <p className="text-xs text-[#6E7681]">Actual Spend</p>
                <p className="text-lg font-semibold text-[#E6EDF3]">{formatCurrency(scenarioMutation.data.actual_spend)}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#161B22] border border-[#30363D]">
                <p className="text-xs text-[#6E7681]">Simulated Spend</p>
                <p className="text-lg font-semibold text-[#E6EDF3]">{formatCurrency(scenarioMutation.data.simulated_spend)}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <p className="text-xs text-green-400">Total Savings</p>
                <p className="text-lg font-semibold text-green-400">{formatCurrency(scenarioMutation.data.total_savings)}</p>
                <p className="text-xs text-green-400">{scenarioMutation.data.savings_percentage}%</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <p className="text-xs text-green-400">Monthly Savings</p>
                <p className="text-lg font-semibold text-green-400">{formatCurrency(scenarioMutation.data.projected_monthly_savings)}</p>
              </div>
              {scenarioMutation.data.quality_note && (
                <div className="col-span-2 md:col-span-4 p-3 rounded-lg bg-[#0D1117] border border-[#30363D]">
                  <p className="text-xs text-[#8B949E]">{scenarioMutation.data.quality_note}</p>
                </div>
              )}
            </div>
          )}

          {scenarioMutation.data?.error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 mt-4">
              <p className="text-sm text-red-400">{scenarioMutation.data.error}</p>
            </div>
          )}
        </Card>
      )}

      {/* Recommendations */}
      {isLoading ? (
        <LoadingSpinner />
      ) : !recommendations?.length ? (
        <Card className="p-6">
          <EmptyState message="No optimization recommendations yet. Click Generate to analyze your usage patterns." icon={<Lightbulb className="w-8 h-8" />} />
        </Card>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec) => (
            <Card key={rec.id} hover className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${REC_TYPE_COLORS[rec.recommendation_type] || 'bg-yellow-500/10 text-yellow-400'}`}>
                      {rec.recommendation_type.replace('_', ' ')}
                    </span>
                    <StatusBadge status={rec.status} />
                  </div>
                  <h3 className="text-sm font-semibold text-[#E6EDF3] mb-1">{rec.title}</h3>
                  <p className="text-sm text-[#8B949E] mb-3">{rec.description}</p>
                  <div className="flex items-center gap-4 text-xs">
                    {rec.potential_savings > 0 && (
                      <span className="text-green-400 font-medium">
                        Savings: {formatCurrency(rec.potential_savings)}/mo
                      </span>
                    )}
                    <span className="text-[#6E7681]">
                      Confidence: {rec.confidence_score}%
                    </span>
                  </div>
                </div>

                {rec.status === 'pending' && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => updateMutation.mutate({ id: rec.id, status: 'applied' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-sm hover:bg-green-500/20 border border-green-500/30 transition-colors"
                    >
                      <Check className="w-4 h-4" /> Apply
                    </button>
                    <button
                      onClick={() => updateMutation.mutate({ id: rec.id, status: 'dismissed' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161B22] text-[#8B949E] text-sm hover:bg-[#1C2330] border border-[#30363D] transition-colors"
                    >
                      <X className="w-4 h-4" /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
