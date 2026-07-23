// Top bar with org selector and user menu.
import { useEffect, useState } from 'react';
import { LogOut, ChevronDown, Building2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export function TopBar() {
  const { user, signOut, orgId, setOrgId } = useAuth();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);

  useEffect(() => {
    api.getOrganizations().then(setOrgs).catch(() => {});
  }, []);

  const currentOrg = orgs.find((o) => o.id === orgId) || orgs[0];

  useEffect(() => {
    if (!orgId && orgs.length > 0) {
      setOrgId(orgs[0].id);
    }
  }, [orgId, orgs, setOrgId]);

  return (
    <header className="h-14 bg-[#0D1117] border-b border-[#30363D] flex items-center justify-between px-6 flex-shrink-0">
      <div className="relative">
        <button
          onClick={() => setOrgMenuOpen(!orgMenuOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#161B22] transition-colors"
        >
          <Building2 className="w-4 h-4 text-[#8B949E]" />
          <span className="text-sm font-medium text-[#E6EDF3]">
            {currentOrg?.name || 'Select Organization'}
          </span>
          <ChevronDown className="w-4 h-4 text-[#6E7681]" />
        </button>
        {orgMenuOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 card p-1 z-50 animate-fadeIn">
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => { setOrgId(org.id); setOrgMenuOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  org.id === orgId ? 'bg-[#3B82F6]/10 text-[#3B82F6]' : 'text-[#8B949E] hover:bg-[#161B22]'
                }`}
              >
                {org.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <span className="text-sm text-[#8B949E]">{user.email}</span>
        )}
        <button
          onClick={signOut}
          className="p-1.5 rounded-lg hover:bg-[#161B22] transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4 text-[#8B949E]" />
        </button>
      </div>
    </header>
  );
}
