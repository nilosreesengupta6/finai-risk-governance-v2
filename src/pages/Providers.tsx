// Provider Gateway: multi-provider catalog with live status, failover matrix, and model pricing.
import { useQuery } from '@tanstack/react-query';
import { Server, Activity, Zap, DollarSign, Cpu } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, PageHeader, StatusBadge, LoadingSpinner, formatCurrency } from '@/components/ui';

export function Providers() {
  const { data: providers, isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.getProviders(),
  });

  const { data: providerStatus } = useQuery({
    queryKey: ['providerStatus'],
    queryFn: () => api.getProviderStatus(),
  });

  const { data: models } = useQuery({
    queryKey: ['allModels'],
    queryFn: () => api.getModels(),
  });

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Provider Gateway"
        subtitle="Multi-provider catalog with live status, failover priority, and model pricing"
      />

      {/* Provider Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {(providerStatus || []).map((p) => (
          <Card key={p.id} hover className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
                  <Server className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#E6EDF3]">{p.name}</h3>
                  <p className="text-xs text-[#6E7681]">{p.slug}</p>
                </div>
              </div>
              <StatusBadge status={p.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <p className="text-xs text-[#6E7681]">Models</p>
                <p className="text-sm text-[#E6EDF3] font-medium">{p.model_count}</p>
              </div>
              <div>
                <p className="text-xs text-[#6E7681]">Avg Latency</p>
                <p className="text-sm text-[#E6EDF3] font-medium">{p.avg_latency_ms}ms</p>
              </div>
              <div>
                <p className="text-xs text-[#6E7681]">Failover Rank</p>
                <p className="text-sm text-[#E6EDF3] font-medium">#{p.failover_rank}</p>
              </div>
              <div>
                <p className="text-xs text-[#6E7681]">Priority</p>
                <p className="text-sm text-[#E6EDF3] font-medium">{p.priority}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Failover Priority Matrix */}
      <Card className="p-5 mb-6">
        <h3 className="text-sm font-medium text-[#E6EDF3] mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#3B82F6]" /> Failover Priority Matrix
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363D] text-[#8B949E] text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Rank</th>
                <th className="text-left px-4 py-3 font-medium">Provider</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Avg Latency</th>
                <th className="text-right px-4 py-3 font-medium">Models</th>
              </tr>
            </thead>
            <tbody>
              {(providerStatus || []).map((p) => (
                <tr key={p.id} className="border-b border-[#21262D] hover:bg-[#1C2330]">
                  <td className="px-4 py-3 text-[#3B82F6] font-medium">#{p.failover_rank}</td>
                  <td className="px-4 py-3 text-[#E6EDF3]">{p.name}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-right text-[#8B949E]">{p.avg_latency_ms}ms</td>
                  <td className="px-4 py-3 text-right text-[#8B949E]">{p.model_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Model Pricing Table */}
      <Card className="p-5">
        <h3 className="text-sm font-medium text-[#E6EDF3] mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[#3B82F6]" /> Model Catalog & Pricing
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363D] text-[#8B949E] text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Model</th>
                <th className="text-left px-4 py-3 font-medium">Provider</th>
                <th className="text-right px-4 py-3 font-medium">Context</th>
                <th className="text-right px-4 py-3 font-medium">Input $/1K</th>
                <th className="text-right px-4 py-3 font-medium">Output $/1K</th>
                <th className="text-right px-4 py-3 font-medium">Cached $/1K</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(models || []).map((m) => (
                <tr key={m.id} className="border-b border-[#21262D] hover:bg-[#1C2330]">
                  <td className="px-4 py-3 text-[#E6EDF3] font-mono text-xs">{m.model_id}</td>
                  <td className="px-4 py-3 text-[#8B949E]">{m.provider_name}</td>
                  <td className="px-4 py-3 text-right text-[#8B949E]">{m.context_window.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-[#E6EDF3]">${m.input_price_per_1k.toFixed(6)}</td>
                  <td className="px-4 py-3 text-right text-[#E6EDF3]">${m.output_price_per_1k.toFixed(6)}</td>
                  <td className="px-4 py-3 text-right text-[#8B949E]">${(m.cached_input_price_per_1k || 0).toFixed(6)}</td>
                  <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
