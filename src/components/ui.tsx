// Reusable UI components for the enterprise dark theme.
import { ReactNode } from 'react';

export function Card({ children, className = '', hover = false, style }: { children: ReactNode; className?: string; hover?: boolean; style?: React.CSSProperties }) {
  return (
    <div className={`card ${hover ? 'card-hover' : ''} ${className}`} style={style}>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-400 border-green-500/30',
    success: 'bg-green-500/10 text-green-400 border-green-500/30',
    cached: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    degraded: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    inactive: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    suspended: 'bg-red-500/10 text-red-400 border-red-500/30',
    expired: 'bg-red-500/10 text-red-400 border-red-500/30',
    blocked: 'bg-red-500/10 text-red-400 border-red-500/30',
    failed: 'bg-red-500/10 text-red-400 border-red-500/30',
    rate_limited: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    applied: 'bg-green-500/10 text-green-400 border-green-500/30',
    dismissed: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    draft: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    disabled: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    approved: 'bg-green-500/10 text-green-400 border-green-500/30',
    denied: 'bg-red-500/10 text-red-400 border-red-500/30',
    warn: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  };
  const cls = colors[status.toLowerCase()] || 'bg-gray-500/10 text-gray-400 border-gray-500/30';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status}
    </span>
  );
}

export function RiskBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    LOW: 'bg-green-500/10 text-green-400 border-green-500/30',
    MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    HIGH: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  const cls = colors[tier.toUpperCase()] || colors.LOW;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {tier}
    </span>
  );
}

export function DecisionBadge({ decision }: { decision: string }) {
  const isApproved = decision.toUpperCase() === 'APPROVED';
  const cls = isApproved
    ? 'bg-green-500/10 text-green-400 border-green-500/30'
    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
  const icon = isApproved ? '\u2713' : '\u26A0';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {icon} {decision}
    </span>
  );
}

export function KPICard({ label, value, sub, icon, accent = false }: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <Card hover className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[#8B949E] mb-1">{label}</p>
          <p className={`text-2xl font-semibold ${accent ? 'text-[#3B82F6]' : 'text-[#E6EDF3]'}`}>{value}</p>
          {sub && <p className="text-xs text-[#6E7681] mt-1">{sub}</p>}
        </div>
        {icon && <div className="text-[#6E7681]">{icon}</div>}
      </div>
    </Card>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#E6EDF3]">{title}</h1>
        {subtitle && <p className="text-sm text-[#8B949E] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ message, icon }: { message: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-[#484F58] mb-3">{icon}</div>}
      <p className="text-[#8B949E]">{message}</p>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-[#30363D] border-t-[#3B82F6] rounded-full animate-spin" />
    </div>
  );
}

export function formatCurrency(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01) return `$${value.toFixed(6)}`;
  return `$${value.toFixed(2)}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
