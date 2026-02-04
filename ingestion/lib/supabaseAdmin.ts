/**
 * Ingestion-only Supabase client using the service role key.
 * Must never be imported by /app or any browser code.
 * File: ingestion/lib/supabaseAdmin.ts
 */
if (typeof window !== 'undefined') {
  throw new Error('supabaseAdmin must never run in the browser');
}

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing Supabase env for ingestion: set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
}

export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
