// Root app with routing and auth gate.
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { LoadingSpinner } from '@/components/ui';
import { AuthPage } from '@/pages/AuthPage';
import { Dashboard } from '@/pages/Dashboard';
import { AIRequests } from '@/pages/AIRequests';
import { CostExplorer } from '@/pages/CostExplorer';
import { Providers } from '@/pages/Providers';
import { Policies } from '@/pages/Policies';
import { CostLedger } from '@/pages/CostLedger';
import { Copilot } from '@/pages/Copilot';
import { Optimization } from '@/pages/Optimization';
import { Health } from '@/pages/Health';

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!session) {
    return <AuthPage />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/requests" element={<AIRequests />} />
        <Route path="/cost-explorer" element={<CostExplorer />} />
        <Route path="/providers" element={<Providers />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/ledger" element={<CostLedger />} />
        <Route path="/copilot" element={<Copilot />} />
        <Route path="/optimization" element={<Optimization />} />
        <Route path="/health" element={<Health />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}
