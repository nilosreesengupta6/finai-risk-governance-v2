// Cost Explorer: interactive cost analysis with charts and filters.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import { Search } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, PageHeader, LoadingSpinner, formatCurrency, formatNumber } from '@/components/ui';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function CostExplorer() {
  const { orgId } = useAuth();
  const [days, setDays] = useState(30);

  const { data: costTrend } = useQuery({
    queryKey: ['costTrend', orgId, days],
    queryFn: () => api.getCostTrend(orgId || undefined, days),
  });

  const { data: costByModel } = useQuery({
    queryKey: ['costByModel', orgId],
    queryFn: () => api.getCostByModel(orgId || undefined),
  });

  const { data: costByProvider } = useQuery({
    queryKey: ['costByProvider', orgId],
    queryFn: () => api.getCostByProvider(orgId || undefined),
  });

  const { data: tokenUsage } = useQuery({
    queryKey: ['tokenUsage', orgId, days],
    queryFn: () => api.getTokenUsage(orgId || undefined, days),
  });

  const { data: latencyDist } = useQuery({
    queryKey: ['latencyDist', orgId],
    queryFn: () => api.getLatencyDistribution(orgId || undefined),
  });

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Cost Explorer"
        subtitle="Deep-dive into AI cost analytics across models, providers, and time"
        actions={
          <div className="flex gap-2">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  days === d ? 'bg-[#3B82F6] text-white' : 'bg-[#161B22] text-[#8B949E] hover:bg-[#1C2330]'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <h3 className="text-sm font-medium text-[#E6EDF3] mb-4">Daily Cost & Request Volume</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={costTrend || []}>
              <defs>
                <linearGradient id="costGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262D" />
              <XAxis dataKey="date" stroke="#6E7681" fontSize={11} tickFormatter={(d) => d.slice(5)} />
              <YAxis stroke="#6E7681" fontSize={11} />
              <Tooltip contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="cost" stroke="#3B82F6" fill="url(#costGrad2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-medium text-[#E6EDF3] mb-4">Token Usage Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={tokenUsage || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262D" />
              <XAxis dataKey="date" stroke="#6E7681" fontSize={11} tickFormatter={(d) => d.slice(5)} />
              <YAxis stroke="#6E7681" fontSize={11} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
              <Tooltip contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: '8px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="prompt" stroke="#3B82F6" strokeWidth={2} dot={false} name="Prompt" />
              <Line type="monotone" dataKey="completion" stroke="#10B981" strokeWidth={2} dot={false} name="Completion" />
              <Line type="monotone" dataKey="cached" stroke="#F59E0B" strokeWidth={2} dot={false} name="Cached" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <h3 className="text-sm font-medium text-[#E6EDF3] mb-4">Cost by Model</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={(costByModel || []).slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#21262D" horizontal={false} />
              <XAxis type="number" stroke="#6E7681" fontSize={11} tickFormatter={(v) => `$${v.toFixed(2)}`} />
              <YAxis type="category" dataKey="model" stroke="#6E7681" fontSize={10} width={130} />
              <Tooltip contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="cost" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-medium text-[#E6EDF3] mb-4">Cost by Provider</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={costByProvider || []} dataKey="cost" nameKey="provider" cx="50%" cy="50%" outerRadius={110} label={(e: any) => e.provider}>
                {(costByProvider || []).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: '8px', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-medium text-[#E6EDF3] mb-4">Latency Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={latencyDist || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262D" />
            <XAxis dataKey="range" stroke="#6E7681" fontSize={11} />
            <YAxis stroke="#6E7681" fontSize={11} />
            <Tooltip contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: '8px', fontSize: '12px' }} />
            <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5 mt-4">
        <h3 className="text-sm font-medium text-[#E6EDF3] mb-4">Model Cost Comparison Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363D] text-[#8B949E] text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Model</th>
                <th className="text-right px-4 py-3 font-medium">Total Cost</th>
                <th className="text-right px-4 py-3 font-medium">Total Tokens</th>
                <th className="text-right px-4 py-3 font-medium">Requests</th>
                <th className="text-right px-4 py-3 font-medium">Cost/Request</th>
              </tr>
            </thead>
            <tbody>
              {(costByModel || []).map((m) => (
                <tr key={m.model} className="border-b border-[#21262D] hover:bg-[#1C2330]">
                  <td className="px-4 py-3 text-[#E6EDF3] font-mono text-xs">{m.model}</td>
                  <td className="px-4 py-3 text-right text-[#E6EDF3]">{formatCurrency(m.cost)}</td>
                  <td className="px-4 py-3 text-right text-[#8B949E]">{formatNumber(m.tokens)}</td>
                  <td className="px-4 py-3 text-right text-[#8B949E]">{formatNumber(m.requests)}</td>
                  <td className="px-4 py-3 text-right text-[#E6EDF3]">{formatCurrency(m.cost / m.requests)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
