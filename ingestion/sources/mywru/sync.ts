/**
 * MyWRU polling: fetch fixtures/results/standings per competition group and write ingest_items.
 * Uses JSON API base URL (config.groupsApiBaseUrl) where available.
 * File: ingestion/sources/mywru/sync.ts
 */
import type { IngestHttpClient } from '../../lib/http';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  competitionGroupFixtures,
  competitionGroupResults,
  competitionGroupLeagueTable,
} from './endpoints';
import type { MyWruConfig } from '../mywru';

type GroupRow = {
  competition_group_id: string;
  competition_instance_id: string;
  name: string;
};

type RunMyWruSyncResult = {
  error: string | null;
  groups: number;
  fixturesFetched: number;
  resultsFetched: number;
  standingsFetched: number;
  ingestItems: number;
};

async function ensureMyWruSource(supabase: SupabaseClient): Promise<string> {
  const { data: existing } = await (supabase.from('ingest_sources') as any)
    .select('id')
    .eq('slug', 'mywru')
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: inserted, error } = await (supabase.from('ingest_sources') as any)
    .insert({ name: 'MyWRU', slug: 'mywru', config: {} })
    .select('id')
    .single();
  if (error) throw new Error(`ingest_sources insert: ${(error as Error).message}`);
  return (inserted as { id: string }).id;
}

async function fetchJson(
  httpClient: IngestHttpClient,
  path: string
): Promise<unknown | null> {
  const res = await httpClient.get(path);
  if (res.status < 200 || res.status >= 300) return null;
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

async function upsertIngestItem(
  supabase: SupabaseClient,
  runId: string,
  entityType: 'fixture' | 'result' | 'standing',
  externalId: string,
  payload: Record<string, unknown>
): Promise<'inserted' | 'updated'> {
  const { data: existing } = await (supabase.from('ingest_items') as any)
    .select('id')
    .eq('run_id', runId)
    .eq('external_id', externalId)
    .maybeSingle();
  if (existing?.id) {
    await (supabase.from('ingest_items') as any)
      .update({ payload, processed_status: 'new' })
      .eq('id', (existing as { id: string }).id);
    return 'updated';
  }
  await (supabase.from('ingest_items') as any).insert({
    run_id: runId,
    entity_type: entityType,
    external_id: externalId,
    payload,
  });
  return 'inserted';
}

export async function runMyWruSync(options: {
  config: MyWruConfig;
  httpClient: IngestHttpClient;
  supabase: SupabaseClient;
}): Promise<RunMyWruSyncResult> {
  const { httpClient, supabase } = options;
  const out: RunMyWruSyncResult = {
    error: null,
    groups: 0,
    fixturesFetched: 0,
    resultsFetched: 0,
    standingsFetched: 0,
    ingestItems: 0,
  };
  let runId: string | null = null;

  try {
    const sourceId = await ensureMyWruSource(supabase);
    const { data: runRow, error: runErr } = await (supabase.from('ingest_runs') as any)
      .insert({
        source_id: sourceId,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (runErr) return { ...out, error: `ingest_runs: ${(runErr as Error).message}` };
    runId = (runRow as { id: string }).id;

    const { data: groups } = await (supabase.from('mywru_competition_groups') as any)
      .select('competition_group_id, competition_instance_id, name')
      .order('competition_group_id', { ascending: true });
    const groupRows = (groups ?? []) as GroupRow[];
    out.groups = groupRows.length;
    if (groupRows.length === 0) {
      await (supabase.from('ingest_runs') as any)
        .update({ status: 'completed', finished_at: new Date().toISOString() })
        .eq('id', runId);
      return out;
    }

    for (const g of groupRows) {
      if (httpClient.hasReachedRequestLimit()) break;
      const groupId = Number(g.competition_group_id);
      if (!Number.isFinite(groupId)) continue;

      const fixturesPath = competitionGroupFixtures(groupId);
      const resultsPath = competitionGroupResults(groupId);
      const tablePath = competitionGroupLeagueTable(groupId);

      const [fixtures, results, standings] = await Promise.all([
        fetchJson(httpClient, fixturesPath),
        fetchJson(httpClient, resultsPath),
        fetchJson(httpClient, tablePath),
      ]);

      if (fixtures) {
        out.fixturesFetched += 1;
        const res = await upsertIngestItem(
          supabase,
          runId,
          'fixture',
          `mywru:fixture:${g.competition_group_id}`,
          {
            raw: fixtures,
            competition_group_id: g.competition_group_id,
            competition_instance_id: g.competition_instance_id,
            name: g.name,
            source: 'mywru_poll',
          }
        );
        out.ingestItems += res === 'inserted' ? 1 : 0;
      }

      if (results) {
        out.resultsFetched += 1;
        const res = await upsertIngestItem(
          supabase,
          runId,
          'result',
          `mywru:result:${g.competition_group_id}`,
          {
            raw: results,
            competition_group_id: g.competition_group_id,
            competition_instance_id: g.competition_instance_id,
            name: g.name,
            source: 'mywru_poll',
          }
        );
        out.ingestItems += res === 'inserted' ? 1 : 0;
      }

      if (standings) {
        out.standingsFetched += 1;
        const res = await upsertIngestItem(
          supabase,
          runId,
          'standing',
          `mywru:standing:${g.competition_group_id}`,
          {
            raw: standings,
            competition_group_id: g.competition_group_id,
            competition_instance_id: g.competition_instance_id,
            name: g.name,
            source: 'mywru_poll',
          }
        );
        out.ingestItems += res === 'inserted' ? 1 : 0;
      }
    }

    await (supabase.from('ingest_runs') as any)
      .update({ status: 'completed', finished_at: new Date().toISOString() })
      .eq('id', runId);
  } catch (e) {
    out.error = (e as Error).message;
    if (runId) {
      await (supabase.from('ingest_runs') as any)
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId);
    }
  }

  return out;
}
