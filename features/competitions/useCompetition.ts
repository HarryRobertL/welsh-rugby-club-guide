import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Competition } from '../../types/competitions';

/**
 * Fetches a single competition by id. Used for detail screen title (competitions.name, never season/group id).
 */
export function useCompetition(competitionId: string | undefined): {
  competition: Competition | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(!!competitionId);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!competitionId) {
      setCompetition(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('competitions')
        .select('id, name, slug, competition_type, source, source_ref')
        .eq('id', competitionId)
        .maybeSingle();
      if (err) throw err;
      setCompetition((data ?? null) as Competition | null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load competition');
      setCompetition(null);
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { competition, loading, error, refetch: fetch };
}
