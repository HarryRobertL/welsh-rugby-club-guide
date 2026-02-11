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
import { deriveCompetitionTypeFromName } from '../lib/deriveCompetitionType';
import {
  discoverCompetitionsFromNav,
  type DiscoveredCompetition,
  type CompetitionCategoryNode,
} from './allwalessport/discovery';
import { parseCompetitionPage } from './allwalessport/parse_competition_page';
import { createIngestItemsFromParsed } from './allwalessport/ingest_competition_items';

const CONFIG_PATH = join(__dirname, '..', 'config', 'allwalessport.json');

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function isWruControlledCompetitionName(name: string | null | undefined): boolean {
  const n = (name ?? '').toLowerCase().trim();
  if (!n) return false;
  if (n.includes('bucs')) return false;
  const patterns = [
    'welsh national league',
    'welsh national leagues',
    'welsh regional',
    'wru',
    'cardiff rugby',
    'dragons',
    'ospreys',
    'blues',
    'scarlets',
    'east wales',
    'west wales',
    'north wales',
    'central wales',
    'east central',
    'west central',
    'division ',
    'premiership',
    'championship',
    'regional age grade',
    'age grade',
    'u12',
    'u13',
    'u14',
    'u15',
    'u16',
  ];
  return patterns.some((p) => n.includes(p));
}

/** Parse ALLWALESSPORT_ALLOWLIST env (comma-separated ids or exact names, e.g. BUCS,1055). */
function parseAllowlistFromEnv(): { cids: number[]; names: string[] } {
  const raw = process.env.ALLWALESSPORT_ALLOWLIST;
  if (!raw || typeof raw !== 'string') return { cids: [], names: [] };
  const cids: number[] = [];
  const names: string[] = [];
  for (const s of raw.split(',').map((x) => x.trim()).filter(Boolean)) {
    const n = parseInt(s, 10);
    if (String(n) === s && !Number.isNaN(n)) cids.push(n);
    else names.push(s);
  }
  return { cids, names };
}

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
  const maxCompetitionsDiscovered =
    Number(parsed.maxCompetitionsDiscovered ?? parsed.maxCompetitions) || 200;
  const maxCompetitionsScraped =
    Number(parsed.maxCompetitionsScraped ?? parsed.maxPagesPerCompetition ?? maxCompetitionsDiscovered) ||
    maxCompetitionsDiscovered;
  const configCids = Array.isArray(parsed.competitionCidAllowlist)
    ? (parsed.competitionCidAllowlist as number[])
    : [];
  const configNames = Array.isArray(parsed.competitionNameAllowlist)
    ? (parsed.competitionNameAllowlist as string[])
    : [];
  const envAllowlist = parseAllowlistFromEnv();
  const hasAllowlist = configCids.length > 0 || configNames.length > 0 || envAllowlist.cids.length > 0 || envAllowlist.names.length > 0;
  const competitionCidAllowlist = hasAllowlist
    ? [...new Set([...configCids, ...envAllowlist.cids])]
    : undefined;
  const competitionNameAllowlist = hasAllowlist
    ? [...new Set([...configNames, ...envAllowlist.names])]
    : undefined;
  return {
    baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : 'https://www.allwalessport.co.uk',
    sportPath: typeof parsed.sportPath === 'string' ? parsed.sportPath : '/rugby-union.aspx',
    startCompetitionCid: startCid,
    competitionCidAllowlist: competitionCidAllowlist?.length ? competitionCidAllowlist : undefined,
    competitionNameAllowlist: competitionNameAllowlist?.length ? competitionNameAllowlist : undefined,
    requestTimeoutMs: Number(parsed.requestTimeoutMs) || 15000,
    userAgent:
      typeof parsed.userAgent === 'string' ? parsed.userAgent : DEFAULT_USER_AGENT,
    rateLimitPerSecond,
    maxCompetitionsDiscovered,
    maxCompetitionsScraped,
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
    categorySlug: c.categorySlug,
    sortOrder: c.sortOrder,
  };
}

type FlatCategory = {
  name: string;
  slug: string;
  parentSlug?: string;
  sortOrder: number;
  cid?: number;
  depth: number;
};

