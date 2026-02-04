/**
 * AllWalesSport ingestion source: config load, source registration, competition discovery.
 * Produces ingest_items with entity_type: competition | fixtures | results | standings | form_table.
 * File: ingestion/sources/allwalessport.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AllWalesSportConfig } from '../../types/ingestion';
import { registerSource } from './registry';
import { createAllWalesSportHttpClient } from './allwalessport/http';
import {
  discoverCompetitionsFromNav,
  type DiscoveredCompetition,
} from './allwalessport/discovery';
import { parseCompetitionPage } from './allwalessport/parse_competition_page';
import { createIngestItemsFromParsed } from './allwalessport/ingest_competition_items';

const CONFIG_PATH = join(__dirname, '..', 'config', 'allwalessport.json');

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function loadAllWalesSportConfig(): AllWalesSportConfig {
  const raw = readFileSync(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const rateLimitPerSecond = Number(parsed.rateLimitPerSecond) || 2;
  const envCid = process.env.ALLWALESSPORT_CID;
  const startFromEnv =
    envCid !== undefined && envCid !== ''
      ? parseInt(envCid, 10)
      : undefined;
  const startCid =
    startFromEnv !== undefined && !Number.isNaN(startFromEnv)
      ? startFromEnv
      : typeof parsed.startCompetitionCid === 'number'
        ? parsed.startCompetitionCid
        : undefined;
  return {
    baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : 'https://www.allwalessport.co.uk',
    sportPath: typeof parsed.sportPath === 'string' ? parsed.sportPath : '/rugby-union.aspx',
    startCompetitionCid: startCid,
    competitionCidAllowlist: Array.isArray(parsed.competitionCidAllowlist)
      ? (parsed.competitionCidAllowlist as number[])
      : undefined,
    requestTimeoutMs: Number(parsed.requestTimeoutMs) || 15000,
    userAgent:
      typeof parsed.userAgent === 'string' ? parsed.userAgent : DEFAULT_USER_AGENT,
    rateLimitPerSecond,
    maxCompetitions: Number(parsed.maxCompetitions) || 200,
    maxPagesPerCompetition: Number(parsed.maxPagesPerCompetition) || 20,
  };
}

async function ensureAllWalesSportSource(supabase: SupabaseClient): Promise<string> {
  const { data: existing } = await (supabase.from('ingest_sources') as any)
    .select('id')
    .eq('slug', 'allwalessport')
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: inserted, error } = await (supabase.from('ingest_sources') as any)
    .insert({ name: 'AllWalesSport', slug: 'allwalessport', config: {} })
    .select('id')
    .single();
  if (error) throw new Error(`ingest_sources insert: ${(error as Error).message}`);
  return (inserted as { id: string }).id;
}

export type RunAllWalesSportOptions = {
  config?: AllWalesSportConfig;
  httpClient: ReturnType<typeof createAllWalesSportHttpClient>;
  supabase: SupabaseClient;
  /** When true, scrape still runs but fixtures/results/standings are not written to ingest_items (only competition items). Logs parsed counts. */
  dryRun?: boolean;
};

function buildCompetitionPayload(c: DiscoveredCompetition): Record<string, unknown> {
  return {
    source: 'allwalessport',
    competitionCid: String(c.cid),
    label: c.label,
    url: c.url,
    sport: 'rugby union',
    country: 'wales',
  };
}

/** Which competitions to scrape for fixtures/results/standings in this run. */
function competitionsToScrape(
  competitions: DiscoveredCompetition[],
  config: AllWalesSportConfig
): DiscoveredCompetition[] {
  if (config.startCompetitionCid != null) {
    const one = competitions.find((c) => c.cid === config.startCompetitionCid);
    return one ? [one] : [];
  }
  if (config.competitionCidAllowlist && config.competitionCidAllowlist.length > 0) {
    const set = new Set(config.competitionCidAllowlist);
    return competitions.filter((c) => set.has(c.cid));
  }
  const max = Math.min(config.maxPagesPerCompetition ?? 20, competitions.length);
  return competitions.slice(0, max);
}

/**
 * Run AllWalesSport competition discovery: fetch rugby union nav, parse cid links,
 * apply filters, emit one ingest_item per competition with provenance.
 */
