/**
 * Parse stage: read ingest_items with processed_status = 'new', run parser by entity_type,
 * write payload.parsed and set processed_status to 'parsed' or 'failed'.
 * Canonical upsert (downstream): target existing core tables only — fixtures, teams, matches,
 * match_events, standings — and use source_team_map / source_competition_group_map for lookups.
 * See migration 20260202240000_pack_d_reconcile_core_schema.sql for target columns.
 * File: ingestion/parsers/run-parse.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { parseStandings } from './mywru/parseStandings';
import { parseFixtures } from './mywru/parseFixtures';
import { parseResults } from './mywru/parseResults';
import type { ParserMeta } from './mywru/types';

type IngestItemRow = {
  id: string;
  entity_type: string;
  payload: Record<string, unknown> & {
    raw?: unknown;
    competition_group_id?: string;
    competition_instance_id?: string;
  };
};

/** Pass-through for AllWalesSport canonical payloads (payload.items is already canonical). */
function passThroughItems(raw: unknown): unknown[] {
  if (raw != null && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).items)) {
    return (raw as Record<string, unknown>).items as unknown[];
  }
  return [];
}

const PARSERS: Record<
  string,
  (raw: unknown, meta: ParserMeta) => unknown[]
> = {
  standing: (raw, meta) => parseStandings(raw, meta),
  fixture: (raw, meta) => parseFixtures(raw, meta),
  fixtures: (raw) => passThroughItems(raw),
  result: (raw, meta) => parseResults(raw, meta),
  results: (raw) => passThroughItems(raw),
  standings: (raw) => passThroughItems(raw),
};

export type RunParseOptions = {
  supabase: SupabaseClient;
  /** Max items to process in one run. */
  limit?: number;
};

export type RunParseResult = {
  error: string | null;
  processed: number;
  counts: Record<string, number>;
};

export async function runParse(
  options: RunParseOptions
): Promise<RunParseResult> {
  const { supabase, limit = 500 } = options;
  const counts: Record<string, number> = {};
  let processed = 0;

  const { data: items, error: fetchErr } = await (supabase.from('ingest_items') as any)
    .select('id, entity_type, payload')
    .eq('processed_status', 'new')
    .in('entity_type', ['standing', 'fixture', 'result', 'fixtures', 'results', 'standings'])
    .limit(limit);

  if (fetchErr) {
    return { error: (fetchErr as Error).message, processed: 0, counts: {} };
  }

  const rows = (items ?? []) as IngestItemRow[];

  const ALLWALESSPORT_TYPES = ['fixtures', 'results', 'standings'];

  for (const row of rows) {
    const raw = ALLWALESSPORT_TYPES.includes(row.entity_type)
      ? row.payload
      : row.payload?.raw;
    const competition_group_id =
      row.payload?.competition_group_id != null
        ? String(row.payload.competition_group_id)
        : row.payload?.competitionCid != null
          ? String(row.payload.competitionCid)
          : '';
    const competition_instance_id =
      row.payload?.competition_instance_id != null
        ? String(row.payload.competition_instance_id)
        : undefined;

    if (!competition_group_id && !ALLWALESSPORT_TYPES.includes(row.entity_type)) {
      await (supabase.from('ingest_items') as any)
        .update({
          processed_status: 'failed',
          payload: {
            ...row.payload,
            parse_error: 'missing competition_group_id in payload',
          },
        })
        .eq('id', row.id);
      processed++;
      continue;
    }

    const meta: ParserMeta = {
      competition_group_id: competition_group_id || 'allwalessport',
      competition_instance_id,
    };
    const parser = PARSERS[row.entity_type];

    if (!parser) {
      await (supabase.from('ingest_items') as any)
        .update({
          processed_status: 'failed',
          payload: {
            ...row.payload,
            parse_error: `no parser for entity_type: ${row.entity_type}`,
          },
        })
        .eq('id', row.id);
      processed++;
      continue;
    }

    try {
      const parsed = parser(raw, meta);
      const parsedArray = Array.isArray(parsed) ? parsed : [];
      counts[row.entity_type] = (counts[row.entity_type] ?? 0) + parsedArray.length;
      await (supabase.from('ingest_items') as any)
        .update({
          processed_status: 'parsed',
          payload: {
            ...row.payload,
            parsed: parsedArray,
          },
        })
        .eq('id', row.id);
    } catch (e) {
      const errMsg = (e as Error).message ?? String(e);
      await (supabase.from('ingest_items') as any)
        .update({
          processed_status: 'failed',
          payload: {
            ...row.payload,
            parse_error: errMsg,
          },
        })
        .eq('id', row.id);
    }
    processed++;
  }

  if (Object.keys(counts).length > 0) {
    const parts = Object.entries(counts)
      .map(([k, n]) => `${k}: ${n}`)
      .join(', ');
    console.info('[parse] parsed counts:', parts);
  }

  return { error: null, processed, counts };
}
