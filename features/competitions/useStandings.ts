import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { LeagueTableRow } from '../../types/competitions';

type StandingsRow = {
  id: string;
  position: number;
  team_id: string;
  team: { name: string } | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points_for: number;
  points_against: number;
  points: number;
};

/**
 * Fetches standings for a season (league table). Joined with teams; ordered by position.
 * File: features/competitions/useStandings.ts — data from standings table.
 */
export function useStandings(seasonId: string | undefined): {
  rows: LeagueTableRow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [rows, setRows] = useState<LeagueTableRow[]>([]);
  const [loading, setLoading] = useState(!!seasonId);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!seasonId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('standings')
        .select(
          `
          id,
          position,
          team_id,
          team:teams(name),
          played,
          won,
          drawn,
          lost,
          points_for,
          points_against,
          points
        `
        )
        .eq('season_id', seasonId)
        .order('position', { ascending: true });
      if (err) throw err;
      const raw = (data ?? []) as StandingsRow[];
      setRows(
        raw.map((r) => ({
          id: r.id,
          position: r.position,
          team_id: r.team_id,
          team_name: r.team?.name ?? '—',
          played: r.played,
          won: r.won,
          drawn: r.drawn,
          lost: r.lost,
          points_for: r.points_for,
          points_against: r.points_against,
          points: r.points,
          form: '', // filled by useStandingsWithForm or caller
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load standings');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { rows, loading, error, refetch: fetch };
}