export async function runAllWalesSportDiscovery(
  options: RunAllWalesSportOptions
): Promise<{ error: string | null; stats: { runs: number; ingestItems: number } }> {
  const { httpClient, supabase } = options;
  const config = options.config ?? loadAllWalesSportConfig();
  const stats = { runs: 0, ingestItems: 0 };

  const sourceId = await ensureAllWalesSportSource(supabase);

  const { data: runRow, error: runErr } = await (supabase.from('ingest_runs') as any)
    .insert({
      source_id: sourceId,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (runErr) return { error: `ingest_runs: ${(runErr as Error).message}`, stats };
  const runId = (runRow as { id: string }).id;
  stats.runs = 1;

  try {
    const discovery = await discoverCompetitionsFromNav({ config, httpClient });
    if (discovery.error) {
      await (supabase.from('ingest_runs') as any)
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error: discovery.error,
        })
        .eq('id', runId);
      return { error: discovery.error, stats };
    }

    const competitions = discovery.competitions;
    const count = competitions.length;
    console.info('[ingestion] AllWalesSport discovery: competitions found', count);
    const first5 = competitions.slice(0, 5).map((c) => c.label);
    if (first5.length > 0) {
      console.info('[ingestion] AllWalesSport discovery: first 5 labels', first5);
    }

    for (const c of competitions) {
      const externalId = `allwalessport:competition:${c.cid}`;
      const payload = buildCompetitionPayload(c);
      await (supabase.from('ingest_items') as any).insert({
        run_id: runId,
        entity_type: 'competition',
        external_id: externalId,
        payload,
      });
      stats.ingestItems += 1;
    }

    const toScrape = competitionsToScrape(competitions, config);
    const dryRun = options.dryRun === true;
    for (const c of toScrape) {
      try {
        const $ = await httpClient.fetchDocument(c.url);
        const parsed = parseCompetitionPage($);
        const fixtureCount = parsed.fixturesBlocks.reduce((s, b) => s + b.rows.length, 0);
        const resultCount = parsed.resultsBlocks.reduce((s, b) => s + b.rows.length, 0);
        const standingCount = parsed.standingsRows.length;
        console.info('[ingestion] AllWalesSport parsed cid', c.cid, parsed.competitionTitle, {
          tabsFound: parsed.tabsFound,
          fixtures: fixtureCount,
          results: resultCount,
          standings: standingCount,
        });
        if (dryRun) {
          continue;
        }
        const result = await createIngestItemsFromParsed({
          supabase,
          runId,
          competitionCid: c.cid,
          competitionLabel: c.label,
          sourceUrl: c.url,
          parsed,
        });
        if (result.error) {
          console.warn('[ingestion] AllWalesSport scrape failed for cid', c.cid, result.error);
          continue;
        }
        stats.ingestItems += result.inserted + result.updated;
      } catch (e) {
        console.warn('[ingestion] AllWalesSport scrape error for cid', c.cid, (e as Error).message);
      }
    }

    await (supabase.from('ingest_runs') as any)
      .update({ status: 'completed', finished_at: new Date().toISOString() })
      .eq('id', runId);
  } catch (e) {
    await (supabase.from('ingest_runs') as any)
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error: (e as Error).message,
      })
      .eq('id', runId);
    return { error: (e as Error).message, stats };
  }

  return { error: null, stats };
}

function registerAllWalesSport(): void {
  registerSource({
    slug: 'allwalessport',
    name: 'AllWalesSport',
    entityTypes: ['competition', 'fixture', 'result', 'standing', 'form_table'],
    run: async (options) => {
      const { supabaseAdmin } = await import('../lib/supabaseAdmin');
      const config = loadAllWalesSportConfig();
      const httpClient = createAllWalesSportHttpClient({
        baseUrl: config.baseUrl,
        userAgent: config.userAgent,
        requestTimeoutMs: config.requestTimeoutMs,
        rateLimitPerSecond: config.rateLimitPerSecond,
      });
      const result = await runAllWalesSportDiscovery({
        config,
        httpClient,
        supabase: supabaseAdmin,
        dryRun: options.dryRun,
      });
      if (result.error) {
        console.error('[ingestion] AllWalesSport discovery failed:', result.error);
        return { error: result.error };
      }
      console.info('[ingestion] AllWalesSport discovery:', result.stats);
      return { error: null };
    },
  });
}

registerAllWalesSport();
