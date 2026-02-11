import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

/**
 * Ingestion-only Supabase client using the service role key.
 * Must never be imported by /app or any browser code.
 * File: ingestion/lib/supabaseAdmin.ts
 */
if (typeof window !== 'undefined') {
  throw new Error('supabaseAdmin must never run in the browser');
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing Supabase env for ingestion: set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
}

const isLocalUrl = /localhost|127\.0\.0\.1/i.test(supabaseUrl);
const allowLocal = process.env.ALLOW_LOCAL_SUPABASE === '1';
if (isLocalUrl && !allowLocal) {
  throw new Error(
    'Ingestion is configured for a local Supabase URL. For staging/prod runs, point EXPO_PUBLIC_SUPABASE_URL to the remote project (or set ALLOW_LOCAL_SUPABASE=1 for local dev).'
  );
}

export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
