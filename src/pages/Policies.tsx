// Policy Engine: governance policy catalog with CRUD and live evaluation.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Plus, X, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import {
  Card, PageHeader, StatusBadge, LoadingSpinner, EmptyState,
} from '@/components/ui';

const POLICY_TYPES = ['cost_limit', 'rate_limit', 'model_restriction', 'data_residency', 'usage_quota'];
const SCOPES = ['org', 'bu', 'department', 'project', 'app'];

export function Policies() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [evalModel, setEvalModel] = useState('');
  const [evalResult, setEvalResult] = useState<any>(null);

  const { data: policies, isLoading } = useQuery({
    queryKey: ['policies', orgId],
    queryFn: () => api.getPolicies(orgId || undefined),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.createPolicy(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies', orgId] });
      setShowCreate(false);
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: ({ model, cost }: { model: string; cost: number }) =>
      api.evaluateRequest(orgId!, model, cost),
    onSuccess: (data) => setEvalResult(data),
  });

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Policy Engine"
        subtitle="Governance policies for cost limits, rate limits, model restrictions, and usage quotas"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#3B82F6] text-white text-sm hover:bg-[#2563EB] transition-colors"
          >
            <Plus className="w-4 h-4" /> New Policy
          </button>
        }
      />

      {/* Live Policy Evaluation */}
      <Card className="p-5 mb-6">
        <h3 className="text-sm font-medium text-[#E6EDF3] mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#3B82F6]" /> Live Policy Evaluation
        </h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-[#8B949E] mb-1">Model ID</label>
            <input
              type="text"
              value={evalModel}
              onChange={(e) => setEvalModel(e.target.value)}
              placeholder="gpt-4o-mini"
              className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] focus:border-[#3B82F6] focus:outline-none"
            />
          </div>
          <button
            onClick={() => evaluateMutation.mutate({ model: evalModel || 'gpt-4o-mini', cost: 0.01 })}
            disabled={!orgId || evaluateMutation.isPending}
            className="px-4 py-2 rounded-lg bg-[#3B82F6] text-white text-sm hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
          >
            {evaluateMutation.isPending ? 'Evaluating...' : 'Evaluate'}
          </button>
        </div>

        {evalResult && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${
                evalResult.decision === 'APPROVED'
                  ? 'bg-green-500/10 text-green-400 border-green-500/30'
                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
              }`}>
                {evalResult.decision === 'APPROVED' ? '\u2713' : '\u26A0'} {evalResult.decision}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                evalResult.risk_tier === 'LOW'
                  ? 'bg-green-500/10 text-green-400 border-green-500/30'
                  : evalResult.risk_tier === 'MEDIUM'
                  ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}>
                {evalResult.risk_tier} RISK
              </span>
            </div>

            {evalResult.evaluations?.map((ev: any, i: number) => (
              <div key={i} className={`p-3 rounded-lg border ${
                ev.result === 'approved' ? 'bg-green-500/5 border-green-500/20' :
                ev.result === 'denied' ? 'bg-red-500/5 border-red-500/20' :
                'bg-yellow-500/5 border-yellow-500/20'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-[#E6EDF3] font-medium">{ev.policy_name}</span>
                  <span className={`text-xs font-medium uppercase ${
                    ev.result === 'approved' ? 'text-green-400' :
                    ev.result === 'denied' ? 'text-red-400' : 'text-yellow-400'
                  }`}>{ev.result}</span>
                </div>
                <p className="text-xs text-[#8B949E]">{ev.reason}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Policy List */}
      {isLoading ? (
        <LoadingSpinner />
      ) : !policies?.length ? (
        <Card className="p-6">
          <EmptyState message="No policies configured" icon={<Shield className="w-8 h-8" />} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {policies.map((p) => (
            <Card key={p.id} hover className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#E6EDF3]">{p.name}</h3>
                  <p className="text-xs text-[#6E7681] mt-0.5">
                    {p.policy_type.replace('_', ' ')} • {p.scope} scope • priority {p.priority}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="mt-3">
                <pre className="text-xs text-[#8B949E] bg-[#0D1117] rounded-lg p-3 overflow-x-auto border border-[#21262D]">
                  {JSON.stringify(p.rule_config, null, 2)}
                </pre>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Policy Modal */}
      {showCreate && (
        <CreatePolicyModal
          orgId={orgId!}
          onClose={() => setShowCreate(false)}
          onCreate={(body) => createMutation.mutate(body)}
          error={createMutation.error as Error | null}
        />
      )}
    </div>
  );
}

function CreatePolicyModal({ orgId, onClose, onCreate, error }: {
  orgId: string;
  onClose: () => void;
  onCreate: (body: any) => void;
  error: Error | null;
}) {
  const [name, setName] = useState('');
  const [policyType, setPolicyType] = useState('cost_limit');
  const [scope, setScope] = useState('org');
  const [ruleJson, setRuleJson] = useState('{\n  "max_monthly_cost": 5000\n}');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let ruleConfig: Record<string, unknown>;
    try {
      ruleConfig = JSON.parse(ruleJson);
    } catch {
      alert('Invalid JSON in rule config');
      return;
    }
    onCreate({
      org_id: orgId,
      name,
      policy_type: policyType,
      scope,
      rule_config: ruleConfig,
      status: 'active',
      priority: 1,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-lg card p-6 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#E6EDF3]">Create Policy</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#161B22]">
            <X className="w-5 h-5 text-[#8B949E]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[#8B949E] mb-1">Policy Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] focus:border-[#3B82F6] focus:outline-none"
              placeholder="Monthly Cost Limit"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[#8B949E] mb-1">Type</label>
              <select
                value={policyType}
                onChange={(e) => setPolicyType(e.target.value)}
                className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] focus:border-[#3B82F6] focus:outline-none"
              >
                {POLICY_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#8B949E] mb-1">Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] focus:border-[#3B82F6] focus:outline-none"
              >
                {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#8B949E] mb-1">Rule Configuration (JSON)</label>
            <textarea
              value={ruleJson}
              onChange={(e) => setRuleJson(e.target.value)}
              rows={5}
              className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] font-mono focus:border-[#3B82F6] focus:outline-none"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-[#F85149]">
              <AlertCircle className="w-4 h-4" />
              <span>Failed to create policy</span>
            </div>
          )}
          <button type="submit" className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium py-2.5 rounded-lg transition-colors">
            Create Policy
          </button>
        </form>
      </div>
    </div>
  );
}
