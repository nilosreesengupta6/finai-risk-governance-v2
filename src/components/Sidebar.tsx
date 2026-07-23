// Sidebar navigation for the Enterprise AI Cost Intelligence platform.
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Zap, Search, Server, Shield, ScrollText,
  Bot, TrendingDown, Activity,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
  { to: '/requests', label: 'AI Requests', icon: Zap },
  { to: '/cost-explorer', label: 'Cost Explorer', icon: Search },
  { to: '/providers', label: 'Provider Gateway', icon: Server },
  { to: '/policies', label: 'Policy Engine', icon: Shield },
  { to: '/ledger', label: 'Cost Ledger', icon: ScrollText },
  { to: '/copilot', label: 'AI Copilot', icon: Bot },
  { to: '/optimization', label: 'Optimization', icon: TrendingDown },
  { to: '/health', label: 'System Health', icon: Activity },
];

export function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-[#0D1117] border-r border-[#30363D] flex flex-col flex-shrink-0">
      <div className="px-5 py-5 border-b border-[#30363D]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[#E6EDF3] leading-tight">AI Cost</h1>
            <p className="text-xs text-[#6E7681] leading-tight">Intelligence Platform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'text-[#3B82F6] bg-[#3B82F6]/8 border-r-2 border-[#3B82F6]'
                  : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#161B22]'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-3 border-t border-[#30363D]">
        <p className="text-xs text-[#484F58]">Enterprise v2.0.0</p>
      </div>
    </aside>
  );
}
