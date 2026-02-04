import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getProfile, signIn as authSignIn, signOut as authSignOut, signUp as authSignUp } from '../../services/auth';
import type { AuthProfile } from '../../services/auth';
import type { UserRole } from '../../types/database';
import type { Session } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  profile: AuthProfile | null;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth provider: session, profile (role), loading; signIn, signUp, signOut; hasRole / hasAnyRole for gating.
 * File: features/auth/AuthContext.tsx — wraps app; consumed by layouts and screens.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfileByUserId = useCallback(async (userId: string) => {
    const p = await getProfile(userId);
    setProfile(p);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) await refreshProfileByUserId(session.user.id);
  }, [session?.user?.id, refreshProfileByUserId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user?.id) refreshProfileByUserId(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s?.user?.id) await refreshProfileByUserId(s.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, [refreshProfileByUserId]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authSignIn(email, password);
    return result;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await authSignUp(email, password);
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    setProfile(null);
  }, []);

  const hasRole = useCallback((role: UserRole) => profile?.role === role, [profile?.role]);
  const hasAnyRole = useCallback((roles: UserRole[]) => (profile?.role ? roles.includes(profile.role) : false), [profile?.role]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      hasRole,
      hasAnyRole,
    }),
    [session, profile, loading, signIn, signUp, signOut, refreshProfile, hasRole, hasAnyRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
