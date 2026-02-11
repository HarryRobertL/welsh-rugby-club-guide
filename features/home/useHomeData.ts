import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toTeamDisplayString } from '../../lib/teamLabel';
import type { LiveMatch, UpcomingFixture } from '../../types/home';

const UPCOMING_LIMIT = 20;

type HomeData = {
  favouriteTeamIds: string[];
  favouriteCompetitionIds: string[];
  favouriteFixtureIds: string[];
  upcomingFixtures: UpcomingFixture[];
  liveMatches: LiveMatch[];
  loading: boolean;
  /** Alias for loading. */
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Future: recent results for favourites. Not implemented; use when UI needs it. */
  recentResults?: undefined;
  /** Future: standings snapshot for favourite competitions. Not implemented; use when UI needs it. */
  standingsSnapshot?: undefined;
};

type HomeDataInput = {
  userId?: string;
  favouriteTeamIds: string[];
  favouriteCompetitionIds: string[];
  favouriteFixtureIds: string[];
};

type FixtureRow = {
  id: string;
  scheduled_at: string;
  home_team: unknown;
  away_team: unknown;
  venue: { name: string } | null;
  season?: { competition_id: string; competitions: { id: string; name: string } | null } | null;
};

const mapFixtureRow = (row: FixtureRow): UpcomingFixture => ({
  id: row.id,
  scheduled_at: row.scheduled_at,
  home_team_name: toTeamDisplayString(row.home_team),
  away_team_name: toTeamDisplayString(row.away_team),
  venue_name: row.venue?.name ?? null,
  competition_id: row.season?.competition_id ?? row.season?.competitions?.id,
  competition_name: row.season?.competitions?.name ?? undefined,
});

/**
 * Home feed driven by favourites: teams + fixtures. Fetches upcoming for favourited teams and favourited fixtures, plus live matches.
 * File: features/home/useHomeData.ts
 */
