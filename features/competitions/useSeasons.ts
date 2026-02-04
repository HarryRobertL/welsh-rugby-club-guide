import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Season } from '../../types/competitions';

/**
 * Fetches seasons for a competition. Static fetch.
 * File: features/competitions/useSeasons.ts
 */
export function useSeasons(competitionId: string | undefined): {
  seasons: Season[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(!!competitionId);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!competitionId) {
      setSeasons([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('seasons')
        .select('id, competition_id, name, start_date, end_date')
        .eq('competition_id', competitionId)
        .order('start_date', { ascending: false });
      if (err) throw err;
      setSeasons((data ?? []) as Season[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load seasons');
      setSeasons([]);
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { seasons, loading, error, refetch: fetch };
}
