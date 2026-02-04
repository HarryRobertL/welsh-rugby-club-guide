import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { FixtureListItem } from '../../types/games';

const FIXTURES_LIMIT = 50;

type FixtureRow = {
  id: string;
  scheduled_at: string;
  status: string;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
  venue: { name: string } | null;
  matches: { score_home: number; score_away: number }[] | null;
};

/**
 * Fetches fixtures list (all statuses); static fetch only.
 * File: features/games/useFixturesList.ts — Games tab fixtures list query.
 */
export function useFixturesList(): {
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
        .order('scheduled_at', { ascending: false })
        .limit(FIXTURES_LIMIT);
      if (err) throw err;
      const rows = (data ?? []) as FixtureRow[];
      const list: FixtureListItem[] = rows.map((row) => ({
        id: row.id,
        scheduled_at: row.scheduled_at,
        status: row.status as FixtureListItem['status'],
        home_team_name: row.home_team?.name ?? '—',
        away_team_name: row.away_team?.name ?? '—',
        venue_name: row.venue?.name ?? null,
        score_home: row.matches?.[0]?.score_home ?? null,
        score_away: row.matches?.[0]?.score_away ?? null,
      }));
      setFixtures(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load fixtures');
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { fixtures, loading, error, refetch: fetch };
}
