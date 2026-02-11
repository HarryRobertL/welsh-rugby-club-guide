/**
 * MyWRU discovery: competition instances, groups, endpoints, and ingest_items.
 * Reads config from ingestion/config/mywru.json; uses HTTP client and Supabase.
 * File: ingestion/sources/mywru.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { IngestHttpClient } from '../lib/http';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  activeCompetitions,
  competitionGroups,
  competitionDetails,
  competitionGroupLeagueTable,
  competitionGroupFixtures,
  competitionGroupResults,
} from './mywru/endpoints';

export type MyWruConfig = {
  baseUrl: string;
  /** When set, discovery uses this base URL for /competition/{id}/groups and /overview (e.g. a JSON API). */
  groupsApiBaseUrl?: string;
  roots?: { type: string; id: number; label: string }[];
  useActiveCompetitions?: boolean;
  knownCompetitionOverviewUrls?: string[];
  request?: { minDelayMs?: number; maxRequestsPerRun?: number };
};

const CONFIG_PATH = join(__dirname, '..', 'config', 'mywru.json');

export function loadMyWruConfig(): MyWruConfig {
  const raw = readFileSync(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const roots = (parsed.roots as MyWruConfig['roots']) ?? [];
  return {
    baseUrl: (parsed.baseUrl as string) ?? 'https://my.wru.wales',
    groupsApiBaseUrl: typeof parsed.groupsApiBaseUrl === 'string' ? parsed.groupsApiBaseUrl : undefined,
    roots: roots.filter(
      (r): r is { type: string; id: number; label: string } =>
        r && typeof r === 'object' && r.type === 'competitionInstance' && typeof (r as { id?: number }).id === 'number' && typeof (r as { label?: string }).label === 'string'
    ),
    useActiveCompetitions: parsed.useActiveCompetitions !== false,
    knownCompetitionOverviewUrls: (parsed.knownCompetitionOverviewUrls as string[]) ?? [],
    request: parsed.request as MyWruConfig['request'],
  };
}

export type RunMyWruDiscoveryOptions = {
  config?: MyWruConfig;
  httpClient: IngestHttpClient;
  supabase: SupabaseClient;
};

type GroupLike = {
  id?: string | number;
  groupId?: string | number;
  group_id?: string | number;
  divisionId?: string | number;
  name?: string;
  title?: string;
  label?: string;
  divisionName?: string;
  type?: string;
};

function toGroupList(value: unknown): GroupLike[] {
  if (!value || !Array.isArray(value)) return [];
  return value as GroupLike[];
}

function extractListFromJson(data: Record<string, unknown>): GroupLike[] {
  const candidates = [
    toGroupList(data.groups),
    toGroupList(data.divisions),
    toGroupList(data.competitionGroups),
    toGroupList(data.competition_groups),
    toGroupList(data.items),
    toGroupList(data.data),
    toGroupList(data.result),
    Array.isArray(data) ? (data as GroupLike[]) : [],
  ];
  return candidates.find((l) => l.length > 0) ?? [];
}

function groupIdAndName(g: GroupLike): { id: string; name: string; type: string | null } | null {
  const id =
    g.id != null ? String(g.id) :
    g.groupId != null ? String(g.groupId) :
    g.group_id != null ? String(g.group_id) :
    g.divisionId != null ? String(g.divisionId) : undefined;
  const name =
    (typeof g.name === 'string' ? g.name : null) ||
    (typeof g.title === 'string' ? g.title : null) ||
    (typeof g.label === 'string' ? g.label : null) ||
    (typeof g.divisionName === 'string' ? g.divisionName : null) ||
    '';
  if (id && name) {
    return {
      id,
      name,
      type: typeof g.type === 'string' ? g.type : null,
    };
  }
  return null;
}

/** Recursively find first array where at least one element looks like a group (id + name). Max depth 8. */
function findGroupLikeArray(obj: unknown, depth = 0): GroupLike[] {
  if (depth > 8) return [];
  if (Array.isArray(obj) && obj.length > 0) {
    const hasAnyGroup = (obj as Record<string, unknown>[]).some((el) => {
      if (!el || typeof el !== 'object') return false;
      const e = el as Record<string, unknown>;
      const hasId =
        e.id !== undefined || e.groupId !== undefined || e.group_id !== undefined || e.divisionId !== undefined;
      const hasName =
        typeof e.name === 'string' ||
        typeof e.title === 'string' ||
        typeof e.label === 'string' ||
        typeof e.divisionName === 'string';
      return hasId && hasName;
    });
    if (hasAnyGroup) return obj as GroupLike[];
  }
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const rec = obj as Record<string, unknown>;
    for (const v of Object.values(rec)) {
      const found = findGroupLikeArray(v, depth + 1);
      if (found.length > 0) return found;
    }
  }
  return [];
}

