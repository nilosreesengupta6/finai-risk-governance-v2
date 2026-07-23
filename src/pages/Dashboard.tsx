// Executive Dashboard: KPIs, cost trend chart, cost by model, token usage.
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { DollarSign, Zap, Clock, Database, TrendingDown, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, KPICard, PageHeader, LoadingSpinner, formatCurrency, formatNumber } from '@/components/ui';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function Dashboard() {
  const { orgId } = useAuth();

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['kpis', orgId],
    queryFn: () => api.getKPIs(orgId || undefined),
    enabled: !!orgId || true,
  });

  const { data: costTrend } = useQuery({
    queryKey: ['costTrend', orgId],
    queryFn: () => api.getCostTrend(orgId || undefined, 30),
  });

  const { data: costByModel } = useQuery({
    queryKey: ['costByModel', orgId],
    queryFn: () => api.getCostByModel(orgId || undefined),
  });

  const { data: costByProvider } = useQuery({
    queryKey: ['costByProvider', orgId],
    queryFn: () => api.getCostByProvider(orgId || undefined),
  });

  if (kpisLoading) return <LoadingSpinner />;

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Executive Dashboard"
        subtitle="Real-time AI cost intelligence and governance KPIs"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <KPICard label="Total Spend" value={formatCurrency(kpis?.total_cost || 0)} sub="All-time" icon={<DollarSign className="w-5 h-5" />} accent />
        <KPICard label="Total Requests" value={formatNumber(kpis?.total_requests || 0)} sub="All-time" icon={<Zap className="w-5 h-5" />} />
        <KPICard label="Avg Latency" value={`${kpis?.avg_latency_ms || 0}ms`} sub="Per request" icon={<Clock className="w-5 h-5" />} />
        <KPICard label="Cache Hit Rate" value={`${kpis?.cache_hit_rate || 0}%`} sub="Semantic cache" icon={<Database className="w-5 h-5" />} />
        <KPICard label="Total Tokens" value={formatNumber(kpis?.total_tokens || 0)} sub="Prompt + completion" icon={<TrendingDown className="w-5 h-5" />} />
        <KPICard label="Blocked Requests" value={kpis?.blocked_requests || 0} sub="Policy enforcement" icon={<ShieldCheck className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <h3 className="text-sm font-medium text-[#E6EDF3] mb-4">Cost Trend (30 Days)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={costTrend || []}>
              <defs>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262D" />
              <XAxis dataKey="date" stroke="#6E7681" fontSize={11} tickFormatter={(d) => d.slice(5)} />
              <YAxis stroke="#6E7681" fontSize={11} tickFormatter={(v) => `$${v.toFixed(2)}`} />
              <Tooltip
                contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#8B949E' }}
              />
              <Area type="monotone" dataKey="cost" stroke="#3B82F6" fill="url(#costGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-medium text-[#E6EDF3] mb-4">Cost by Model</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={(costByModel || []).slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#21262D" horizontal={false} />
              <XAxis type="number" stroke="#6E7681" fontSize={11} tickFormatter={(v) => `$${v.toFixed(2)}`} />
              <YAxis type="category" dataKey="model" stroke="#6E7681" fontSize={10} width={120} />
              <Tooltip
                contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#8B949E' }}
              />
              <Bar dataKey="cost" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-medium text-[#E6EDF3] mb-4">Cost by Provider</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={costByProvider || []}
                dataKey="cost"
                nameKey="provider"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry: any) => entry.provider}
              >
                {(costByProvider || []).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: '8px', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-medium text-[#E6EDF3] mb-4">Request Status Breakdown</h3>
          <div className="space-y-3 mt-6">
            <StatusRow label="Successful" value={kpis?.successful_requests || 0} total={kpis?.total_requests || 1} color="bg-green-500" />
            <StatusRow label="Cached" value={kpis?.cached_requests || 0} total={kpis?.total_requests || 1} color="bg-blue-500" />
            <StatusRow label="Blocked" value={kpis?.blocked_requests || 0} total={kpis?.total_requests || 1} color="bg-red-500" />
            <StatusRow label="Failed" value={kpis?.failed_requests || 0} total={kpis?.total_requests || 1} color="bg-yellow-500" />
          </div>
          <div className="mt-6 pt-4 border-t border-[#30363D]">
            <div className="flex justify-between text-sm">
              <span className="text-[#8B949E]">Cost per Request</span>
              <span className="text-[#E6EDF3] font-medium">{formatCurrency(kpis?.cost_per_request || 0)}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-[#8B949E]">Tokens per Request</span>
              <span className="text-[#E6EDF3] font-medium">{formatNumber(kpis?.tokens_per_request || 0)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatusRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = (value / total) * 100;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-[#8B949E]">{label}</span>
        <span className="text-[#E6EDF3]">{formatNumber(value)}</span>
      </div>
      <div className="h-2 bg-[#0D1117] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
