// AI Copilot: actionable conversational FinOps assistant.
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Send, Sparkles, TrendingDown, DollarSign, Clock, Server,
  TrendingUp, Wallet, ArrowRight, Check,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, PageHeader, LoadingSpinner, formatCurrency, formatNumber } from '@/components/ui';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  suggestions?: string[];
  sources?: string[];
  actionable?: boolean;
}

const SUGGESTED_QUERIES = [
  { text: "What's our total AI spend?", icon: DollarSign },
  { text: "Show top 10 expensive agents", icon: TrendingDown },
  { text: "Simulate switching from gpt-4o to gpt-4o-mini", icon: TrendingUp },
  { text: "Forecast next month's costs", icon: TrendingUp },
  { text: "How's our budget utilization?", icon: Wallet },
  { text: "Show me optimization opportunities", icon: TrendingDown },
];

export function Copilot() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your AI Cost Intelligence Copilot. I can answer FinOps queries, simulate savings, generate forecasts, and execute optimization actions. Try one of the suggested questions below.",
      suggestions: [],
    },
  ]);
  const [input, setInput] = useState('');

  const queryMutation = useMutation({
    mutationFn: (query: string) => api.queryCopilot(query, orgId!),
    onSuccess: (resp) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: resp.answer,
          data: resp.data,
          suggestions: resp.suggested_actions || [],
          sources: resp.sources || [],
          actionable: resp.actionable,
        },
      ]);
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ actionType, params }: { actionType: string; params: Record<string, unknown> }) =>
      api.executeCopilotAction(actionType, orgId!, params),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['recommendations', orgId] });
      queryClient.invalidateQueries({ queryKey: ['savings', orgId] });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Action executed: ${JSON.stringify(resp).slice(0, 200)}...`,
          suggestions: [],
        },
      ]);
    },
  });

  const sendQuery = (query: string) => {
    if (!query.trim() || !orgId) return;
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setInput('');
    queryMutation.mutate(query);
  };

  const handleSuggestion = (suggestion: string) => {
    // Check if it's an action
    if (suggestion.startsWith('Apply:')) {
      const title = suggestion.replace('Apply:', '').trim();
      const recs = messages.flatMap((m) => m.data?.recommendations || []);
      const rec = recs.find((r: any) => r.title === title);
      if (rec) {
        actionMutation.mutate({ actionType: 'apply_recommendation', params: { recommendation_id: rec.id } });
        return;
      }
    }
    sendQuery(suggestion);
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="AI Copilot"
        subtitle="Actionable FinOps assistant — query costs, simulate savings, execute optimizations"
      />

      <div className="max-w-3xl mx-auto">
        <div className="card flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-[#3B82F6]' : 'bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8]'
                }`}>
                  {msg.role === 'user' ? (
                    <span className="text-xs text-white font-medium">U</span>
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className={`flex-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`inline-block text-sm rounded-2xl px-4 py-3 max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-[#3B82F6] text-white'
                      : 'bg-[#161B22] text-[#E6EDF3] border border-[#30363D]'
                  }`}>
                    <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                  </div>

                  {/* Data visualization for assistant messages */}
                  {msg.data && msg.role === 'assistant' && <DataView data={msg.data} />}

                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.suggestions.map((s, j) => (
                        <button
                          key={j}
                          onClick={() => handleSuggestion(s)}
                          className="text-xs px-2.5 py-1 rounded-md bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/30 hover:bg-[#3B82F6]/20 transition-colors flex items-center gap-1"
                        >
                          {s.startsWith('Apply:') && <Check className="w-3 h-3" />}
                          {s}
                          {!s.startsWith('Apply:') && <ArrowRight className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-[#484F58]">
                      <Sparkles className="w-3 h-3" />
                      Sources: {msg.sources.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {(queryMutation.isPending || actionMutation.isPending) && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <LoadingSpinner />
              </div>
            )}
          </div>

          {/* Suggested queries */}
          {messages.length <= 1 && (
            <div className="px-6 pb-2">
              <p className="text-xs text-[#6E7681] mb-2">Try asking:</p>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTED_QUERIES.map((q) => (
                  <button
                    key={q.text}
                    onClick={() => sendQuery(q.text)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#161B22] border border-[#30363D] text-sm text-[#E6EDF3] hover:bg-[#1C2330] transition-colors text-left"
                  >
                    <q.icon className="w-4 h-4 text-[#3B82F6] flex-shrink-0" />
                    {q.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-[#30363D] p-4">
            <form
              onSubmit={(e) => { e.preventDefault(); sendQuery(input); }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about costs, usage, optimization, or simulate savings..."
                className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2.5 text-sm text-[#E6EDF3] focus:border-[#3B82F6] focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim() || queryMutation.isPending}
                className="px-4 py-2.5 rounded-lg bg-[#3B82F6] text-white hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataView({ data }: { data: any }) {
  if (!data) return null;

  // Top agents table
  if (data.top_agents && Array.isArray(data.top_agents)) {
    return (
      <div className="mt-2 inline-block">
        <div className="card p-3 text-left">
          <table className="text-xs">
            <thead>
              <tr className="text-[#6E7681] border-b border-[#30363D]">
                <th className="px-2 py-1 text-left">#</th>
                <th className="px-2 py-1 text-left">Agent</th>
                <th className="px-2 py-1 text-right">Cost</th>
                <th className="px-2 py-1 text-right">Requests</th>
              </tr>
            </thead>
            <tbody>
              {data.top_agents.slice(0, 10).map((a: any, i: number) => (
                <tr key={i} className="border-b border-[#21262D]">
                  <td className="px-2 py-1 text-[#6E7681]">{i + 1}</td>
                  <td className="px-2 py-1 text-[#E6EDF3]">{a.agent}</td>
                  <td className="px-2 py-1 text-right text-[#3B82F6]">{formatCurrency(a.cost)}</td>
                  <td className="px-2 py-1 text-right text-[#8B949E]">{formatNumber(a.requests)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Scenario analysis
  if (data.scenario) {
    const s = data.scenario;
    return (
      <div className="mt-2 inline-block">
        <div className="card p-4 text-left space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#8B949E]">Actual spend ({s.from_model})</span>
            <span className="text-[#E6EDF3]">{formatCurrency(s.actual_spend)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8B949E]">Simulated spend ({s.to_model})</span>
            <span className="text-[#E6EDF3]">{formatCurrency(s.simulated_spend)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-[#30363D]">
            <span className="text-green-400 font-medium">Total savings</span>
            <span className="text-green-400 font-medium">{formatCurrency(s.total_savings)} ({s.savings_percentage}%)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8B949E]">Projected monthly savings</span>
            <span className="text-green-400 font-medium">{formatCurrency(s.projected_monthly_savings)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Forecast display
  if (data.forecast) {
    const f = data.forecast;
    return (
      <div className="mt-2 inline-block">
        <div className="card p-4 text-left space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-green-400">Best case</span>
            <span className="text-[#E6EDF3]">{formatCurrency(f.best_case)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#3B82F6]">Expected</span>
            <span className="text-[#E6EDF3] font-medium">{formatCurrency(f.expected_case)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-red-400">Worst case</span>
            <span className="text-[#E6EDF3]">{formatCurrency(f.worst_case)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-[#30363D]">
            <span className="text-[#8B949E]">Confidence</span>
            <span className="text-[#E6EDF3]">{f.confidence_score}%</span>
          </div>
        </div>
      </div>
    );
  }

  // Budgets
  if (data.budgets && Array.isArray(data.budgets)) {
    return (
      <div className="mt-2 inline-block">
        <div className="card p-3 text-left space-y-1.5 text-xs">
          {data.budgets.map((b: any, i: number) => (
            <div key={i} className="flex justify-between gap-4">
              <span className="text-[#8B949E]">{b.project_name || 'Org-wide'}</span>
              <span className={b.status === 'exceeded' ? 'text-red-400' : b.status === 'warning' ? 'text-yellow-400' : 'text-green-400'}>
                {formatCurrency(b.actual_spend)} / {formatCurrency(b.budget_limit)} ({b.utilization_pct}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
