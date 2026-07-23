// System Health: service status and observability.
import { useQuery } from '@tanstack/react-query';
import { Activity, Server, Database, Cpu, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, PageHeader, LoadingSpinner } from '@/components/ui';

export function Health() {
  const { data: providers, isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.getProviders(),
  });

  const { data: providerStatus } = useQuery({
    queryKey: ['providerStatus'],
    queryFn: () => api.getProviderStatus(),
  });

  const services = [
    { name: 'API Gateway', icon: Server, status: 'healthy' },
    { name: 'PostgreSQL', icon: Database, status: 'healthy' },
    { name: 'Redis Cache', icon: Cpu, status: 'healthy' },
    { name: 'Supabase', icon: Database, status: 'healthy' },
  ];

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="System Health"
        subtitle="Service status, provider health checks, and observability"
      />

      {/* Core Services */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {services.map((s) => (
          <Card key={s.name} hover className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <s.icon className="w-5 h-5 text-green-400" />
              </div>
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <h3 className="text-sm font-semibold text-[#E6EDF3]">{s.name}</h3>
            <p className="text-xs text-green-400 mt-1 capitalize">{s.status}</p>
          </Card>
        ))}
      </div>

      {/* Provider Health */}
      <Card className="p-5">
        <h3 className="text-sm font-medium text-[#E6EDF3] mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#3B82F6]" /> Provider Health Checks
        </h3>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-3">
            {(providerStatus || []).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-[#161B22] border border-[#30363D]">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    p.status === 'active' ? 'bg-green-400' :
                    p.status === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
                  }`} />
                  <span className="text-sm text-[#E6EDF3]">{p.name}</span>
                </div>
                <div className="flex items-center gap-6 text-xs text-[#8B949E]">
                  <span>{p.model_count} models</span>
                  <span>{p.avg_latency_ms}ms avg</span>
                  <span>Rank #{p.failover_rank}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Observability Stack */}
      <Card className="p-5 mt-4">
        <h3 className="text-sm font-medium text-[#E6EDF3] mb-4">Observability Stack</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['Prometheus', 'Grafana', 'Loki', 'Jaeger'].map((tool) => (
            <div key={tool} className="p-3 rounded-lg bg-[#161B22] border border-[#30363D] text-center">
              <p className="text-sm text-[#E6EDF3]">{tool}</p>
              <p className="text-xs text-green-400 mt-1">Available</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
