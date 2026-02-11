/**
 * Run only MyWRU persist (for debugging). Requires existing parsed ingest_items.
 * Usage: npx ts-node --project tsconfig.ingest.json ingestion/run-persist-only.ts
 */
import './load-env';
import { supabaseAdmin } from './lib/supabaseAdmin';
import { runPersistMyWru } from './sources/mywru/persist';

async function main() {
  const result = await runPersistMyWru({ supabase: supabaseAdmin });
  console.log('[persist-only] result:', result);
  if (result.error) console.error('[persist-only] error:', result.error);
  if (result.failures.length) console.warn('[persist-only] failures:', result.failures.slice(0, 5));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