function flattenCategories(
  nodes: CompetitionCategoryNode[],
  parentSlug?: string,
  depth = 0
): FlatCategory[] {
  const out: FlatCategory[] = [];
  for (const node of nodes) {
    out.push({
      name: node.name,
      slug: node.slug,
      parentSlug,
      sortOrder: node.sortOrder,
      cid: node.cid,
      depth,
    });
    if (node.children.length > 0) {
      out.push(...flattenCategories(node.children, node.slug, depth + 1));
    }
  }
  return out;
}

async function upsertCompetitionCategories(
  supabase: SupabaseClient,
  nodes: CompetitionCategoryNode[]
): Promise<{ inserted: number; updated: number; bySlug: Map<string, string> }> {
  const flat = flattenCategories(nodes).sort((a, b) => a.depth - b.depth);
  const bySlug = new Map<string, string>();
  let inserted = 0;
  let updated = 0;

  for (const cat of flat) {
    const parentId = cat.parentSlug ? bySlug.get(cat.parentSlug) ?? null : null;
    const { data: existing } = await (supabase.from('competition_categories') as any)
      .select('id, name, parent_id, sort_order')
      .eq('source', 'allwalessport')
      .eq('slug', cat.slug)
      .maybeSingle();

    if (existing?.id) {
      const updates: Record<string, unknown> = {};
      if ((existing as any).name !== cat.name) updates.name = cat.name;
      if ((existing as any).parent_id !== parentId) updates.parent_id = parentId;
      if ((existing as any).sort_order !== cat.sortOrder) updates.sort_order = cat.sortOrder;
      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await (supabase.from('competition_categories') as any)
          .update(updates)
          .eq('id', (existing as { id: string }).id);
        if (updateErr) {
          console.warn(
            '[ingestion] AllWalesSport category update failed',
            cat.slug,
            (updateErr as Error).message
          );
        } else {
          updated += 1;
        }
      }
      bySlug.set(cat.slug, (existing as { id: string }).id);
      continue;
    }

    const { data: insertedRow, error: insertErr } = await (supabase.from('competition_categories') as any)
      .insert({
        source: 'allwalessport',
        name: cat.name,
        slug: cat.slug,
        parent_id: parentId,
        sort_order: cat.sortOrder,
      })
      .select('id')
      .single();
    if (insertErr) {
      console.warn(
        '[ingestion] AllWalesSport category insert failed',
        cat.slug,
        (insertErr as Error).message
      );
      continue;
    }
    inserted += 1;
    bySlug.set(cat.slug, (insertedRow as { id: string }).id);
  }

  return { inserted, updated, bySlug };
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
  const envLimitRaw = process.env.ALLWALESSPORT_LIMIT;
  const envLimit = envLimitRaw ? Number(envLimitRaw) : undefined;
  const envCap =
    envLimit !== undefined && Number.isFinite(envLimit) && envLimit > 0
      ? Math.floor(envLimit)
      : undefined;
  const maxByConfig = Math.max(1, config.maxCompetitionsScraped ?? competitions.length);
  const cap = Math.min(
    competitions.length,
    maxByConfig,
    envCap ?? maxByConfig
  );
  return competitions.slice(0, cap);
}

const MAX_CONCURRENT_COMPETITIONS = 3;
const CIRCUIT_BREAKER_CONSECUTIVE_FAILURES = 5;

function createConcurrencyLimiter(limit: number): { acquire: () => Promise<void>; release: () => void } {
  let active = 0;
  const queue: (() => void)[] = [];
  return {
    acquire: () =>
      new Promise<void>((resolve) => {
        if (active < limit) {
          active += 1;
          resolve();
          return;
        }
        queue.push(resolve);
      }),
    release: () => {
      active -= 1;
      const next = queue.shift();
      if (next) {
        active += 1;
        next();
      }
    },
  };
}

export type AllWalesSportRunMetrics = {
  competitionsDiscovered: number;
  competitionsScraped: number;
  competitionsPersisted: number;
  fixturesParsed: number;
  resultsParsed: number;
  standingsParsed: number;
  fixturesWritten: number;
  resultsWritten: number;
  standingsWritten: number;
  teamsCreated: number;
  errorsCount: number;
  durationMs: number;
};