/** Write sample response for debugging when INGEST_DEBUG_GROUPS=1 and no groups found. */
function maybeDebugGroupsBody(competitionInstanceId: string, body: string): void {
  if (process.env.INGEST_DEBUG_GROUPS !== '1') return;
  try {
    const dir = join(__dirname, '..', '.cache');
    mkdirSync(dir, { recursive: true });
    const sample = body.slice(0, 8000);
    writeFileSync(
      join(dir, `debug_groups_${competitionInstanceId}.txt`),
      sample,
      'utf8'
    );
    console.warn(`[ingestion] Wrote debug sample to ingestion/.cache/debug_groups_${competitionInstanceId}.txt (${body.length} chars total)`);
  } catch {
    // ignore
  }
}

/** Extract groups from JSON or HTML response. Returns empty if not parseable. */
function extractGroupsFromResponse(
  body: string,
  competitionInstanceId: string
): { competition_group_id: string; name: string; type: string | null }[] {
  const groups: { competition_group_id: string; name: string; type: string | null }[] = [];
  const parseFrom = (data: Record<string, unknown>): void => {
    let list = extractListFromJson(data);
    if (list.length === 0) list = findGroupLikeArray(data) as GroupLike[];
    if (list.length === 0 && data.data && typeof data.data === 'object') {
      list = extractListFromJson(data.data as Record<string, unknown>);
      if (list.length === 0) list = findGroupLikeArray(data.data) as GroupLike[];
    }
    if (list.length === 0 && data.result && typeof data.result === 'object') {
      list = findGroupLikeArray(data.result) as GroupLike[];
    }
    for (const g of list) {
      const out = groupIdAndName(g);
      if (out) groups.push({ competition_group_id: out.id, name: out.name, type: out.type });
    }
  };
  try {
    const data = JSON.parse(body) as Record<string, unknown>;
    parseFrom(data);
  } catch {
    const nextData = body.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextData?.[1]) {
      try {
        const data = JSON.parse(nextData[1]) as Record<string, unknown>;
        const props = data.props as Record<string, unknown> | undefined;
        const pageProps = props?.pageProps as Record<string, unknown> | undefined;
        if (pageProps) parseFrom(pageProps as Record<string, unknown>);
        if (groups.length === 0 && props) {
          const list = findGroupLikeArray(props) as GroupLike[];
          for (const g of list) {
            const out = groupIdAndName(g);
            if (out) groups.push({ competition_group_id: out.id, name: out.name, type: out.type });
          }
        }
      } catch {
        // ignore
      }
    }
  }
  if (groups.length === 0) maybeDebugGroupsBody(competitionInstanceId, body);
  return groups;
}

/**
 * Ensure MyWRU ingest source exists; return source id.
 */
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

/**
 * Run MyWRU discovery: instances, groups, endpoints, ingest_items.
 */
