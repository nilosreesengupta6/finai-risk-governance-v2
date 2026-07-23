// Cost Ledger: immutable audit trail with CSV export.
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Download, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, PageHeader, LoadingSpinner, EmptyState, formatCurrency, formatNumber, formatDateTime } from '@/components/ui';

export function CostLedger() {
  const { orgId } = useAuth();

  const { data: ledger, isLoading } = useQuery({
    queryKey: ['ledger', orgId],
    queryFn: () => api.getLedger({ org_id: orgId || undefined, limit: 200 }),
  });

  const { data: summary } = useQuery({
    queryKey: ['ledgerSummary', orgId],
    queryFn: () => api.getLedgerSummary(orgId || undefined),
  });

  const exportUrl = api.getLedgerCsvUrl(orgId || undefined);

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Cost Ledger"
        subtitle="Immutable, append-only audit trail of every AI cost transaction"
        actions={
          <a
            href={exportUrl}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#161B22] text-[#E6EDF3] text-sm hover:bg-[#1C2330] border border-[#30363D] transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </a>
        }
      />

      {/* Summary by Period */}
      {summary && summary.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {summary.map((s) => (
            <Card key={s.period} hover className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet className="w-4 h-4 text-[#3B82F6]" />
                <span className="text-sm font-medium text-[#E6EDF3]">{s.period}</span>
              </div>
              <p className="text-2xl font-semibold text-[#3B82F6]">{formatCurrency(s.total_amount)}</p>
              <div className="mt-2 text-xs text-[#8B949E] space-y-0.5">
                <p>Tokens In: {formatNumber(s.total_tokens_in)}</p>
                <p>Tokens Out: {formatNumber(s.total_tokens_out)}</p>
                <p>Entries: {s.entry_count}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : !ledger?.length ? (
        <Card className="p-6">
          <EmptyState message="No ledger entries found" icon={<ScrollText className="w-8 h-8" />} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#30363D] text-[#8B949E] text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Entry Type</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-right px-4 py-3 font-medium">Tokens In</th>
                  <th className="text-right px-4 py-3 font-medium">Tokens Out</th>
                  <th className="text-right px-4 py-3 font-medium">Tokens Cached</th>
                  <th className="text-left px-4 py-3 font-medium">Model</th>
                  <th className="text-left px-4 py-3 font-medium">Period</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry) => (
                  <tr key={entry.id} className="border-b border-[#21262D] hover:bg-[#1C2330]">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${
                        entry.entry_type === 'charge' ? 'text-[#3B82F6]' :
                        entry.entry_type === 'refund' ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {entry.entry_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[#E6EDF3] font-medium">{formatCurrency(entry.amount)}</td>
                    <td className="px-4 py-3 text-right text-[#8B949E]">{formatNumber(entry.tokens_in)}</td>
                    <td className="px-4 py-3 text-right text-[#8B949E]">{formatNumber(entry.tokens_out)}</td>
                    <td className="px-4 py-3 text-right text-[#8B949E]">{formatNumber(entry.tokens_cached)}</td>
                    <td className="px-4 py-3 text-[#E6EDF3] font-mono text-xs">{entry.model_id || '—'}</td>
                    <td className="px-4 py-3 text-[#8B949E] text-xs">{entry.cost_period}</td>
                    <td className="px-4 py-3 text-[#6E7681] text-xs">{formatDateTime(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
