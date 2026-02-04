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

export async function signUp(email: string, password: string): Promise<{ error: Error | null }> {
  const { data, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError) return { error: authError as Error };
  if (!data.user) return { error: new Error('No user returned') };
  // Insert type not fully inferred from custom Database type; remove when using supabase gen types
  const { error: profileError } = await (supabase.from('users') as any).insert({
    id: data.user.id,
    role: 'supporter',
  } satisfies Database['public']['Tables']['users']['Insert']);
  if (profileError) return { error: profileError as Error };
  return { error: null };
}

export async function signIn(email: string, password: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error as Error | null };
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
