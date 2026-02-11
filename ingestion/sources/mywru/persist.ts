/**
 * Persist MyWRU parsed fixtures/results/standings into core tables.
 * File: ingestion/sources/mywru/persist.ts
 */
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveCompetitionTypeFromName } from '../../lib/deriveCompetitionType';
import type { NormalizedMatchRow, NormalizedStandingRow } from '../../parsers/mywru/types';

const SOURCE = 'mywru';
const DEFAULT_REGION_NAME = 'Wales';
const DEFAULT_CLUB_NAME = 'WRU';
const TEAM_TYPE = 'men';

/** DB fixture_status enum: scheduled | live | full_time | postponed | cancelled. Map parser 'unknown' to scheduled. */
const ALLOWED_FIXTURE_STATUS = new Set<string>(['scheduled', 'live', 'full_time', 'postponed', 'cancelled']);
function normalizeFixtureStatus(s: string | undefined): string {
  const v = (s ?? 'scheduled').toLowerCase();
  return ALLOWED_FIXTURE_STATUS.has(v) ? v : 'scheduled';
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function isValidTeamName(name: string | null | undefined): boolean {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.includes('[object object]') || lower === 'object object') return false;
  return true;
}

function slugify(s: string): string {
  return normalizeText(s)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function sourceTeamName(groupId: string, teamName: string): string {
  const n = normalizeText(teamName);
  return n ? `${groupId}:${n}` : `${groupId}:unknown`;
}

function hashMatchRef(
  competition_group_id: string,
  home: string,
  away: string,
  kickoff_at: string | null
): string {
  const payload = [competition_group_id, normalizeText(home), normalizeText(away), kickoff_at ?? ''].join('|');
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

async function ensureRegionAndClub(
  supabase: SupabaseClient
): Promise<{ regionId: string; clubId: string }> {
  let { data: region } = await (supabase.from('regions') as any)
    .select('id')
    .eq('name', DEFAULT_REGION_NAME)
    .maybeSingle();
  if (!region?.id) {
    const slug = slugify(DEFAULT_REGION_NAME) || 'wales';
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
    const slug = slugify(DEFAULT_CLUB_NAME) || 'wru';
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
  groupId: string,
  teamName: string
): Promise<string> {
  const srcName = sourceTeamName(groupId, teamName);
  const { data: mapping } = await (supabase.from('source_team_map') as any)
    .select('team_id')
    .eq('source', SOURCE)
    .eq('source_team_name', srcName)
    .maybeSingle();
  if (mapping?.team_id) return (mapping as { team_id: string }).team_id;

  const baseSlug = slugify(teamName) || 'team';
  const slug = `${SOURCE}-${groupId}-${baseSlug}`.slice(0, 100);
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
  groupId: string,
  label: string
): Promise<string> {
  const raw = (label ?? '').trim();
  const isDefault = !raw || raw.toLowerCase() === 'default';
  const isCompetitionId = /^Competition\s+\d+$/i.test(raw);
  const nameToStore = isDefault || isCompetitionId ? 'Super Rygbi Cymru' : label;
  if (isDefault || isCompetitionId) {
    console.warn('[MyWRU] competition name missing or placeholder – storing Super Rygbi Cymru', { groupId, source_ref: groupId, raw: label });
  }
  const slug = `mywru-${groupId}`;
  const { data: comp, error } = await (supabase.from('competitions') as any)
    .upsert(
      {
        name: nameToStore,
        slug,
        competition_type: deriveCompetitionTypeFromName(label),
        source: SOURCE,
        source_ref: groupId,
      },
      { onConflict: 'source,source_ref' }
    )
    .select('id')
    .single();
  if (error) throw new Error(`competitions upsert: ${(error as Error).message}`);
  return (comp as { id: string }).id;
}

async function ensureSeason(
  supabase: SupabaseClient,
  competitionId: string,
  groupId: string,
  kickoffAt?: string | null
): Promise<string> {
  const d = kickoffAt ? new Date(kickoffAt) : new Date();
  const year = Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  const name = `${year}/${String(year + 1).slice(-2)}`;
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
    .eq('source_group_id', groupId)
    .maybeSingle();
  if (!existingMap?.id) {
    await (supabase.from('source_competition_group_map') as any).insert({
      source: SOURCE,
      source_group_id: groupId,
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
  if (error) {
    console.warn('[MyWRU persist] provenance upsert failed', entityType, canonicalId, (error as Error).message);
  }
}

type GroupPayload = {
  runId: string;
  competition_group_id: string;
  competition_instance_id?: string;
  name: string;
  fixtures: NormalizedMatchRow[];
  results: NormalizedMatchRow[];
  standings: NormalizedStandingRow[];
  ingestItemIds: { fixtures?: string; results?: string; standings?: string };
};

export async function runPersistMyWru(options: {
  supabase: SupabaseClient;
  afterRunCreatedAt?: string;
  limit?: number;
}): Promise<{
  error: string | null;
  groupsProcessed: number;
  fixturesWritten: number;
  resultsWritten: number;
  standingsWritten: number;
  teamsCreated: number;
  failures: string[];
}> {
  const { supabase, afterRunCreatedAt, limit = 500 } = options;
  const out = {
    error: null,
    groupsProcessed: 0,
    fixturesWritten: 0,
    resultsWritten: 0,
    standingsWritten: 0,
    teamsCreated: 0,
    failures: [] as string[],
  };

  const { data: sourceRow } = await (supabase.from('ingest_sources') as any)
    .select('id')
    .eq('slug', SOURCE)
    .maybeSingle();
  if (!sourceRow?.id) {
    return { ...out, error: 'ingest_sources: mywru not found' };
  }
  const sourceId = (sourceRow as { id: string }).id;

  let runQuery = (supabase.from('ingest_runs') as any)
    .select('id, created_at')
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
    .in('entity_type', ['fixture', 'result', 'standing'])
    .eq('processed_status', 'parsed')
    .limit(limit * 3);
  if (itemsErr) {
    return { ...out, error: (itemsErr as Error).message };
  }

  const rows = (items ?? []) as {
    id: string;
    run_id: string;
    entity_type: 'fixture' | 'result' | 'standing';
    payload: Record<string, unknown> & {
      parsed?: unknown[];
      competition_group_id?: string;
      competition_instance_id?: string;
      name?: string;
    };
  }[];

  const byGroup = new Map<string, GroupPayload>();
  for (const row of rows) {
    const rawGroupId = row.payload?.competition_group_id;
    if (rawGroupId == null || rawGroupId === '') continue;
    const groupId = String(rawGroupId);
    if (!byGroup.has(groupId)) {
      byGroup.set(groupId, {
        runId: row.run_id,
        competition_group_id: groupId,
        competition_instance_id: row.payload?.competition_instance_id,
        name: (() => {
          const n = (row.payload?.name as string) ?? '';
          const t = (n ?? '').trim();
          if (!t || t.toLowerCase() === 'default' || /^Competition\s+\d+$/i.test(t)) return 'Super Rygbi Cymru';
          return n;
        })(),
        fixtures: [],
        results: [],
        standings: [],
        ingestItemIds: {},
      });
    }
    const g = byGroup.get(groupId)!;
    const parsed = Array.isArray(row.payload?.parsed) ? (row.payload.parsed as unknown[]) : [];
    if (row.entity_type === 'fixture') {
      g.fixtures = parsed as NormalizedMatchRow[];
      g.ingestItemIds.fixtures = row.id;
    } else if (row.entity_type === 'result') {
      g.results = parsed as NormalizedMatchRow[];
      g.ingestItemIds.results = row.id;
    } else if (row.entity_type === 'standing') {
      g.standings = parsed as NormalizedStandingRow[];
      g.ingestItemIds.standings = row.id;
    }
  }

  for (const g of byGroup.values()) {
    try {
      const { clubId } = await ensureRegionAndClub(supabase);
      const firstKickoff =
        g.fixtures[0]?.kickoff_at ?? g.results[0]?.kickoff_at ?? null;
      const competitionId = await ensureCompetition(supabase, g.competition_group_id, g.name);
      const seasonId = await ensureSeason(supabase, competitionId, g.competition_group_id, firstKickoff);

      const teamCache = new Map<string, string>();
      const getTeamId = async (name: string): Promise<string> => {
        const key = sourceTeamName(g.competition_group_id, name);
        let id = teamCache.get(key);
        if (!id) {
          id = await ensureTeam(supabase, clubId, g.competition_group_id, name);
          teamCache.set(key, id);
          out.teamsCreated += 1;
        }
        return id;
      };

      const upsertFixture = async (m: NormalizedMatchRow): Promise<string | null> => {
        const homeName = m.home_team_name?.trim() || 'TBC';
        const awayName = m.away_team_name?.trim() || 'TBC';
        if (!isValidTeamName(homeName) || !isValidTeamName(awayName)) {
          console.warn('[MyWRU persist] skip fixture invalid team name', {
            groupId: g.competition_group_id,
            home_team_name: homeName,
            away_team_name: awayName,
            source_match_ref: m.source_match_ref,
          });
          return null;
        }
        const homeNorm = normalizeText(homeName);
        const awayNorm = normalizeText(awayName);
        // When both sides normalize to same (e.g. TBC vs TBC), use distinct labels so we get two team IDs and satisfy fixtures_teams_different
        const homeLabel = homeNorm && homeNorm === awayNorm ? `${homeName} (Home)` : homeName;
        const awayLabel = awayNorm && homeNorm === awayNorm ? `${awayName} (Away)` : awayName;
        const homeId = await getTeamId(homeLabel);
        const awayId = await getTeamId(awayLabel);
        if (homeId === awayId) return null; // fallback skip if still same
        const kickoff = m.kickoff_at ?? new Date().toISOString();
        const status = normalizeFixtureStatus(m.status);
        const sourceMatchRef =
          m.source_match_ref || hashMatchRef(g.competition_group_id, m.home_team_name, m.away_team_name, kickoff);
        const { data: existing } = await (supabase.from('fixtures') as any)
          .select('id')
          .eq('competition_group_id', seasonId)
          .eq('source_match_ref', sourceMatchRef)
          .maybeSingle();
        let fixtureId: string;
        if (existing?.id) {
          const { error: updErr } = await (supabase.from('fixtures') as any)
            .update({
              season_id: seasonId,
              home_team_id: homeId,
              away_team_id: awayId,
              scheduled_at: kickoff,
              status,
            })
            .eq('id', (existing as { id: string }).id);
          if (updErr) {
            console.warn('[MyWRU persist] fixture update failed', sourceMatchRef, (updErr as Error).message);
            return null;
          }
          fixtureId = (existing as { id: string }).id;
        } else {
          const { data: ins, error: insErr } = await (supabase.from('fixtures') as any)
            .insert({
              season_id: seasonId,
              competition_group_id: seasonId,
              source_match_ref: sourceMatchRef,
              home_team_id: homeId,
              away_team_id: awayId,
              scheduled_at: kickoff,
              status,
            })
            .select('id')
            .single();
          if (insErr) {
            console.warn('[MyWRU persist] fixture insert failed', sourceMatchRef, (insErr as Error).message);
            return null;
          }
          fixtureId = (ins as { id: string }).id;
        }
        const { data: existingMatch } = await (supabase.from('matches') as any)
          .select('fixture_id')
          .eq('fixture_id', fixtureId)
          .maybeSingle();
        if (!existingMatch?.fixture_id) {
          const { error: matchErr } = await (supabase.from('matches') as any).insert({
            fixture_id: fixtureId,
            status,
            score_home: m.score_home ?? 0,
            score_away: m.score_away ?? 0,
          });
          if (matchErr) {
            console.warn('[MyWRU persist] match insert failed', fixtureId, (matchErr as Error).message);
          }
        }
        return fixtureId;
      };

      for (const f of g.fixtures) {
        const fixtureId = await upsertFixture(f);
        if (!fixtureId) continue;
        await writeProvenance(
          supabase,
          'fixture',
          fixtureId,
          sourceId,
          `mywru:fixture:${g.competition_group_id}:${f.source_match_ref}`,
          g.runId,
          g.ingestItemIds.fixtures
        );
        out.fixturesWritten += 1;
      }

      for (const r of g.results) {
        const fixtureId = await upsertFixture(r);
        if (!fixtureId) continue;
        const { error: matchUpd } = await (supabase.from('matches') as any)
          .update({
            status: 'full_time',
            score_home: r.score_home ?? 0,
            score_away: r.score_away ?? 0,
          })
          .eq('fixture_id', fixtureId);
        if (matchUpd) {
          console.warn('[MyWRU persist] match update failed', fixtureId, (matchUpd as Error).message);
          continue;
        }
        await writeProvenance(
          supabase,
          'result',
          fixtureId,
          sourceId,
          `mywru:result:${g.competition_group_id}:${r.source_match_ref}`,
          g.runId,
          g.ingestItemIds.results
        );
        out.resultsWritten += 1;
      }

      const parsedStandingsCount = g.standings.length;
      let standingsWrittenThisGroup = 0;
      if (parsedStandingsCount > 0) {
        console.info('[MyWRU persist] standings', {
          source_ref: g.competition_group_id,
          competitionId,
          seasonId,
          parsedStandingsCount,
        });
      }
      for (const s of g.standings) {
        if (!isValidTeamName(s.team_name)) {
          console.warn('[MyWRU persist] skip standing invalid team name', {
            groupId: g.competition_group_id,
            team_name: s.team_name,
          });
          continue;
        }
        const teamId = await getTeamId(s.team_name);
        const points =
          s.table_points ?? (4 * (s.won ?? 0) + 2 * (s.drawn ?? 0));
        const row: Record<string, unknown> = {
          season_id: seasonId,
          team_id: teamId,
          position: s.position ?? 0,
          played: s.played ?? 0,
          won: s.won ?? 0,
          drawn: s.drawn ?? 0,
          lost: s.lost ?? 0,
          points_for: s.points_for ?? 0,
          points_against: s.points_against ?? 0,
          points,
        };
        const { error: upsErr } = await (supabase.from('standings') as any).upsert(row, {
          onConflict: 'season_id,team_id',
        });
        if (upsErr) {
          const msg = (upsErr as Error).message;
          if (out.standingsWritten === 0) console.warn('[MyWRU persist] first standing upsert error:', msg);
          console.warn('[MyWRU persist] standing upsert failed', s.team_name, msg);
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
            `mywru:standing:${g.competition_group_id}:${s.position}:${normalizeText(s.team_name)}`,
            g.runId,
            g.ingestItemIds.standings
          );
        }
        out.standingsWritten += 1;
        standingsWrittenThisGroup += 1;
      }
      if (parsedStandingsCount > 0) {
        console.info('[MyWRU persist] standings written', {
          source_ref: g.competition_group_id,
          parsedStandingsCount,
          writtenStandingsCount: standingsWrittenThisGroup,
          seasonId,
          competitionId,
        });
      }

      out.groupsProcessed += 1;
    } catch (e) {
      const msg = (e as Error).message;
      out.failures.push(`group ${g.competition_group_id}: ${msg}`);
      console.warn('[MyWRU persist] group error', g.competition_group_id, msg);
    }
  }

  return out;
}
