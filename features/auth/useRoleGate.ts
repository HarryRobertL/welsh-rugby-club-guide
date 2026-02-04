import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from './AuthContext';
import type { UserRole } from '../../types/database';

/**
 * Role gate: redirect away if current user doesn't have one of the allowed roles.
 * Use in a screen that requires club_admin, league_admin, etc.
 * File: features/auth/useRoleGate.ts — role-aware navigation gating.
 *
 * @param allowedRoles — e.g. ['club_admin', 'league_admin']
 * @param redirectHref — where to send unauthorized users (default: /account)
 */
export function useRoleGate(allowedRoles: UserRole[], redirectHref: string = '/(tabs)/account') {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const allowed = profile?.role && allowedRoles.includes(profile.role);
    if (!allowed) {
      router.replace(redirectHref as any);
    }
  }, [loading, profile?.role, allowedRoles, redirectHref, router]);

  return { allowed: !!profile?.role && allowedRoles.includes(profile.role), loading };
}
