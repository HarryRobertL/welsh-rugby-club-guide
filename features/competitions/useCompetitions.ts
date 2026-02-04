import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Competition } from '../../types/competitions';

/**
 * Fetches competitions list. Static fetch.
 * File: features/competitions/useCompetitions.ts
 */
export function useCompetitions(): {
  competitions: Competition[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('competitions')
        .select('id, name, slug, competition_type')
        .order('name', { ascending: true });
      if (err) throw err;
      setCompetitions((data ?? []) as Competition[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load competitions');
      setCompetitions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { competitions, loading, error, refetch: fetch };
}
