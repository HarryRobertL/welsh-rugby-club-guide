/**
 * Create ingest items (fixtures, results, standings) from parsed competition output.
 * Uses canonical payloads and existing ingest_items / processed_status patterns.
 * Idempotent: upserts by run_id + external_id within the same run.
 * File: ingestion/sources/allwalessport/ingest_competition_items.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedCompetitionPage } from './parse_competition_page';
import { mapParsedToCanonical } from './map_to_canonical';

export type CreateIngestItemsFromParsedOptions = {
  supabase: SupabaseClient;
  runId: string;
  competitionCid: number;
  competitionLabel: string;
  sourceUrl: string;
  parsed: ParsedCompetitionPage;
};

/** One ingest item per type (fixtures, results, standings) per competition. */
const EXTERNAL_ID_PREFIX = 'allwalessport';

function externalId(type: 'fixtures' | 'results' | 'standings', cid: number): string {
  return `${EXTERNAL_ID_PREFIX}:${type}:${cid}`;
}

/**
 * Create or update three ingest items (fixtures, results, standings) for one competition.
 * If an item with the same run_id and external_id exists, update its payload and set processed_status to 'new'.
 */
export async function createIngestItemsFromParsed(
  options: CreateIngestItemsFromParsedOptions
): Promise<{ error: string | null; inserted: number; updated: number }> {
  const { supabase, runId, competitionCid, competitionLabel, sourceUrl, parsed } = options;
  const canonical = mapParsedToCanonical({
    parsed,
    competitionCid,
    competitionLabel,
    sourceUrl,
  });
  let inserted = 0;
  let updated = 0;

  const pairs: { entity_type: 'fixtures' | 'results' | 'standings'; items: unknown[] }[] = [
    { entity_type: 'fixtures', items: canonical.fixtures },
    { entity_type: 'results', items: canonical.results },
    { entity_type: 'standings', items: canonical.standings },
  ];

  for (const { entity_type, items } of pairs) {
    const extId = externalId(entity_type, competitionCid);
    const payload = {
      competitionCid,
      competitionLabel: entity_type === 'fixtures' ? competitionLabel : undefined,
      sourceUrl,
      items,
    };

    const { data: existing } = await (supabase.from('ingest_items') as any)
      .select('id')
      .eq('run_id', runId)
      .eq('external_id', extId)
      .maybeSingle();

    if (existing?.id) {
      const { error: updateErr } = await (supabase.from('ingest_items') as any)
        .update({ payload, processed_status: 'new' })
        .eq('id', (existing as { id: string }).id);
      if (updateErr) return { error: (updateErr as Error).message, inserted, updated };
      updated += 1;
    } else {
      const { error: insertErr } = await (supabase.from('ingest_items') as any).insert({
        run_id: runId,
        entity_type,
        external_id: extId,
        payload,
      });
      if (insertErr) return { error: (insertErr as Error).message, inserted, updated };
      inserted += 1;
    }
  }

  return { error: null, inserted, updated };
}
