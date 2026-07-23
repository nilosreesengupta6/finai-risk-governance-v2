// Optimization: cost optimization recommendations with apply/dismiss actions.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingDown, Check, X, RefreshCw, Lightbulb, DollarSign, Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import {
  Card, PageHeader, StatusBadge, LoadingSpinner, EmptyState, KPICard, formatCurrency,
} from '@/components/ui';

export function Optimization() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();

  const { data: recommendations, isLoading } = useQuery({
    queryKey: ['recommendations', orgId],
    queryFn: () => api.getRecommendations(orgId || undefined),
  });

  const { data: savings } = useQuery({
    queryKey: ['savings', orgId],
    queryFn: () => api.getSavings(orgId || undefined),
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
    },
  });

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Optimization"
        subtitle="AI-powered cost optimization recommendations and savings tracking"
        actions={
          <button
            onClick={() => generateMutation.mutate()}
            disabled={!orgId || generateMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#3B82F6] text-white text-sm hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${generateMutation.isPending ? 'animate-spin' : ''}`} /> Generate
          </button>
        }
      />

      {/* Savings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPICard label="Potential Savings" value={formatCurrency(savings?.potential_savings || 0)} sub={`${savings?.pending_count || 0} pending`} icon={<DollarSign className="w-5 h-5" />} accent />
        <KPICard label="Realized Savings" value={formatCurrency(savings?.realized_savings || 0)} sub={`${savings?.applied_count || 0} applied`} icon={<TrendingDown className="w-5 h-5" />} />
        <KPICard label="Dismissed" value={formatCurrency(savings?.dismissed_savings || 0)} sub={`${savings?.dismissed_count || 0} dismissed`} icon={<X className="w-5 h-5" />} />
      </div>

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
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                      rec.recommendation_type === 'model_swap' ? 'bg-blue-500/10 text-blue-400' :
                      rec.recommendation_type === 'cache_enable' ? 'bg-green-500/10 text-green-400' :
                      rec.recommendation_type === 'routing_change' ? 'bg-purple-500/10 text-purple-400' :
                      'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {rec.recommendation_type.replace('_', ' ')}
                    </span>
                    <StatusBadge status={rec.status} />
                  </div>
                  <h3 className="text-sm font-semibold text-[#E6EDF3] mb-1">{rec.title}</h3>
                  <p className="text-sm text-[#8B949E] mb-3">{rec.description}</p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-green-400 font-medium">
                      Potential savings: {formatCurrency(rec.potential_savings)}/mo
                    </span>
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
