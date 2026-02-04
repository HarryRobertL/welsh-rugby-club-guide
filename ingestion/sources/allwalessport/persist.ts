/**
 * Database write stage for All Wales Sport canonical payloads.
 * Writes to existing core schema: regions, clubs, teams, competitions, seasons,
 * fixtures, matches, standings; source_team_map, source_competition_group_map;
 * canonical_provenance. Defensive logging; continues on per-competition failure.
 * File: ingestion/sources/allwalessport/persist.ts
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CanonicalFixture,
  CanonicalResult,
  CanonicalStanding,
} from './map_to_canonical';
import { normalizeText } from './map_to_canonical';

const SOURCE = 'allwalessport';
const DEFAULT_REGION_NAME = 'All Wales';
const DEFAULT_CLUB_NAME = 'All Wales Sport';
const TEAM_TYPE = 'men';

function slugify(s: string): string {
  return normalizeText(s)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function sourceTeamName(cid: number, teamName: string): string {
  const n = normalizeText(teamName);
  return n ? `${cid}:${n}` : `${cid}:unknown`;
}

function sourceMatchRef(cid: number, home: string, away: string, date: string): string {
  const payload = [SOURCE, cid, normalizeText(home), normalizeText(away), date].join('|');
  return createHash('sha256').update(payload).digest('hex').slice(0, 24);
}

/** Combine date (YYYY-MM-DD) and optional time (HH:mm) to ISO timestamp. */
function toScheduledAt(dateIso: string | null, dateText: string, kickoffTime?: string): string {
  const datePart = dateIso ?? dateText.replace(/\s+/g, '-').slice(0, 10);
  if (!kickoffTime || !/^\d{1,2}:\d{2}$/.test(kickoffTime)) {
    return `${datePart}T12:00:00.000Z`;
  }
  return `${datePart}T${kickoffTime}:00.000Z`;
}

export type PersistCanonicalOptions = {
  supabase: SupabaseClient;
  sourceId: string;
  runId: string;
  ingestItemIds: { fixtures?: string; results?: string; standings?: string };
  competitionCid: number;
  competitionLabel: string;
  sourceUrl: string;
  fixtures: CanonicalFixture[];
  results: CanonicalResult[];
  standings: CanonicalStanding[];
  /** Optional year from page (e.g. 2026) for season. */
  seasonYear?: number | null;
};

export type PersistCanonicalResult = {
  error: string | null;
  competitionId?: string;
  seasonId?: string;
  fixturesWritten: number;
  resultsWritten: number;
  standingsWritten: number;
  teamsCreated: number;
};

async function ensureRegionAndClub(supabase: SupabaseClient): Promise<{ regionId: string; clubId: string }> {
  let { data: region } = await (supabase.from('regions') as any)
    .select('id')
    .eq('name', DEFAULT_REGION_NAME)
    .maybeSingle();
  if (!region?.id) {
    const slug = slugify(DEFAULT_REGION_NAME) || 'all-wales';
    const { data: ins, error } = await (supabase.from('regions') as any)
      .insert({ name: DEFAULT_REGION_NAME, slug })
      .select('id')
      .single();
    if (error) throw new Error(`regions insert: ${(error as Error).message}`);
    region = ins;
  }
  const regionId = (region as { id: string }).id;

  let { data: club } = await (supabase.from('clubs') as any)
    .select('id')
    .eq('name', DEFAULT_CLUB_NAME)
    .eq('region_id', regionId)
    .maybeSingle();
  if (!club?.id) {
    const slug = slugify(DEFAULT_CLUB_NAME) || 'all-wales-sport';
    const { data: ins, error } = await (supabase.from('clubs') as any)
      .insert({ region_id: regionId, name: DEFAULT_CLUB_NAME, slug })
      .select('id')
      .single();
    if (error) throw new Error(`clubs insert: ${(error as Error).message}`);
    club = ins;
  }
  const clubId = (club as { id: string }).id;
  return { regionId, clubId };
}