export function useHomeData({
  userId,
  favouriteTeamIds,
  favouriteCompetitionIds,
  favouriteFixtureIds,
}: HomeDataInput): HomeData {
  const [upcomingFixtures, setUpcomingFixtures] = useState<UpcomingFixture[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!userId) {
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
        venue:venues(name),
        season:seasons(competition_id, competitions(id, name))
      `;

      // 1) Build upcoming query set early so we can run it in parallel with live query.
      const byId = new Map<string, UpcomingFixture>();

      const hasFavourites =
        favouriteTeamIds.length > 0 ||
        favouriteCompetitionIds.length > 0 ||
        favouriteFixtureIds.length > 0;

      const liveQuery = supabase
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

      const upcomingAllQuery = !hasFavourites
        ? supabase
            .from('fixtures')
            .select(fixtureSelect)
            .eq('status', 'scheduled')
            .gte('scheduled_at', now)
            .order('scheduled_at', { ascending: true })
            .limit(UPCOMING_LIMIT)
        : Promise.resolve({ data: [] as FixtureRow[], error: null });

      const teamHomeQuery = hasFavourites && favouriteTeamIds.length > 0
        ? supabase
            .from('fixtures')
            .select(fixtureSelect)
            .in('home_team_id', favouriteTeamIds)
            .eq('status', 'scheduled')
            .gte('scheduled_at', now)
            .order('scheduled_at', { ascending: true })
            .limit(UPCOMING_LIMIT)
        : Promise.resolve({ data: [] as FixtureRow[], error: null });

      const teamAwayQuery = hasFavourites && favouriteTeamIds.length > 0
        ? supabase
            .from('fixtures')
            .select(fixtureSelect)
            .in('away_team_id', favouriteTeamIds)
            .eq('status', 'scheduled')
            .gte('scheduled_at', now)
            .order('scheduled_at', { ascending: true })
            .limit(UPCOMING_LIMIT)
        : Promise.resolve({ data: [] as FixtureRow[], error: null });

      const favouriteFixturesQuery = hasFavourites && favouriteFixtureIds.length > 0
        ? supabase
            .from('fixtures')
            .select(fixtureSelect)
            .in('id', favouriteFixtureIds)
            .eq('status', 'scheduled')
            .gte('scheduled_at', now)
            .order('scheduled_at', { ascending: true })
            .limit(UPCOMING_LIMIT)
        : Promise.resolve({ data: [] as FixtureRow[], error: null });

      const seasonsQuery = hasFavourites && favouriteCompetitionIds.length > 0
        ? supabase
            .from('seasons')
            .select('id')
            .in('competition_id', favouriteCompetitionIds)
        : Promise.resolve({ data: [] as { id: string }[], error: null });

      const [
        liveRes,
        upcomingAllRes,
        teamHomeRes,
        teamAwayRes,
        favouriteFixturesRes,
        seasonsRes,
      ] = await Promise.all([
        liveQuery,
        upcomingAllQuery,
        teamHomeQuery,
        teamAwayQuery,
        favouriteFixturesQuery,
        seasonsQuery,
      ]);

      if (liveRes.error) throw liveRes.error;
      if (upcomingAllRes.error) throw upcomingAllRes.error;
      if (teamHomeRes.error) throw teamHomeRes.error;
      if (teamAwayRes.error) throw teamAwayRes.error;
      if (favouriteFixturesRes.error) throw favouriteFixturesRes.error;
      if (seasonsRes.error) throw seasonsRes.error;

      type LiveRow = FixtureRow & {
        matches: { score_home: number; score_away: number }[] | null;
      };
      const live: LiveMatch[] = ((liveRes.data ?? []) as LiveRow[]).map((row) => ({
        id: row.id,
        fixture_id: row.id,
        scheduled_at: row.scheduled_at,
        home_team_name: toTeamDisplayString(row.home_team),
        away_team_name: toTeamDisplayString(row.away_team),
        venue_name: row.venue?.name ?? null,
        score_home: row.matches?.[0]?.score_home ?? 0,
        score_away: row.matches?.[0]?.score_away ?? 0,
      }));
      setLiveMatches(live);

      ((upcomingAllRes.data ?? []) as FixtureRow[]).forEach((row) => byId.set(row.id, mapFixtureRow(row)));
      ((teamHomeRes.data ?? []) as FixtureRow[]).forEach((row) => byId.set(row.id, mapFixtureRow(row)));
      ((teamAwayRes.data ?? []) as FixtureRow[]).forEach((row) => byId.set(row.id, mapFixtureRow(row)));
      ((favouriteFixturesRes.data ?? []) as FixtureRow[]).forEach((row) => byId.set(row.id, mapFixtureRow(row)));

      const seasonIds = (seasonsRes.data ?? []).map((s: { id: string }) => s.id);
      if (seasonIds.length > 0) {
        const { data: compFixtures, error: compErr } = await supabase
          .from('fixtures')
          .select(fixtureSelect)
          .in('season_id', seasonIds)
          .eq('status', 'scheduled')
          .gte('scheduled_at', now)
          .order('scheduled_at', { ascending: true })
          .limit(UPCOMING_LIMIT);
        if (compErr) throw compErr;
        ((compFixtures ?? []) as FixtureRow[]).forEach((row) => byId.set(row.id, mapFixtureRow(row)));
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
  }, [userId, favouriteTeamIds, favouriteCompetitionIds, favouriteFixtureIds]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    favouriteTeamIds,
    favouriteCompetitionIds,
    favouriteFixtureIds,
    upcomingFixtures,
    liveMatches,
    loading,
    isLoading: loading,
    error,
    refetch: fetch,
    recentResults: undefined,
    standingsSnapshot: undefined,
  };
}

// TODO(realtime): Optional subscriptions limited to favourite/live matches; unsubscribe on unmount.
// Realtime failures must not break the hook. Do not replace existing fetch logic.
