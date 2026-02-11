import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env (copy from env.example)'
  );
}

if (/localhost|127\.0\.0\.1/i.test(supabaseUrl) && process.env.NODE_ENV === 'production') {
  throw new Error(
    'Supabase URL points to localhost in production. Set EXPO_PUBLIC_SUPABASE_URL to the remote project URL.'
  );
}

/**
 * Typed Supabase client. Use for all Supabase access (Auth, Realtime, Postgres).
 * Queries should use this client and Database types for type safety.
 *
 * File: lib/supabase.ts — central client; single place for URL/anon key and type parameter.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
