import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { LineupRow } from '../../types/lineup';

type LineupDbRow = {
  id: string;
  shirt_number: number;
  position: string | null;
  player_name: string | null;
  sort_order: number;
};

/**
 * Fetch match_lineups for (match_id, team_id). Used by team sheet builder.
 * File: features/lineup/useMatchLineups.ts
 */
export function useMatchLineups(
  matchId: string | undefined,
  teamId: string | undefined
): {
  rows: LineupRow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [rows, setRows] = useState<LineupRow[]>([]);
  const [loading, setLoading] = useState(!!(matchId && teamId));
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!matchId || !teamId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('match_lineups')
        .select('id, shirt_number, position, player_name, sort_order')
        .eq('match_id', matchId)
        .eq('team_id', teamId)
        .order('sort_order', { ascending: true });
      if (err) throw err;
      const raw = (data ?? []) as LineupDbRow[];
      setRows(
        raw.map((r) => ({
          shirt_number: r.shirt_number,
          position: r.position ?? '',
          player_name: r.player_name ?? '',
          sort_order: r.sort_order,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lineup');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [matchId, teamId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { rows, loading, error, refetch: fetch };
}