async function ensureTeam(
  supabase: SupabaseClient,
  clubId: string,
  cid: number,
  teamName: string
): Promise<string> {
  const srcName = sourceTeamName(cid, teamName);
  const { data: mapping } = await (supabase.from('source_team_map') as any)
    .select('team_id')
    .eq('source', SOURCE)
    .eq('source_team_name', srcName)
    .maybeSingle();
  if (mapping?.team_id) return (mapping as { team_id: string }).team_id;

  const baseSlug = slugify(teamName) || 'team';
  const slug = `${SOURCE}-${cid}-${baseSlug}`.slice(0, 100);
  const { data: team, error } = await (supabase.from('teams') as any)
    .insert({
      club_id: clubId,
      name: normalizeText(teamName),
      slug,
      team_type: TEAM_TYPE,
    })
    .select('id')
    .single();
  if (error) throw new Error(`teams insert: ${(error as Error).message}`);
  const teamId = (team as { id: string }).id;
  await (supabase.from('source_team_map') as any).insert({
    source: SOURCE,
    source_team_name: srcName,
    team_id: teamId,
  });
  return teamId;
}

async function ensureCompetition(
  supabase: SupabaseClient,
  cid: number,
  label: string
): Promise<string> {
  const slug = `allwalessport-${cid}`;
  let { data: comp } = await (supabase.from('competitions') as any)
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!comp?.id) {
    const { data: ins, error } = await (supabase.from('competitions') as any)
      .insert({ name: label, slug, competition_type: TEAM_TYPE })
      .select('id')
      .single();
    if (error) throw new Error(`competitions insert: ${(error as Error).message}`);
    comp = ins;
  }
  return (comp as { id: string }).id;
}

async function ensureSeason(
  supabase: SupabaseClient,
  competitionId: string,
  cid: number,
  seasonYear: number | null | undefined
): Promise<string> {
  const year = seasonYear ?? new Date().getFullYear();
  const name = seasonYear != null ? `${year}/${String(year + 1).slice(-2)}` : 'Unknown Season';
  const startDate = `${year}-07-01`;
  const endDate = `${year + 1}-06-30`;

  let { data: season } = await (supabase.from('seasons') as any)
    .select('id')
    .eq('competition_id', competitionId)
    .eq('name', name)
    .maybeSingle();
  if (!season?.id) {
    const { data: ins, error } = await (supabase.from('seasons') as any)
      .insert({
        competition_id: competitionId,
        name,
        start_date: startDate,
        end_date: endDate,
      })
      .select('id')
      .single();
    if (error) throw new Error(`seasons insert: ${(error as Error).message}`);
    season = ins;
  }
  const seasonId = (season as { id: string }).id;

  const { data: existingMap } = await (supabase.from('source_competition_group_map') as any)
    .select('id')
    .eq('source', SOURCE)
    .eq('source_group_id', String(cid))
    .maybeSingle();
  if (!existingMap?.id) {
    await (supabase.from('source_competition_group_map') as any).insert({
      source: SOURCE,
      source_group_id: String(cid),
      competition_group_id: seasonId,
    });
  }
  return seasonId;
}

async function writeProvenance(
  supabase: SupabaseClient,
  entityType: string,
  canonicalId: string,
  sourceId: string,
  externalId: string,
  runId: string,
  ingestItemId: string | undefined
): Promise<void> {
  const row = {
    entity_type: entityType,
    canonical_id: canonicalId,
    source_id: sourceId,
    external_id: externalId,
    run_id: runId,
    ingest_item_id: ingestItemId ?? null,
  };
  const { error } = await (supabase.from('canonical_provenance') as any).upsert(row, {
    onConflict: 'entity_type,canonical_id',
  });
  if (error) console.warn('[AllWalesSport persist] provenance upsert failed', entityType, canonicalId, (error as Error).message);
}

/**
 * Persist one competition's canonical fixtures, results, and standings to core tables.
 * Creates region/club, competition, season, teams as needed; upserts fixtures, matches, standings.
 * Writes provenance for each canonical record. Continues on inner errors with logging.
 */
