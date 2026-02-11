import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toTeamDisplayString } from '../../lib/teamLabel';
import type { FixtureListItem } from '../../types/games';

type FixtureRow = {
  id: string;
  scheduled_at: string;
  status: string;
  home_team: unknown;
  away_team: unknown;
  venue: { name: string } | null;
  matches: { score_home: number; score_away: number }[] | null;
};

/**
 * Fetch fixtures/results for a specific season.
 * File: features/competitions/useFixturesBySeason.ts
 */
export function useFixturesBySeason(seasonId: string | undefined): {
  fixtures: FixtureListItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [fixtures, setFixtures] = useState<FixtureListItem[]>([]);
  const [loading, setLoading] = useState(!!seasonId);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!seasonId) {
      setFixtures([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('fixtures')
        .select(
          `
          id,
          scheduled_at,
          status,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name),
          venue:venues(name),
          matches(score_home, score_away)
        `
        )
        .eq('season_id', seasonId)
        .order('scheduled_at', { ascending: false })
        .limit(500);
      if (err) throw err;
      const rows = (data ?? []) as FixtureRow[];
      setFixtures(
        rows.map((row) => ({
          id: row.id,
          scheduled_at: row.scheduled_at,
          status: row.status as FixtureListItem['status'],
          home_team_name: toTeamDisplayString(row.home_team),
          away_team_name: toTeamDisplayString(row.away_team),
          venue_name: typeof row.venue?.name === 'string' ? row.venue.name : null,
          score_home: row.matches?.[0]?.score_home ?? null,
          score_away: row.matches?.[0]?.score_away ?? null,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load fixtures');
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { fixtures, loading, error, refetch: fetch };
}
