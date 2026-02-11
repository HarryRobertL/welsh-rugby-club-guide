/**
 * Six Nations www ingestion. Scrapes fixture table from www.sixnationsrugby.com
 * when OVAL API is not available. No API key required.
 * Identity: same as OVAL (source=sixnations, source_ref=compId:seasonId).
 * File: ingestion/sources/sixnations-www.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { registerSource } from './registry';
import { persistSixNations } from './sixnations/persist';
import type { OvalFixtureRow, OvalStandingRow } from './sixnations/persist';
import { parseSixNationsWwwPage, sixnationsWwwTableUrl } from './sixnations/parse-www';
import { loadSixNationsConfig } from './sixnations';

const WWW_ORIGIN = 'https://www.sixnationsrugby.com';

function getWwwHeaders(): Record<string, string> {
  return {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
    'User-Agent':
      process.env.SIXNATIONS_USER_AGENT ??
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: `${WWW_ORIGIN}/en`,
  };
}

async function fetchWwwHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      headers: getWwwHeaders(),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureSixNationsSource(supabase: SupabaseClient): Promise<void> {
  const { data } = await (supabase.from('ingest_sources') as any)
    .select('id')
    .eq('slug', 'sixnations')
    .maybeSingle();
  if (data?.id) return;
  await (supabase.from('ingest_sources') as any).insert({
    name: 'Six Nations',
    slug: 'sixnations',
    config: {},
  });
}

export async function runSixNationsWwwIngest(options: {
  supabase: SupabaseClient;
  config?: { compId: number; name: string; seasonIds: string[] }[];
  dryRun?: boolean;
}): Promise<{ error: string | null; metrics: Record<string, number> }> {
  const config = options.config ?? loadSixNationsConfig().competitions;
  const metrics = {
    competitionsProcessed: 0,
    standingsWritten: 0,
    fixturesWritten: 0,
    teamsCreated: 0,
    pagesFetched: 0,
  };
  if (options.dryRun) {
    return { error: null, metrics };
  }
  await ensureSixNationsSource(options.supabase);
  for (const comp of config) {
    for (const seasonId of comp.seasonIds) {
      try {
        const url = sixnationsWwwTableUrl(seasonId);
        let html = await fetchWwwHtml(url);
        metrics.pagesFetched += 1;
        let parsed = parseSixNationsWwwPage(html, seasonId);
        let fixtures: OvalFixtureRow[] = parsed.fixtures;
        let standings: OvalStandingRow[] = parsed.standings;
        if (fixtures.length === 0 && standings.length === 0) {
          try {
            const rscUrl = `${url}?_rsc=1`;
            const rsc = await fetchWwwHtml(rscUrl);
            metrics.pagesFetched += 1;
            parsed = parseSixNationsWwwPage(rsc, seasonId);
            fixtures = parsed.fixtures;
            standings = parsed.standings;
          } catch {
            /* RSC fallback optional */
          }
        }
        const result = await persistSixNations({
          supabase: options.supabase,
          compId: comp.compId,
          seasonId,
          competitionName: comp.name,
          standings,
          fixtures,
        });
        if (result.error) {
          console.warn('[Six Nations www] persist error', comp.compId, seasonId, result.error);
        } else {
          metrics.competitionsProcessed += 1;
          metrics.standingsWritten += result.standingsWritten;
          metrics.fixturesWritten += result.fixturesWritten;
          metrics.teamsCreated += result.teamsCreated;
          console.info('[Six Nations www]', seasonId, 'standings:', result.standingsWritten, 'fixtures:', result.fixturesWritten);
        }
      } catch (e) {
        console.warn('[Six Nations www] fetch/parse failed', comp.compId, seasonId, (e as Error).message);
      }
    }
  }
  return { error: null, metrics };
}

function registerSixNationsWww(): void {
  registerSource({
    slug: 'sixnations_www',
    name: 'Six Nations (www scrape)',
    entityTypes: ['competition', 'fixture', 'result'],
    run: async (options) => {
      const { supabaseAdmin } = await import('../lib/supabaseAdmin');
      const result = await runSixNationsWwwIngest({
        supabase: supabaseAdmin,
        dryRun: options.dryRun,
      });
      if (result.error) return { error: result.error, metrics: result.metrics };
      return { error: null, metrics: result.metrics };
    },
  });
}

registerSixNationsWww();