export async function runMyWruDiscovery(
  options: RunMyWruDiscoveryOptions
): Promise<{ error: string | null; stats: { instances: number; groups: number; endpoints: number; ingestItems: number } }> {
  const { httpClient, supabase } = options;
  const config = options.config ?? loadMyWruConfig();
  let roots = config.roots ?? [];
  const stats = { instances: 0, groups: 0, endpoints: 0, ingestItems: 0 };

  const sourceId = await ensureMyWruSource(supabase);

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

  try {
    if (config.useActiveCompetitions || roots.length === 0) {
      try {
        const res = await httpClient.get(activeCompetitions());
        if (res.status >= 200 && res.status < 300) {
          const data = JSON.parse(res.body) as { id?: number; name?: string }[];
          const activeRoots = (Array.isArray(data) ? data : [])
            .filter((d) => typeof d?.id === 'number' && typeof d?.name === 'string')
            .map((d) => ({
              type: 'competitionInstance',
              id: d.id as number,
              label: d.name as string,
            }));
          const byId = new Map<number, { type: string; id: number; label: string }>();
          for (const r of roots) byId.set(r.id, r);
          for (const r of activeRoots) byId.set(r.id, r);
          roots = Array.from(byId.values());
        }
      } catch (e) {
        console.warn('[ingestion] MyWRU active competitions fetch failed', (e as Error).message);
      }
    }

    for (const root of roots) {
      const competitionInstanceId = String(root.id);
      const groupsPath = competitionGroups(root.id);
      const detailsPath = `${config.baseUrl.replace(/\/$/, '')}${competitionDetails(root.id)}`;

      if (httpClient.hasReachedRequestLimit()) break;

      const [groupsRes, detailsRes] = await Promise.all([
        httpClient.get(groupsPath),
        httpClient.get(detailsPath),
      ]);

      const groupsBody = groupsRes.status >= 200 && groupsRes.status < 300 ? groupsRes.body : '';
      const detailsBody = detailsRes.status >= 200 && detailsRes.status < 300 ? detailsRes.body : '';
      const combinedBody = groupsBody || detailsBody;
      let extractedGroups = extractGroupsFromResponse(groupsBody, competitionInstanceId);
      if (extractedGroups.length === 0) {
        extractedGroups = extractGroupsFromResponse(detailsBody, competitionInstanceId);
      }
      if (extractedGroups.length === 0 && combinedBody) {
        extractedGroups = extractGroupsFromResponse(combinedBody, competitionInstanceId);
      }

      await (supabase.from('mywru_competition_instances') as any).upsert(
        {
          competition_instance_id: competitionInstanceId,
          label: root.label,
        },
        { onConflict: 'competition_instance_id' }
      );
      stats.instances += 1;

      for (const g of extractedGroups) {
        await (supabase.from('mywru_competition_groups') as any).upsert(
          {
            competition_group_id: g.competition_group_id,
            competition_instance_id: competitionInstanceId,
            name: g.name,
            type: g.type,
          },
          { onConflict: 'competition_group_id' }
        );
        stats.groups += 1;
      }

      for (const g of extractedGroups) {
        if (httpClient.hasReachedRequestLimit()) break;
        const groupIdNum = parseInt(g.competition_group_id, 10) || 0;
        const tablePath = competitionGroupLeagueTable(groupIdNum);
        const fixturesPath = competitionGroupFixtures(groupIdNum);
        const resultsPath = competitionGroupResults(groupIdNum);

        let table_path: string | null = null;
        let fixtures_path: string | null = null;
        let results_path: string | null = null;

        try {
          const [t, f, r] = await Promise.all([
            httpClient.get(tablePath),
            httpClient.get(fixturesPath),
            httpClient.get(resultsPath),
          ]);
          if (t.status >= 200 && t.status < 300) table_path = tablePath;
          if (f.status >= 200 && f.status < 300) fixtures_path = fixturesPath;
          if (r.status >= 200 && r.status < 300) results_path = resultsPath;
        } catch {
          // leave null if request failed
        }

        const { data: existingEp } = await (supabase.from('mywru_group_endpoints') as any)
          .select('id')
          .eq('competition_group_id', g.competition_group_id)
          .limit(1)
          .maybeSingle();
        const epPayload = {
          competition_group_id: g.competition_group_id,
          table_path,
          fixtures_path,
          results_path,
          details_path: null,
          updated_at: new Date().toISOString(),
        };
        if (existingEp?.id) {
          await (supabase.from('mywru_group_endpoints') as any).update(epPayload).eq('id', (existingEp as { id: string }).id);
        } else {
          await (supabase.from('mywru_group_endpoints') as any).insert(epPayload);
        }
        stats.endpoints += 1;

        const rawPayload = {
          competition_instance_id: competitionInstanceId,
          competition_group_id: g.competition_group_id,
          name: g.name,
          type: g.type,
          source: 'mywru_discovery',
        };
        const normalizedPayload = {
          competition_instance_id: competitionInstanceId,
          competition_group_id: g.competition_group_id,
          name: g.name,
        };
        await (supabase.from('ingest_items') as any).insert({
          run_id: runId,
          entity_type: 'competition',
          external_id: `${competitionInstanceId}-${g.competition_group_id}`,
          payload: { raw: rawPayload, normalized: normalizedPayload },
        });
        stats.ingestItems += 1;
      }

      if (extractedGroups.length === 0) {
        const rawPayload = { competition_instance_id: competitionInstanceId, label: root.label, source: 'mywru_discovery' };
        const normalizedPayload = { competition_instance_id: competitionInstanceId, competition_group_id: null, name: root.label };
        await (supabase.from('ingest_items') as any).insert({
          run_id: runId,
          entity_type: 'competition',
          external_id: competitionInstanceId,
          payload: { raw: rawPayload, normalized: normalizedPayload },
        });
        stats.ingestItems += 1;
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
