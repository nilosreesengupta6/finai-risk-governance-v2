// AI Copilot: conversational interface for cost intelligence queries.
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bot, Send, Sparkles, TrendingDown, DollarSign, Clock, Server } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, PageHeader, LoadingSpinner } from '@/components/ui';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  suggestions?: string[];
  sources?: string[];
}

const SUGGESTED_QUERIES = [
  { text: "What's our total AI spend?", icon: DollarSign },
  { text: "How is our latency performance?", icon: Clock },
  { text: "Show me optimization opportunities", icon: TrendingDown },
  { text: "Which providers are we using?", icon: Server },
];

export function Copilot() {
  const { orgId } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your AI Cost Intelligence Copilot. Ask me about your AI spending, usage patterns, latency, providers, or optimization opportunities.",
    },
  ]);
  const [input, setInput] = useState('');

  const mutation = useMutation({
    mutationFn: (query: string) => api.queryCopilot(query, orgId!),
    onSuccess: (resp) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: resp.answer,
          data: resp.data,
          suggestions: resp.suggested_actions,
          sources: resp.sources,
        },
      ]);
    },
  });

  const sendQuery = (query: string) => {
    if (!query.trim() || !orgId) return;
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setInput('');
    mutation.mutate(query);
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="AI Copilot"
        subtitle="Conversational interface for AI cost intelligence and optimization insights"
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
                  <div className={`inline-block text-sm rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-[#3B82F6] text-white'
                      : 'bg-[#161B22] text-[#E6EDF3] border border-[#30363D]'
                  }`}>
                    {msg.content}
                  </div>

                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.suggestions.map((s, j) => (
                        <button
                          key={j}
                          onClick={() => sendQuery(s)}
                          className="text-xs px-2.5 py-1 rounded-md bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/30 hover:bg-[#3B82F6]/20 transition-colors"
                        >
                          {s}
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

            {mutation.isPending && (
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
                placeholder="Ask about costs, usage, optimization..."
                className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2.5 text-sm text-[#E6EDF3] focus:border-[#3B82F6] focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim() || mutation.isPending}
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