export type RunAllWalesSportDiscoveryResult = {
  error: string | null;
  stats: { runs: number; ingestItems: number };
  /** Metrics from discovery + scrape (persist metrics added in run.ts). */
  metrics: {
    competitionsDiscovered: number;
    competitionsScraped: number;
    fixturesParsed: number;
    resultsParsed: number;
    standingsParsed: number;
    errorsCount: number;
  };
};

/**
 * Run AllWalesSport competition discovery: fetch rugby union nav, parse cid links,
 * apply filters, emit one ingest_item per competition with provenance.
 * Rate limit is enforced by httpClient. Max 3 concurrent competition fetches; circuit breaker stops after 5 consecutive failures.
 */
export async function runAllWalesSportDiscovery(
  options: RunAllWalesSportOptions
): Promise<RunAllWalesSportDiscoveryResult> {
  const { httpClient, supabase } = options;
  const config = options.config ?? loadAllWalesSportConfig();
  const stats = { runs: 0, ingestItems: 0 };
  const metrics = {
    competitionsDiscovered: 0,
    competitionsScraped: 0,
    fixturesParsed: 0,
    resultsParsed: 0,
    standingsParsed: 0,
    errorsCount: 0,
  };

  const sourceId = await ensureAllWalesSportSource(supabase);

  const { data: runRow, error: runErr } = await (supabase.from('ingest_runs') as any)
    .insert({
      source_id: sourceId,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (runErr) {
    return { error: `ingest_runs: ${(runErr as Error).message}`, stats, metrics };
  }
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
      return { error: discovery.error, stats, metrics };
    }

    const competitions = discovery.competitions;
    const categories = discovery.categories;
    const count = competitions.length;
    metrics.competitionsDiscovered = count;
    const dryRun = options.dryRun === true;
    const cidLimiterOn =
      config.startCompetitionCid != null ||
      (config.competitionCidAllowlist?.length ?? 0) > 0;
    const envLimitRaw = process.env.ALLWALESSPORT_LIMIT;
    const envLimit = envLimitRaw ? Number(envLimitRaw) : undefined;
    const envLimitValid =
      envLimit !== undefined && Number.isFinite(envLimit) && envLimit > 0
        ? Math.floor(envLimit)
        : undefined;
    const maxScrapeByConfig = Math.max(1, config.maxCompetitionsScraped ?? count);
    const scrapeCap = Math.min(count, maxScrapeByConfig, envLimitValid ?? maxScrapeByConfig);
    console.info('[ingestion] AllWalesSport run start', {
      competitionsDiscovered: count,
      scrapeCap,
      dryRun,
      cidLimiterOn,
      envLimit: envLimitValid ?? null,
    });
    console.info('[ingestion] AllWalesSport discovery: competitions found', count);
    const first5 = competitions.slice(0, 5).map((c) => c.label);
    if (first5.length > 0) {
      console.info('[ingestion] AllWalesSport discovery: first 5 labels', first5);
    }

    const allowlist =
      config.competitionCidAllowlist && config.competitionCidAllowlist.length > 0
        ? new Set(config.competitionCidAllowlist)
        : null;
    const competitionsForRun = allowlist ? competitions.filter((c) => allowlist.has(c.cid)) : competitions;
    const competitionsFiltered = competitionsForRun.filter((c) => !isWruControlledCompetitionName(c.label));
    if (competitionsFiltered.length !== competitionsForRun.length) {
      console.info('[ingestion] AllWalesSport filtered WRU-controlled competitions', {
        removed: competitionsForRun.length - competitionsFiltered.length,
        remaining: competitionsFiltered.length,
      });
    }

    let categoriesInserted = 0;
    let categoriesUpdated = 0;
    let competitionsLinkedToCategories = 0;
    if (categories.length > 0) {
      const upsertResult = await upsertCompetitionCategories(supabase, categories);
      categoriesInserted = upsertResult.inserted;
      categoriesUpdated = upsertResult.updated;
      for (const c of competitionsForRun) {
        if (!c.categorySlug) continue;
        const categoryId = upsertResult.bySlug.get(c.categorySlug);
        if (!categoryId) continue;
        const slug = `allwalessport-${c.cid}`;
        const sourceRef = String(c.cid);
        // For allwalessport, identity is source + source_ref only. Never match by slug or name.
        const { error: upsertErr } = await (supabase.from('competitions') as any).upsert(
          {
            name: c.label,
            slug,
            competition_type: deriveCompetitionTypeFromName(c.label),
            category_id: categoryId,
            sort_order: c.sortOrder ?? 0,
            source: 'allwalessport',
            source_ref: sourceRef,
          },
          { onConflict: 'source,source_ref' }
        );
        if (upsertErr) {
          console.warn(
            '[ingestion] AllWalesSport competition category link failed',
            c.cid,
            (upsertErr as Error).message
          );
          continue;
        }
        competitionsLinkedToCategories += 1;
      }
    }
    console.info('[ingestion] AllWalesSport categories', {
      categoriesInserted,
      categoriesUpdated,
      competitionsLinkedToCategories,
    });

    for (const c of competitionsFiltered) {
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

    const toScrape = competitionsToScrape(competitionsFiltered, config);
    const limiter = createConcurrencyLimiter(MAX_CONCURRENT_COMPETITIONS);
    let consecutiveFailures = 0;
    let nextIndex = 0;

    async function scrapeOne(): Promise<void> {
      for (;;) {
        if (consecutiveFailures >= CIRCUIT_BREAKER_CONSECUTIVE_FAILURES) break;
        const i = nextIndex++;
        if (i >= toScrape.length) break;
        const c = toScrape[i];
        await limiter.acquire();
        if (consecutiveFailures >= CIRCUIT_BREAKER_CONSECUTIVE_FAILURES) {
          limiter.release();
          break;
        }
        try {
          const $ = await httpClient.fetchDocument(c.url);
          const parsed = parseCompetitionPage($);
          const fixtureCount = parsed.fixturesBlocks.reduce((s, b) => s + b.rows.length, 0);
          const resultCount = parsed.resultsBlocks.reduce((s, b) => s + b.rows.length, 0);
          const standingCount = parsed.standingsRows.length;
          consecutiveFailures = 0;
          metrics.competitionsScraped += 1;
          metrics.fixturesParsed += fixtureCount;
          metrics.resultsParsed += resultCount;
          metrics.standingsParsed += standingCount;
          console.info('[ingestion] AllWalesSport parsed cid', c.cid, parsed.competitionTitle, {
            tabsFound: parsed.tabsFound,
            fixtures: fixtureCount,
            results: resultCount,
            standings: standingCount,
          });
          if (dryRun) {
            limiter.release();
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
            metrics.errorsCount += 1;
            consecutiveFailures += 1;
            console.warn('[ingestion] AllWalesSport scrape failed for cid', c.cid, result.error);
          } else {
            stats.ingestItems += result.inserted + result.updated;
          }
        } catch (e) {
          metrics.errorsCount += 1;
          consecutiveFailures += 1;
          console.warn('[ingestion] AllWalesSport scrape error for cid', c.cid, (e as Error).message);
        } finally {
          limiter.release();
        }
      }
    }

    await Promise.all([
      scrapeOne(),
      scrapeOne(),
      scrapeOne(),
    ]);

    if (consecutiveFailures >= CIRCUIT_BREAKER_CONSECUTIVE_FAILURES) {
      const errMsg = `Circuit breaker: ${consecutiveFailures} consecutive competition failures`;
      await (supabase.from('ingest_runs') as any)
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error: errMsg,
        })
        .eq('id', runId);
      return { error: errMsg, stats, metrics };
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
    return { error: (e as Error).message, stats, metrics };
  }

  return { error: null, stats, metrics };
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
        return {
          error: result.error,
          metrics: {
            competitionsDiscovered: result.metrics.competitionsDiscovered,
            competitionsScraped: result.metrics.competitionsScraped,
            fixturesParsed: result.metrics.fixturesParsed,
            resultsParsed: result.metrics.resultsParsed,
            standingsParsed: result.metrics.standingsParsed,
            errorsCount: result.metrics.errorsCount,
          },
        };
      }
      console.info('[ingestion] AllWalesSport discovery:', result.stats);
      return {
        error: null,
        metrics: {
          competitionsDiscovered: result.metrics.competitionsDiscovered,
          competitionsScraped: result.metrics.competitionsScraped,
          fixturesParsed: result.metrics.fixturesParsed,
          resultsParsed: result.metrics.resultsParsed,
          standingsParsed: result.metrics.standingsParsed,
          errorsCount: result.metrics.errorsCount,
        },
      };
    },
  });
}

registerAllWalesSport();
