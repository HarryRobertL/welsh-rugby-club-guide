import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { MatchCentre } from '../../types/games';

type MatchCentreRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  scheduled_at: string;
  status: string;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
  venue: { name: string; address: string | null } | null;
  matches: { id: string; score_home: number; score_away: number }[] | null;
};

/**
 * Fetches single fixture + match + teams + venue for match centre.
 * Subscribes to matches table when match_id is present so score updates live.
 * File: features/games/useMatchCentre.ts
 */
export function useMatchCentre(fixtureId: string | undefined): {
  matchCentre: MatchCentre | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [matchCentre, setMatchCentre] = useState<MatchCentre | null>(null);
  const [loading, setLoading] = useState(!!fixtureId);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef<(skipLoading?: boolean) => Promise<void>>(() => Promise.resolve());

  const fetch = useCallback(async (skipLoading = false) => {
    if (!fixtureId) {
      setMatchCentre(null);
      setLoading(false);
      return;
    }
    if (!skipLoading) setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('fixtures')
        .select(
          `
          id,
          home_team_id,
          away_team_id,
          scheduled_at,
          status,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name),
          venue:venues(name, address),
          matches(id, score_home, score_away)
        `
        )
        .eq('id', fixtureId)
        .single();
      if (err) throw err;
      const row = data as MatchCentreRow | null;
      if (!row) {
        setMatchCentre(null);
        return;
      }
      const match = row.matches?.[0];
      setMatchCentre({
        id: row.id,
        fixture_id: row.id,
        match_id: match?.id ?? null,
        scheduled_at: row.scheduled_at,
        status: row.status as MatchCentre['status'],
        home_team_id: row.home_team_id,
        away_team_id: row.away_team_id,
        home_team_name: row.home_team?.name ?? '—',
        away_team_name: row.away_team?.name ?? '—',
        venue_name: row.venue?.name ?? null,
        venue_address: row.venue?.address ?? null,
        score_home: match?.score_home ?? 0,
        score_away: match?.score_away ?? 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load match');
      setMatchCentre(null);
    } finally {
      if (!skipLoading) setLoading(false);
    }
  }, [fixtureId]);

  fetchRef.current = fetch;

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime: when match row (score/status) changes, refetch match centre
  useEffect(() => {
    const matchId = matchCentre?.match_id;
    if (!matchId) return;

    const channel = supabase
      .channel(`match_centre:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        () => {
          fetchRef.current(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchCentre?.match_id]);

  return { matchCentre, loading, error, refetch: () => fetch(false) };
}
