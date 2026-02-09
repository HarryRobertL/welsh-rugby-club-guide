import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { teamLabel } from '../../lib/teamLabel';
import type { MatchCentre } from '../../types/games';

type MatchCentreRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  scheduled_at: string;
  status: string;
  home_team: { name: string } | { name: string }[] | null;
  away_team: { name: string } | { name: string }[] | null;
  venue: { name: string; address: string | null } | null;
  matches: { id: string; score_home: number; score_away: number }[] | null;
};

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

const normalizeRelation = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const assertTeamLabel = (label: string, relation: unknown, side: 'home' | 'away', fixtureId: string) => {
  if (!isDev || typeof console === 'undefined' || !console.warn) return;
  if (label === '[object Object]') {
    console.warn(`Match centre team label rendered as [object Object]`, {
      fixtureId,
      side,
      relation,
    });
  }
  if (label === '—' && relation) {
    console.warn(`Match centre team label is empty despite relation`, {
      fixtureId,
      side,
      relation,
    });
  }
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
      const homeTeam = normalizeRelation(row.home_team);
      const awayTeam = normalizeRelation(row.away_team);
      const homeLabel = teamLabel(homeTeam);
      const awayLabel = teamLabel(awayTeam);
      assertTeamLabel(homeLabel, row.home_team, 'home', row.id);
      assertTeamLabel(awayLabel, row.away_team, 'away', row.id);
      setMatchCentre({
        id: row.id,
        fixture_id: row.id,
        match_id: match?.id ?? null,
        scheduled_at: row.scheduled_at,
        status: row.status as MatchCentre['status'],
        home_team_id: row.home_team_id,
        away_team_id: row.away_team_id,
        home_team_name: homeLabel,
        away_team_name: awayLabel,
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
