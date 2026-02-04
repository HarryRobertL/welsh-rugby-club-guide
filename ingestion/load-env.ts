/**
 * Load .env and .env.local before any other ingestion code runs.
 * Must be imported first in ingestion/run.ts so Supabase env vars are set.
 */
import { config } from 'dotenv';
import { resolve } from 'path';

const cwd = process.cwd();
config({ path: resolve(cwd, '.env') });
config({ path: resolve(cwd, '.env.local') });
