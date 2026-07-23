// Auth context: manages Supabase session, user, and org context.
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const DEFAULT_ORG_ID = '1122c6cb-be06-4a88-a8fd-d8f8d2375a3f';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  orgId: string | null;
  setOrgId: (id: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(
    () => localStorage.getItem('acig_org_id')
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      resolveOrgId(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
      resolveOrgId(sess);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function resolveOrgId(sess: Session | null) {
    if (localStorage.getItem('acig_org_id')) {
      setOrgId(localStorage.getItem('acig_org_id'));
      return;
    }
    try {
      const { data } = await supabase.from('organizations').select('id').limit(1);
      if (data && data.length > 0) {
        handleSetOrgId(data[0].id);
      } else {
        handleSetOrgId(DEFAULT_ORG_ID);
      }
    } catch {
      handleSetOrgId(DEFAULT_ORG_ID);
    }
  }

  const handleSetOrgId = (id: string) => {
    localStorage.setItem('acig_org_id', id);
    setOrgId(id);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('acig_org_id');
    setOrgId(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, orgId, setOrgId: handleSetOrgId, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
