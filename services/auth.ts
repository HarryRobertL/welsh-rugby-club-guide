import { supabase } from '../lib/supabase';
import type { Database, UserRole } from '../types/database';

/**
 * Auth service: email/password sign up, sign in, sign out; profile (role) from public.users.
 * File: services/auth.ts — single place for auth calls; no UI.
 */

export type AuthProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  club_id: string | null;
  created_at: string;
  notify_lineup_published: boolean;
  notify_score_change: boolean;
  notify_full_time: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isAlreadyRegisteredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /user already registered/i.test(message);
}

function isDuplicateKeyError(error: unknown): boolean {
  const maybe = error as { code?: string; message?: string } | null | undefined;
  if (!maybe) return false;
  return maybe.code === '23505' || /duplicate key/i.test(maybe.message ?? '');
}

export async function signUp(email: string, password: string): Promise<{ error: Error | null }> {
  const cleanEmail = normalizeEmail(email);
  const { data, error: authError } = await supabase.auth.signUp({ email: cleanEmail, password });
  if (authError) {
    // If account exists, try sign-in with provided password for smoother recovery.
    if (isAlreadyRegisteredError(authError)) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (!signInError) return { error: null };
      return {
        error: new Error(
          'Account already exists. Sign in with your password, or reset it if needed.'
        ),
      };
    }
    return { error: authError as Error };
  }
  if (!data.user) return { error: new Error('No user returned') };

  // Session may be null when email confirmation is required by project settings.
  // In that case, profile row creation is deferred until first authenticated session.
  if (data.session?.user?.id) {
    // Insert type not fully inferred from custom Database type; remove when using supabase gen types
    const { error: profileError } = await (supabase.from('users') as any).insert({
      id: data.user.id,
      role: 'supporter',
    } satisfies Database['public']['Tables']['users']['Insert']);
    if (profileError && !isDuplicateKeyError(profileError)) return { error: profileError as Error };
  }
  return { error: null };
}

export async function signIn(email: string, password: string): Promise<{ error: Error | null }> {
  const cleanEmail = normalizeEmail(email);
  const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
  if (error) return { error: error as Error };

  const userId = data.user?.id;
  if (userId) {
    const { error: profileError } = await (supabase.from('users') as any).insert({
      id: userId,
      role: 'supporter',
    } satisfies Database['public']['Tables']['users']['Insert']);
    if (profileError && !isDuplicateKeyError(profileError)) {
      return { error: profileError as Error };
    }
  }

  return { error: null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getProfile(userId: string): Promise<AuthProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, avatar_url, role, club_id, created_at, notify_lineup_published, notify_score_change, notify_full_time')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as AuthProfile;
}
