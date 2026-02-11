/**
 * Persist Six Nations OVAL data into core tables. Identity: source=sixnations, source_ref=compId:seasonId.
 * File: ingestion/sources/sixnations/persist.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveCompetitionTypeFromName } from '../../lib/deriveCompetitionType';

const SOURCE = 'sixnations';
const DEFAULT_REGION = 'International';
const TEAM_TYPE = 'men';

export type OvalStandingRow = {
  position?: number;
  teamId?: string | number;
  teamName?: string;
  name?: string;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  pointsFor?: number;
  points_for?: number;
  points_against?: number;
  pointsAgainst?: number;
  points?: number;
  pts?: number;
};

export type OvalFixtureRow = {
  id?: string | number;
  matchId?: string | number;
  homeTeamId?: string | number;
  awayTeamId?: string | number;
  homeTeamName?: string;
  awayTeamName?: string;
  home_team_name?: string;
  away_team_name?: string;
  scheduled_at?: string;
  kickoff?: string;
  date?: string;
  venue?: string;
  venueName?: string;
  scoreHome?: number;
  scoreAway?: number;
  score_home?: number;
  score_away?: number;
  status?: string;
  isLive?: boolean;
  round?: string | number;
};

function normalizeText(s: string): string {
  return (s ?? '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function slugify(s: string): string {
  return normalizeText(s)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function sourceTeamKey(teamId: string | number): string {
  return `${SOURCE}:${teamId}`;
}

async function ensureRegion(supabase: SupabaseClient): Promise<string> {
  const { data } = await (supabase.from('regions') as any)
    .select('id')
    .eq('name', DEFAULT_REGION)
    .maybeSingle();
  if (data?.id) return (data as { id: string }).id;
  const slug = slugify(DEFAULT_REGION) || 'international';
  const { data: ins, error } = await (supabase.from('regions') as any)
    .insert({ name: DEFAULT_REGION, slug })
    .select('id')
    .single();
  if (error) throw new Error(`regions: ${(error as Error).message}`);
  return (ins as { id: string }).id;
}

async function ensureClub(supabase: SupabaseClient, regionId: string): Promise<string> {
  const name = 'Six Nations';
  const { data } = await (supabase.from('clubs') as any)
    .select('id')
    .eq('region_id', regionId)
    .eq('name', name)
    .maybeSingle();
  if (data?.id) return (data as { id: string }).id;
  const slug = slugify(name) || 'six-nations';
  const { data: ins, error } = await (supabase.from('clubs') as any)
    .insert({ region_id: regionId, name, slug })
    .select('id')
    .single();
  if (error) throw new Error(`clubs: ${(error as Error).message}`);
  return (ins as { id: string }).id;
}

async function ensureCompetition(
  supabase: SupabaseClient,
  sourceRef: string,
  name: string
): Promise<string> {
  const slug = `${SOURCE}-${sourceRef.replace(/:/g, '-')}`.slice(0, 100);
  const { data, error } = await (supabase.from('competitions') as any)
    .upsert(
      {
        name: name || 'Six Nations',
        slug,
        competition_type: deriveCompetitionTypeFromName(name),
        source: SOURCE,
        source_ref: sourceRef,
      },
      { onConflict: 'source,source_ref' }
    )
    .select('id')
    .single();
  if (error) throw new Error(`competitions: ${(error as Error).message}`);
  return (data as { id: string }).id;
}

async function ensureSeason(
  supabase: SupabaseClient,
  competitionId: string,
  compId: number,
  seasonIdStr: string
): Promise<string> {
  const year = parseInt(seasonIdStr.slice(0, 4), 10) || new Date().getFullYear();
  const name = `${year}/${String(year + 1).slice(-2)}`;
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
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
    if (error) throw new Error(`seasons: ${(error as Error).message}`);
    season = ins;
  }
  const seasonUuid = (season as { id: string }).id;
  const mapRef = `${compId}:${seasonIdStr}`;
  const { data: existing } = await (supabase.from('source_competition_group_map') as any)
    .select('id')
    .eq('source', SOURCE)
    .eq('source_group_id', mapRef)
    .maybeSingle();
  if (!existing?.id) {
    await (supabase.from('source_competition_group_map') as any).insert({
      source: SOURCE,
      source_group_id: mapRef,
      competition_group_id: seasonUuid,
    });
  }
  return seasonUuid;
}

async function ensureTeam(
  supabase: SupabaseClient,
  clubId: string,
  ovalTeamId: string | number
): Promise<string> {
  const key = sourceTeamKey(String(ovalTeamId));
  const { data: mapping } = await (supabase.from('source_team_map') as any)
    .select('team_id')
    .eq('source', SOURCE)
    .eq('source_team_name', key)
    .maybeSingle();
  if (mapping?.team_id) return (mapping as { team_id: string }).team_id;
  const name = `Team ${ovalTeamId}`;
  const slug = `${SOURCE}-team-${ovalTeamId}`.slice(0, 100);
  const { data: team, error } = await (supabase.from('teams') as any)
    .insert({
      club_id: clubId,
      name: normalizeText(name),
      slug,
      team_type: TEAM_TYPE,
    })
    .select('id')
    .single();
  if (error) throw new Error(`teams: ${(error as Error).message}`);
  const teamId = (team as { id: string }).id;
  await (supabase.from('source_team_map') as any).insert({
    source: SOURCE,
    source_team_name: key,
    team_id: teamId,
  });
  return teamId;
}

async function ensureTeamByName(
  supabase: SupabaseClient,
  clubId: string,
  ovalTeamId: string | number,
  teamName: string
): Promise<string> {
  const key = sourceTeamKey(String(ovalTeamId));
  const { data: mapping } = await (supabase.from('source_team_map') as any)
    .select('team_id')
    .eq('source', SOURCE)
    .eq('source_team_name', key)
    .maybeSingle();
  if (mapping?.team_id) return (mapping as { team_id: string }).team_id;
  const name = (teamName || `Team ${ovalTeamId}`).trim() || `Team ${ovalTeamId}`;
  const slug = `${SOURCE}-${slugify(name)}`.slice(0, 100);
  const { data: team, error } = await (supabase.from('teams') as any)
    .insert({
      club_id: clubId,
      name: normalizeText(name),
      slug,
      team_type: TEAM_TYPE,
    })
    .select('id')
    .single();
  if (error) throw new Error(`teams: ${(error as Error).message}`);
  const teamId = (team as { id: string }).id;
  await (supabase.from('source_team_map') as any).insert({
    source: SOURCE,
    source_team_name: key,
    team_id: teamId,
  });
  return teamId;
}

function fixtureStatus(s: string | undefined, isLive?: boolean): string {
  const v = (s ?? '').toLowerCase();
  if (isLive === true) return 'live';
  if (['full_time', 'fulltime', 'ft', 'completed', 'result'].includes(v)) return 'full_time';
  if (['postponed', 'cancelled'].includes(v)) return v;
  return 'scheduled';
}

export async function persistSixNations(options: {
  supabase: SupabaseClient;
  compId: number;
  seasonId: string;
  competitionName: string;
  standings: OvalStandingRow[];
  fixtures: OvalFixtureRow[];
}): Promise<{ standingsWritten: number; fixturesWritten: number; teamsCreated: number; error?: string }> {
  const { supabase, compId, seasonId, competitionName, standings, fixtures } = options;
  let standingsWritten = 0;
  let fixturesWritten = 0;
  let teamsCreated = 0;
  try {
    const sourceRef = `${compId}:${seasonId}`;
    const regionId = await ensureRegion(supabase);
    const clubId = await ensureClub(supabase, regionId);
    const competitionId = await ensureCompetition(supabase, sourceRef, competitionName);
    const seasonUuid = await ensureSeason(supabase, competitionId, compId, seasonId);

    const teamIdByOvalId = new Map<string, string>();
    const getTeamId = async (ovalId: string | number, name?: string): Promise<string> => {
      const k = String(ovalId);
      let id = teamIdByOvalId.get(k);
      if (!id) {
        id = name
          ? await ensureTeamByName(supabase, clubId, ovalId, name)
          : await ensureTeam(supabase, clubId, ovalId);
        teamIdByOvalId.set(k, id);
        teamsCreated += 1;
      }
      return id;
    };

    for (const row of standings) {
      const pos = row.position ?? 0;
      const ovalTeamId = row.teamId ?? row.teamName ?? row.name ?? pos;
      const name = (row.teamName ?? row.name ?? '').trim();
      const teamId = await getTeamId(ovalTeamId, name || undefined);
      const played = Number(row.played) || 0;
      const won = Number(row.won) || 0;
      const drawn = Number(row.drawn) || 0;
      const lost = Number(row.lost) || 0;
      const pointsFor = Number(row.pointsFor ?? row.points_for) || 0;
      const pointsAgainst = Number(row.points_against ?? row.pointsAgainst) || 0;
      const points = Number(row.points ?? row.pts) || 4 * won + 2 * drawn;
      const { error: upsertErr } = await (supabase.from('standings') as any).upsert(
        {
          season_id: seasonUuid,
          team_id: teamId,
          position: pos,
          played,
          won,
          drawn,
          lost,
          points_for: pointsFor,
          points_against: pointsAgainst,
          points,
        },
        { onConflict: 'season_id,team_id' }
      );
      if (!upsertErr) standingsWritten += 1;
    }

    for (const row of fixtures) {
      const homeName = (row.homeTeamName ?? row.home_team_name ?? 'TBC').trim();
      const awayName = (row.awayTeamName ?? row.away_team_name ?? 'TBC').trim();
      const homeOvalId = row.homeTeamId ?? row.homeTeamName ?? homeName;
      const awayOvalId = row.awayTeamId ?? row.awayTeamName ?? awayName;
      const homeId = await getTeamId(homeOvalId, homeName);
      const awayId = await getTeamId(awayOvalId, awayName);
      if (homeId === awayId) continue;
      const scheduledAt = row.scheduled_at ?? row.kickoff ?? row.date ?? new Date().toISOString();
      const status = fixtureStatus(row.status, row.isLive);
      const scoreHome = Number(row.scoreHome ?? row.score_home) || 0;
      const scoreAway = Number(row.scoreAway ?? row.score_away) || 0;
      const sourceMatchRef = `sixnations:${row.id ?? row.matchId ?? `${homeOvalId}-${awayOvalId}-${scheduledAt}`}`;
      const { data: existing } = await (supabase.from('fixtures') as any)
        .select('id')
        .eq('season_id', seasonUuid)
        .eq('source_match_ref', sourceMatchRef)
        .maybeSingle();
      if (existing?.id) {
        const fixtureId = (existing as { id: string }).id;
        await (supabase.from('fixtures') as any)
          .update({
            home_team_id: homeId,
            away_team_id: awayId,
            scheduled_at: scheduledAt,
            status,
          })
          .eq('id', fixtureId);
        fixturesWritten += 1;
        if (status === 'full_time' || status === 'live') {
          await (supabase.from('matches') as any).upsert(
            {
              fixture_id: fixtureId,
              status,
              score_home: scoreHome,
              score_away: scoreAway,
              started_at: status === 'live' ? new Date().toISOString() : null,
              ended_at: status === 'full_time' ? new Date().toISOString() : null,
            },
            { onConflict: 'fixture_id' }
          );
        }
      } else {
        const { data: ins, error: insErr } = await (supabase.from('fixtures') as any)
          .insert({
            season_id: seasonUuid,
            competition_group_id: seasonUuid,
            source_match_ref: sourceMatchRef,
            home_team_id: homeId,
            away_team_id: awayId,
            scheduled_at: scheduledAt,
            status,
          })
          .select('id')
          .single();
        if (!insErr && ins?.id) {
          fixturesWritten += 1;
          if (status === 'full_time' || status === 'live') {
            await (supabase.from('matches') as any).upsert(
              {
                fixture_id: (ins as { id: string }).id,
                status,
                score_home: scoreHome,
                score_away: scoreAway,
                started_at: status === 'live' ? new Date().toISOString() : null,
                ended_at: status === 'full_time' ? new Date().toISOString() : null,
              },
              { onConflict: 'fixture_id' }
            );
          }
        }
      }
    }

    return { standingsWritten, fixturesWritten, teamsCreated };
  } catch (e) {
    return {
      standingsWritten,
      fixturesWritten,
      teamsCreated,
      error: (e as Error).message,
    };
  }
}
