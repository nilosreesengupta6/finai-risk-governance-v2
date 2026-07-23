// AI Requests page: table of all gateway requests with lifecycle trace drawer.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Zap, ChevronRight, X, Clock, DollarSign, Database, Shield, Cpu, Activity,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import {
  Card, PageHeader, StatusBadge, LoadingSpinner, EmptyState,
  formatCurrency, formatNumber, formatDateTime,
} from '@/components/ui';

const STAGES = ['auth', 'resolution', 'routing', 'execution', 'accounting', 'logging'];

export function AIRequests() {
  const { orgId } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['requests', orgId, statusFilter],
    queryFn: () => api.getRequests({ org_id: orgId || undefined, status: statusFilter || undefined, limit: 100 }),
  });

  const { data: trace } = useQuery({
    queryKey: ['trace', selectedId],
    queryFn: () => api.getLifecycleTrace(selectedId!),
    enabled: !!selectedId,
  });

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="AI Requests"
        subtitle="Every request through the 6-stage gateway lifecycle"
      />

      <div className="flex gap-2 mb-4">
        {['', 'success', 'cached', 'blocked', 'failed'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              statusFilter === s
                ? 'bg-[#3B82F6] text-white'
                : 'bg-[#161B22] text-[#8B949E] hover:bg-[#1C2330]'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !requests?.length ? (
        <Card className="p-6">
          <EmptyState message="No AI requests found" icon={<Zap className="w-8 h-8" />} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#30363D] text-[#8B949E] text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Model</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Tokens</th>
                  <th className="text-right px-4 py-3 font-medium">Cost</th>
                  <th className="text-right px-4 py-3 font-medium">Latency</th>
                  <th className="text-center px-4 py-3 font-medium">Cache</th>
                  <th className="text-left px-4 py-3 font-medium">Strategy</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => setSelectedId(req.id)}
                    className="border-b border-[#21262D] hover:bg-[#1C2330] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-[#E6EDF3] font-mono text-xs">{req.model_id}</td>
                    <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3 text-right text-[#8B949E]">{formatNumber(req.total_tokens)}</td>
                    <td className="px-4 py-3 text-right text-[#E6EDF3]">{formatCurrency(req.total_cost)}</td>
                    <td className="px-4 py-3 text-right text-[#8B949E]">{req.latency_ms}ms</td>
                    <td className="px-4 py-3 text-center">
                      {req.cache_hit ? (
                        <span className="text-green-400 text-xs">HIT</span>
                      ) : (
                        <span className="text-[#484F58] text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#8B949E] text-xs">
                      {req.routing_strategy?.replace('_', ' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-[#6E7681] text-xs">{formatDateTime(req.created_at)}</td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-[#484F58]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selectedId && trace && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedId(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-xl bg-[#0D1117] border-l border-[#30363D] h-full overflow-y-auto animate-slideIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#0D1117] border-b border-[#30363D] px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-[#E6EDF3]">Lifecycle Trace</h2>
              <button onClick={() => setSelectedId(null)} className="p-1 rounded hover:bg-[#161B22]">
                <X className="w-5 h-5 text-[#8B949E]" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <InfoTile label="Model" value={trace.model} icon={<Cpu className="w-4 h-4" />} />
                <InfoTile label="Status" value={trace.status} icon={<Activity className="w-4 h-4" />} />
                <InfoTile label="Strategy" value={trace.routing_strategy?.replace('_', ' ') || '—'} icon={<Zap className="w-4 h-4" />} />
                <InfoTile label="Cache Hit" value={trace.cache_hit ? 'Yes' : 'No'} icon={<Database className="w-4 h-4" />} />
                <InfoTile label="Latency" value={`${trace.latency_ms}ms`} icon={<Clock className="w-4 h-4" />} />
                <InfoTile label="Total Cost" value={formatCurrency(trace.total_cost)} icon={<DollarSign className="w-4 h-4" />} />
              </div>

              <div>
                <h3 className="text-sm font-medium text-[#E6EDF3] mb-3">6-Stage Lifecycle</h3>
                <div className="space-y-2">
                  {STAGES.map((stage, i) => {
                    const reached = STAGES.indexOf(trace.stage) >= i;
                    return (
                      <div
                        key={stage}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          reached
                            ? 'bg-[#161B22] border-[#30363D]'
                            : 'bg-[#0D1117] border-[#21262D] opacity-50'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                          reached ? 'bg-[#3B82F6] text-white' : 'bg-[#21262D] text-[#6E7681]'
                        }`}>
                          {i + 1}
                        </div>
                        <span className="text-sm text-[#E6EDF3] capitalize">{stage}</span>
                        {reached && (
                          <span className="ml-auto text-xs text-green-400">✓</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-[#E6EDF3] mb-3">Token Breakdown</h3>
                <div className="grid grid-cols-2 gap-3">
                  <TokenTile label="Prompt" value={trace.tokens.prompt} />
                  <TokenTile label="Completion" value={trace.tokens.completion} />
                  <TokenTile label="Cached" value={trace.tokens.cached} />
                  <TokenTile label="Total" value={trace.tokens.total} />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-[#E6EDF3] mb-3">Cost Breakdown</h3>
                <div className="grid grid-cols-2 gap-3">
                  <TokenTile label="Input Cost" value={formatCurrency(trace.cost_breakdown.input)} isCost />
                  <TokenTile label="Output Cost" value={formatCurrency(trace.cost_breakdown.output)} isCost />
                  <TokenTile label="Cached Cost" value={formatCurrency(trace.cost_breakdown.cached)} isCost />
                  <TokenTile label="Total Cost" value={formatCurrency(trace.cost_breakdown.total)} isCost />
                </div>
              </div>

              {trace.triggered_policies && trace.triggered_policies.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-[#E6EDF3] mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#F59E0B]" /> Triggered Policies
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {trace.triggered_policies.map((p: string, i: number) => (
                      <span key={i} className="px-2.5 py-1 rounded-md bg-[#F59E0B]/10 text-[#F59E0B] text-xs border border-[#F59E0B]/30">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {trace.blocked_reason && (
                <div className="p-3 rounded-lg bg-[#F85149]/10 border border-[#F85149]/30">
                  <p className="text-sm text-[#F85149]">{trace.blocked_reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoTile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-[#161B22] border border-[#30363D]">
      <div className="flex items-center gap-1.5 text-xs text-[#6E7681] mb-1">
        {icon}
        {label}
      </div>
      <p className="text-sm text-[#E6EDF3] font-medium capitalize">{value}</p>
    </div>
  );
}

function TokenTile({ label, value, isCost }: { label: string; value: string | number; isCost?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-[#161B22] border border-[#30363D]">
      <p className="text-xs text-[#6E7681] mb-1">{label}</p>
      <p className="text-sm text-[#E6EDF3] font-medium">{isCost ? value : formatNumber(value as number)}</p>
    </div>
  );
}
