import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useFavourites } from '../favourites/useFavourites';
import type { LiveMatch, UpcomingFixture } from '../../types/home';

const UPCOMING_LIMIT = 20;

type HomeData = {
  favouriteTeamIds: string[];
  favouriteFixtureIds: string[];
  upcomingFixtures: UpcomingFixture[];
  liveMatches: LiveMatch[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

type FixtureRow = {
  id: string;
  scheduled_at: string;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
  venue: { name: string } | null;
};

const mapFixtureRow = (row: FixtureRow): UpcomingFixture => ({
  id: row.id,
  scheduled_at: row.scheduled_at,
  home_team_name: row.home_team?.name ?? '—',
  away_team_name: row.away_team?.name ?? '—',
  venue_name: row.venue?.name ?? null,
});

/**
 * Home feed driven by favourites: teams + fixtures. Fetches upcoming for favourited teams and favourited fixtures, plus live matches.
 * File: features/home/useHomeData.ts
 */
export function useHomeData(): HomeData {
  const { session } = useAuth();
  const { teamIds: favouriteTeamIds, fixtureIds: favouriteFixtureIds } = useFavourites();
  const [upcomingFixtures, setUpcomingFixtures] = useState<UpcomingFixture[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!session?.user?.id) {
      setUpcomingFixtures([]);
      setLiveMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const fixtureSelect = `
        id,
        scheduled_at,
        home_team:teams!home_team_id(name),
        away_team:teams!away_team_id(name),
        venue:venues(name)
      `;

      // 1. Live matches (unchanged)
      const { data: liveData, error: liveErr } = await supabase
        .from('fixtures')
        .select(
          `
          id,
          scheduled_at,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name),
          venue:venues(name),
          matches(score_home, score_away)
        `
        )
        .eq('status', 'live')
        .order('scheduled_at', { ascending: true });
      if (liveErr) throw liveErr;
      type LiveRow = {
        id: string;
        scheduled_at: string;
        home_team: { name: string } | null;
        away_team: { name: string } | null;
        venue: { name: string } | null;
        matches: { score_home: number; score_away: number }[] | null;
      };
      const live: LiveMatch[] = ((liveData ?? []) as LiveRow[]).map((row) => ({
        id: row.id,
        fixture_id: row.id,
        scheduled_at: row.scheduled_at,
        home_team_name: row.home_team?.name ?? '—',
        away_team_name: row.away_team?.name ?? '—',
        venue_name: row.venue?.name ?? null,
        score_home: row.matches?.[0]?.score_home ?? 0,
        score_away: row.matches?.[0]?.score_away ?? 0,
      }));
      setLiveMatches(live);

      // 2. Upcoming: from favourited teams + favourited fixtures (scheduled, in future)
      const byId = new Map<string, UpcomingFixture>();

      if (favouriteTeamIds.length > 0) {
        const { data: homeFixtures, error: homeErr } = await supabase
          .from('fixtures')
          .select(fixtureSelect)
          .in('home_team_id', favouriteTeamIds)
          .eq('status', 'scheduled')
          .gte('scheduled_at', now)
          .order('scheduled_at', { ascending: true })
          .limit(UPCOMING_LIMIT);
        if (homeErr) throw homeErr;
        const { data: awayFixtures, error: awayErr } = await supabase
          .from('fixtures')
          .select(fixtureSelect)
          .in('away_team_id', favouriteTeamIds)
          .eq('status', 'scheduled')
          .gte('scheduled_at', now)
          .order('scheduled_at', { ascending: true })
          .limit(UPCOMING_LIMIT);
        if (awayErr) throw awayErr;
        ((homeFixtures ?? []) as FixtureRow[]).forEach((row) => byId.set(row.id, mapFixtureRow(row)));
        ((awayFixtures ?? []) as FixtureRow[]).forEach((row) => byId.set(row.id, mapFixtureRow(row)));
      }

      if (favouriteFixtureIds.length > 0) {
        const { data: favFixtures, error: favErr } = await supabase
          .from('fixtures')
          .select(fixtureSelect)
          .in('id', favouriteFixtureIds)
          .eq('status', 'scheduled')
          .gte('scheduled_at', now)
          .order('scheduled_at', { ascending: true })
          .limit(UPCOMING_LIMIT);
        if (favErr) throw favErr;
        ((favFixtures ?? []) as FixtureRow[]).forEach((row) => byId.set(row.id, mapFixtureRow(row)));
      }

      const merged = Array.from(byId.values()).sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      );
      setUpcomingFixtures(merged.slice(0, UPCOMING_LIMIT));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load home data');
      setUpcomingFixtures([]);
      setLiveMatches([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, favouriteTeamIds, favouriteFixtureIds]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    favouriteTeamIds,
    favouriteFixtureIds,
    upcomingFixtures,
    liveMatches,
    loading,
    error,
    refetch: fetch,
  };
}
