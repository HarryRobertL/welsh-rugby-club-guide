import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ensureString } from '../../lib/teamLabel';
import type { FixtureListItem } from '../../types/games';

const FIXTURES_LIMIT = 150;

type TeamRelation = { name?: string; organisationName?: string } | { name?: string; organisationName?: string }[] | null;

type FixtureRow = {
  id: string;
  scheduled_at: string;
  status: string;
  home_team_id: string;
  away_team_id: string;
  home_team: TeamRelation;
  away_team: TeamRelation;
  venue: { name: string } | null;
  matches: { score_home: number; score_away: number }[] | null;
  season?: { competition_id: string; competitions: { id: string; name: string } | null } | null;
};

function teamNameFromRelation(v: TeamRelation): string {
  const raw = Array.isArray(v) ? v[0] : v;
  if (raw && typeof raw === 'object') {
    const name = (raw as { name?: string }).name ?? (raw as { organisationName?: string }).organisationName;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return '—';
}

/**
 * Fetches fixtures with competition info for Games tab. One query, no N+1.
 * Upcoming = scheduled_at >= now or live; Results = full_time etc. Filtering/grouping is done by the screen.
 */
export function useFixturesList(params: {
  mode: 'upcoming' | 'results';
  competitionIds?: string[];
  now: Date;
}): {
  fixtures: FixtureListItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [fixtures, setFixtures] = useState<FixtureListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nowIso = params.now.toISOString();
      const hasCompetitionFilter = Array.isArray(params.competitionIds) && params.competitionIds.length > 0;
      const filter = params.mode === 'upcoming'
        ? `scheduled_at.gte.${nowIso},status.eq.live`
        : `status.eq.full_time,scheduled_at.lt.${nowIso}`;
      let query = supabase
        .from('fixtures')
        .select(
          `
          id,
          scheduled_at,
          status,
          home_team_id,
          away_team_id,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name),
          venue:venues(name),
          matches(score_home, score_away),
          season:seasons(competition_id, competitions(id, name))
        `
        )
        .or(filter)
        .order('scheduled_at', { ascending: params.mode === 'upcoming' });
      if (hasCompetitionFilter) {
        query = query.in('season.competition_id', params.competitionIds as string[]);
      }
      const { data, error: err } = await query.limit(FIXTURES_LIMIT);
      if (err) throw err;
      const rows = (data ?? []) as FixtureRow[];
      const list: FixtureListItem[] = rows.map((row) => {
        const comp = row.season?.competitions;
        return {
          id: row.id,
          scheduled_at: row.scheduled_at,
          status: row.status as FixtureListItem['status'],
          home_team_id: row.home_team_id,
          away_team_id: row.away_team_id,
          home_team_name: ensureString(teamNameFromRelation(row.home_team)),
          away_team_name: ensureString(teamNameFromRelation(row.away_team)),
          venue_name: row.venue?.name ?? null,
          score_home: row.matches?.[0]?.score_home ?? null,
          score_away: row.matches?.[0]?.score_away ?? null,
          competition_id: comp?.id ?? row.season?.competition_id,
          competition_name: comp?.name ?? undefined,
        };
      }).filter((row) => {
        if (params.mode === 'upcoming') {
          return row.status === 'live' || row.scheduled_at >= nowIso;
        }
        if (row.status === 'full_time') return true;
        const hasResult = row.score_home != null && row.score_away != null;
        return row.scheduled_at < nowIso && hasResult;
      });
      setFixtures(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load fixtures');
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  }, [params.mode, params.now, params.competitionIds]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { fixtures, loading, error, refetch: fetch };
}