export async function persistCanonicalPayloads(
  options: PersistCanonicalOptions
): Promise<PersistCanonicalResult> {
  const {
    supabase,
    sourceId,
    runId,
    ingestItemIds,
    competitionCid,
    competitionLabel,
    sourceUrl,
    fixtures,
    results,
    standings,
    seasonYear,
  } = options;
  const result: PersistCanonicalResult = {
    error: null,
    fixturesWritten: 0,
    resultsWritten: 0,
    standingsWritten: 0,
    teamsCreated: 0,
  };

  try {
    const { clubId } = await ensureRegionAndClub(supabase);
    result.competitionId = await ensureCompetition(supabase, competitionCid, competitionLabel);
    result.seasonId = await ensureSeason(supabase, result.competitionId, competitionCid, seasonYear);
    const seasonId = result.seasonId;

    const teamCache = new Map<string, string>();
    const getTeamId = async (name: string): Promise<string> => {
      const key = sourceTeamName(competitionCid, name);
      let id = teamCache.get(key);
      if (!id) {
        id = await ensureTeam(supabase, clubId, competitionCid, name);
        teamCache.set(key, id);
        result.teamsCreated += 1;
      }
      return id;
    };

    for (const f of fixtures) {
      try {
        const homeId = await getTeamId(f.homeTeam);
        const awayId = await getTeamId(f.awayTeam);
        if (homeId === awayId) {
          console.warn('[AllWalesSport persist] skip fixture same team', f.homeTeam, f.awayTeam);
          continue;
        }
        const ref = sourceMatchRef(competitionCid, f.homeTeam, f.awayTeam, f.date);
        const scheduledAt = toScheduledAt(f.parsedDateIso, f.dateText, f.kickoffTime);

        const { data: existing } = await (supabase.from('fixtures') as any)
          .select('id')
          .eq('competition_group_id', seasonId)
          .eq('source_match_ref', ref)
          .maybeSingle();

        let fixtureId: string;
        if (existing?.id) {
          fixtureId = (existing as { id: string }).id;
        } else {
          const { data: ins, error } = await (supabase.from('fixtures') as any)
            .insert({
              season_id: seasonId,
              competition_group_id: seasonId,
              source_match_ref: ref,
              home_team_id: homeId,
              away_team_id: awayId,
              scheduled_at: scheduledAt,
              status: 'scheduled',
            })
            .select('id')
            .single();
          if (error) {
            console.warn('[AllWalesSport persist] fixture insert failed', ref, (error as Error).message);
            continue;
          }
          fixtureId = (ins as { id: string }).id;
          const { error: matchErr } = await (supabase.from('matches') as any).insert({
            fixture_id: fixtureId,
            status: 'scheduled',
            score_home: 0,
            score_away: 0,
          });
          if (matchErr) console.warn('[AllWalesSport persist] match insert failed', fixtureId, (matchErr as Error).message);
        }

        const extId = `${SOURCE}:fixture:${competitionCid}:${ref}`;
        await writeProvenance(
          supabase,
          'fixture',
          fixtureId,
          sourceId,
          extId,
          runId,
          ingestItemIds.fixtures
        );
        result.fixturesWritten += 1;
      } catch (e) {
        console.warn('[AllWalesSport persist] fixture row error', f.homeTeam, f.awayTeam, (e as Error).message);
      }
    }

    for (const r of results) {
      try {
        const homeId = await getTeamId(r.homeTeam);
        const awayId = await getTeamId(r.awayTeam);
        const ref = sourceMatchRef(competitionCid, r.homeTeam, r.awayTeam, r.date);

        let { data: fix } = await (supabase.from('fixtures') as any)
          .select('id')
          .eq('competition_group_id', seasonId)
          .eq('source_match_ref', ref)
          .maybeSingle();

        if (!fix?.id) {
          const scheduledAt = toScheduledAt(r.parsedDateIso, r.dateText, undefined);
          const { data: ins, error } = await (supabase.from('fixtures') as any)
            .insert({
              season_id: seasonId,
              competition_group_id: seasonId,
              source_match_ref: ref,
              home_team_id: homeId,
              away_team_id: awayId,
              scheduled_at: scheduledAt,
              status: 'scheduled',
            })
            .select('id')
            .single();
          if (error) {
            console.warn('[AllWalesSport persist] result fixture insert failed', ref, (error as Error).message);
            continue;
          }
          fix = ins;
          await (supabase.from('matches') as any).insert({
            fixture_id: (fix as { id: string }).id,
            status: 'scheduled',
            score_home: 0,
            score_away: 0,
          });
        }
        const fixtureId = (fix as { id: string }).id;

        const { error: matchUpd } = await (supabase.from('matches') as any)
          .update({
            status: 'full_time',
            score_home: r.homeScore,
            score_away: r.awayScore,
          })
          .eq('fixture_id', fixtureId);
        if (matchUpd) {
          console.warn('[AllWalesSport persist] match update failed', fixtureId, (matchUpd as Error).message);
          continue;
        }

        await writeProvenance(
          supabase,
          'result',
          fixtureId,
          sourceId,
          `${SOURCE}:result:${competitionCid}:${ref}`,
          runId,
          ingestItemIds.results
        );
        result.resultsWritten += 1;
      } catch (e) {
        console.warn('[AllWalesSport persist] result row error', r.homeTeam, r.awayTeam, (e as Error).message);
      }
    }

    for (const s of standings) {
      try {
        const teamId = await getTeamId(s.team_name);
        const { error: upsErr } = await (supabase.from('standings') as any).upsert(
          {
            season_id: seasonId,
            team_id: teamId,
            position: s.position,
            played: s.played ?? 0,
            won: s.won ?? 0,
            drawn: s.drawn ?? 0,
            lost: s.lost ?? 0,
            points_for: s.points_for ?? 0,
            points_against: s.points_against ?? 0,
            points: s.table_points ?? 0,
            competition_group_id: seasonId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'season_id,team_id' }
        );
        if (upsErr) {
          console.warn('[AllWalesSport persist] standing upsert failed', s.team_name, (upsErr as Error).message);
          continue;
        }
        const { data: standingRow } = await (supabase.from('standings') as any)
          .select('id')
          .eq('season_id', seasonId)
          .eq('team_id', teamId)
          .single();
        if (standingRow?.id) {
          await writeProvenance(
            supabase,
            'standing',
            (standingRow as { id: string }).id,
            sourceId,
            `${SOURCE}:standing:${competitionCid}:${s.position}:${normalizeText(s.team_name)}`,
            runId,
            ingestItemIds.standings
          );
        }
        result.standingsWritten += 1;
      } catch (e) {
        console.warn('[AllWalesSport persist] standing row error', s.team_name, (e as Error).message);
      }
    }
  } catch (e) {
    result.error = (e as Error).message;
    console.error('[AllWalesSport persist] competition failed', competitionCid, result.error);
  }

  return result;
}

