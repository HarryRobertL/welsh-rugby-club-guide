/**
 * Six Nations OVAL ingestion. Fetches standings and fixtures from OVAL API, persists to core tables.
 * Identity: source=sixnations, source_ref=compId:seasonId.
 * File: ingestion/sources/sixnations.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { registerSource } from './registry';
import { standingsUrl, fixturesUrl } from './sixnations/endpoints';
import {
  persistSixNations,
  type OvalStandingRow,
  type OvalFixtureRow,
} from './sixnations/persist';

const CONFIG_PATH = join(__dirname, '..', 'config', 'sixnations.json');

export type SixNationsConfig = {
  baseUrl: string;
  requestTimeoutMs: number;
  competitions: { compId: number; name: string; seasonIds: string[] }[];
};

export function loadSixNationsConfig(): SixNationsConfig {
  const raw = readFileSync(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const competitions = Array.isArray(parsed.competitions)
    ? (parsed.competitions as SixNationsConfig['competitions'])
    : [{ compId: 1055, name: 'Six Nations', seasonIds: ['202500', '202600'] }];
  return {
    baseUrl: (parsed.baseUrl as string) ?? 'https://oval.sixnationsrugby.com',
    requestTimeoutMs: Number(parsed.requestTimeoutMs) ?? 15000,
    competitions,
  };
}

const OVAL_ORIGIN = 'https://oval.sixnationsrugby.com';

function getOvalHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': 'en-GB,en;q=0.9',
    'User-Agent':
      process.env.SIXNATIONS_USER_AGENT ??
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: process.env.SIXNATIONS_REFERER ?? `${OVAL_ORIGIN}/rugby/`,
    Origin: OVAL_ORIGIN,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  };
  if (process.env.SIXNATIONS_COOKIE) {
    headers['Cookie'] = process.env.SIXNATIONS_COOKIE;
  }
  return headers;
}

async function fetchJson<T = unknown>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: getOvalHeaders(),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

/** OVAL standings API returns { groups: [{ team: { id, name }, position, points, won, lost, drawn, played, pointsFor, pointsAgainst }, ...] } */
function parseStandingsResponse(data: unknown): OvalStandingRow[] {
  if (!data || typeof data !== 'object') return [];
  const o = data as Record<string, unknown>;
  const groups = Array.isArray(o.groups) ? o.groups : null;
  if (groups && groups.length > 0) {
    return groups.map((g: Record<string, unknown>) => {
      const team = g.team as Record<string, unknown> | undefined;
      return {
        position: typeof g.position === 'number' ? g.position : undefined,
        teamId: team != null && (team.id !== undefined) ? team.id : undefined,
        teamName: team != null && typeof team.name === 'string' ? team.name : undefined,
        name: team != null && typeof team.shortName === 'string' ? (team.shortName as string) : undefined,
        played: typeof g.played === 'number' ? g.played : undefined,
        won: typeof g.won === 'number' ? g.won : undefined,
        drawn: typeof g.drawn === 'number' ? g.drawn : undefined,
        lost: typeof g.lost === 'number' ? g.lost : undefined,
        pointsFor: typeof g.pointsFor === 'number' ? g.pointsFor : undefined,
        pointsAgainst: typeof g.pointsAgainst === 'number' ? g.pointsAgainst : undefined,
        points: typeof g.points === 'number' ? g.points : undefined,
      } as OvalStandingRow;
    });
  }
  const arr =
    (Array.isArray(o.standings) ? o.standings : null) ??
    (Array.isArray(o.data) ? o.data : null) ??
    (Array.isArray(o.table) ? o.table : null) ??
    (Array.isArray(o) ? o : null);
  if (!arr) return [];
  return arr as OvalStandingRow[];
}

function parseFixturesResponse(data: unknown): OvalFixtureRow[] {
  if (!data || typeof data !== 'object') return [];
  const o = data as Record<string, unknown>;
  const arr =
    (Array.isArray(o.fixtures) ? o.fixtures : null) ??
    (Array.isArray(o.matches) ? o.matches : null) ??
    (Array.isArray(o.data) ? o.data : null) ??
    (Array.isArray(o) ? o : null);
  if (!arr) return [];
  return arr as OvalFixtureRow[];
}

async function ensureSixNationsSource(supabase: SupabaseClient): Promise<string> {
  const { data } = await (supabase.from('ingest_sources') as any)
    .select('id')
    .eq('slug', 'sixnations')
    .maybeSingle();
  if (data?.id) return (data as { id: string }).id;
  const { data: ins, error } = await (supabase.from('ingest_sources') as any)
    .insert({ name: 'Six Nations', slug: 'sixnations', config: {} })
    .select('id')
    .single();
  if (error) throw new Error(`ingest_sources: ${(error as Error).message}`);
  return (ins as { id: string }).id;
}

export async function runSixNationsIngest(options: {
  supabase: SupabaseClient;
  config?: SixNationsConfig;
  dryRun?: boolean;
}): Promise<{ error: string | null; metrics: Record<string, number> }> {
  const config = options.config ?? loadSixNationsConfig();
  const metrics = {
    competitionsProcessed: 0,
    standingsWritten: 0,
    fixturesWritten: 0,
    teamsCreated: 0,
  };
  if (options.dryRun) {
    return { error: null, metrics };
  }
  await ensureSixNationsSource(options.supabase);
  for (const comp of config.competitions) {
    for (const seasonId of comp.seasonIds) {
      let standings: OvalStandingRow[] = [];
      let fixtures: OvalFixtureRow[] = [];
      try {
        const standUrl = standingsUrl(comp.compId, seasonId);
        standings = parseStandingsResponse(await fetchJson(standUrl));
      } catch (e) {
        console.warn('[Six Nations] standings fetch failed', comp.compId, seasonId, (e as Error).message);
      }
      try {
        const fixUrl = fixturesUrl(comp.compId, seasonId);
        fixtures = parseFixturesResponse(await fetchJson(fixUrl));
      } catch (e) {
        console.warn('[Six Nations] fixtures fetch failed', comp.compId, seasonId, (e as Error).message);
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
        console.warn('[Six Nations] persist error', comp.compId, seasonId, result.error);
      } else {
        metrics.competitionsProcessed += 1;
        metrics.standingsWritten += result.standingsWritten;
        metrics.fixturesWritten += result.fixturesWritten;
        metrics.teamsCreated += result.teamsCreated;
      }
    }
  }
  return { error: null, metrics };
}

function registerSixNations(): void {
  registerSource({
    slug: 'sixnations',
    name: 'Six Nations',
    entityTypes: ['competition', 'fixture', 'result', 'standing'],
    run: async (options) => {
      const { supabaseAdmin } = await import('../lib/supabaseAdmin');
      const result = await runSixNationsIngest({
        supabase: supabaseAdmin,
        dryRun: options.dryRun,
      });
      if (result.error) return { error: result.error, metrics: result.metrics };
      return { error: null, metrics: result.metrics };
    },
  });
}

registerSixNations();