export type RunPersistAllWalesSportOptions = {
  supabase: SupabaseClient;
  /** Only process items from runs after this time (ISO). Omit to process all parsed. */
  afterRunCreatedAt?: string;
  limit?: number;
  /** When true, do not write to core tables (fixtures, matches, standings, etc.); still reads ingest_items. */
  dryRun?: boolean;
};

export type RunPersistAllWalesSportResult = {
  error: string | null;
  competitionsProcessed: number;
  totalFixtures: number;
  totalResults: number;
  totalStandings: number;
  totalTeamsCreated: number;
  failures: string[];
};

/**
 * Find parsed AllWalesSport ingest items (fixtures, results, standings), group by competitionCid,
 * and persist each to core tables. Defensive: log and continue on per-competition failure.
 */
export async function runPersistAllWalesSport(
  options: RunPersistAllWalesSportOptions
): Promise<RunPersistAllWalesSportResult> {
  const { supabase, afterRunCreatedAt, limit = 50, dryRun = false } = options;
  const out: RunPersistAllWalesSportResult = {
    error: null,
    competitionsProcessed: 0,
    totalFixtures: 0,
    totalResults: 0,
    totalStandings: 0,
    totalTeamsCreated: 0,
    failures: [],
  };

  const { data: sourceRow } = await (supabase.from('ingest_sources') as any)
    .select('id')
    .eq('slug', SOURCE)
    .maybeSingle();
  if (!sourceRow?.id) {
    out.error = 'ingest_sources: allwalessport not found';
    return out;
  }
  const sourceId = (sourceRow as { id: string }).id;

  let runQuery = (supabase.from('ingest_runs') as any)
    .select('id')
    .eq('source_id', sourceId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (afterRunCreatedAt) runQuery = runQuery.gte('created_at', afterRunCreatedAt);
  const { data: runs } = await runQuery;
  const runIds = (runs ?? []).map((r: { id: string }) => r.id);
  if (runIds.length === 0) return out;

  const { data: items, error: itemsErr } = await (supabase.from('ingest_items') as any)
    .select('id, run_id, entity_type, payload')
    .in('run_id', runIds)
    .in('entity_type', ['fixtures', 'results', 'standings'])
    .eq('processed_status', 'parsed')
    .limit(limit * 3);
  if (itemsErr) {
    out.error = (itemsErr as Error).message;
    return out;
  }
  const rows = (items ?? []) as { id: string; run_id: string; entity_type: string; payload: Record<string, unknown> }[];
  const byCid = new Map<
    number,
    { runId: string; fixtures: unknown[]; results: unknown[]; standings: unknown[]; label: string; sourceUrl: string; ingestItemIds: { fixtures?: string; results?: string; standings?: string } }
  >();
  for (const row of rows) {
    const cid = row.payload?.competitionCid as number | undefined;
    if (cid == null) continue;
    const itemsArr = Array.isArray(row.payload?.items) ? row.payload.items : [];
    if (!byCid.has(cid)) {
      byCid.set(cid, {
        runId: row.run_id,
        fixtures: [],
        results: [],
        standings: [],
        label: (row.payload?.competitionLabel as string) ?? `Competition ${cid}`,
        sourceUrl: (row.payload?.sourceUrl as string) ?? '',
        ingestItemIds: {},
      });
    }
    const g = byCid.get(cid)!;
    if (row.entity_type === 'fixtures') {
      g.fixtures = itemsArr;
      g.ingestItemIds.fixtures = row.id;
    } else if (row.entity_type === 'results') {
      g.results = itemsArr;
      g.ingestItemIds.results = row.id;
    } else if (row.entity_type === 'standings') {
      g.standings = itemsArr;
      g.ingestItemIds.standings = row.id;
    }
  }

  for (const [cid, g] of byCid) {
    try {
      if (dryRun) {
        const fixtureCount = (g.fixtures as unknown[]).length;
        const resultCount = (g.results as unknown[]).length;
        const standingCount = (g.standings as unknown[]).length;
        out.competitionsProcessed += 1;
        out.totalFixtures += fixtureCount;
        out.totalResults += resultCount;
        out.totalStandings += standingCount;
        console.info('[AllWalesSport persist] dry run cid', cid, { fixtureCount, resultCount, standingCount });
        continue;
      }
      const firstFixture = g.fixtures[0] as { parsedDateIso?: string | null } | undefined;
      const firstResult = g.results[0] as { parsedDateIso?: string | null } | undefined;
      const d = firstFixture?.parsedDateIso ?? firstResult?.parsedDateIso;
      const seasonYear = typeof d === 'string' && d.length >= 4 ? parseInt(d.slice(0, 4), 10) || undefined : undefined;

      const persistResult = await persistCanonicalPayloads({
        supabase,
        sourceId,
        runId: g.runId,
        ingestItemIds: g.ingestItemIds,
        competitionCid: cid,
        competitionLabel: g.label,
        sourceUrl: g.sourceUrl,
        fixtures: g.fixtures as CanonicalFixture[],
        results: g.results as CanonicalResult[],
        standings: g.standings as CanonicalStanding[],
        seasonYear,
      });
      if (persistResult.error) {
        out.failures.push(`cid ${cid}: ${persistResult.error}`);
        console.warn('[AllWalesSport persist] competition failed', cid, persistResult.error);
        continue;
      }
      out.competitionsProcessed += 1;
      out.totalFixtures += persistResult.fixturesWritten;
      out.totalResults += persistResult.resultsWritten;
      out.totalStandings += persistResult.standingsWritten;
      out.totalTeamsCreated += persistResult.teamsCreated;
      if (
        persistResult.fixturesWritten > 0 ||
        persistResult.resultsWritten > 0 ||
        persistResult.standingsWritten > 0
      ) {
        console.info('[AllWalesSport persist] cid', cid, persistResult);
      }
    } catch (e) {
      const msg = (e as Error).message;
      out.failures.push(`cid ${cid}: ${msg}`);
      console.warn('[AllWalesSport persist] competition error', cid, msg);
    }
  }

  return out;
}
