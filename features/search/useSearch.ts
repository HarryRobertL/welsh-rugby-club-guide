import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const DEBOUNCE_MS = 300;
const LIMIT = 20;

export type SearchCompetition = { id: string; name: string; slug: string };
export type SearchTeam = { id: string; name: string };

export function useSearch(query: string): {
  competitions: SearchCompetition[];
  teams: SearchTeam[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [competitions, setCompetitions] = useState<SearchCompetition[]>([]);
  const [teams, setTeams] = useState<SearchTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setCompetitions([]);
      setTeams([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pattern = `%${trimmed}%`;
      const [compRes, teamsRes] = await Promise.all([
        supabase
          .from('competitions_deduped')
          .select('id, name, slug')
          .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
          .limit(LIMIT),
        supabase
          .from('teams_search_deduped')
          .select('id, name')
          .or(`name.ilike.${pattern},search_key.ilike.${pattern}`)
          .limit(LIMIT),
      ]);
      if (compRes.error) throw compRes.error;
      if (teamsRes.error) throw teamsRes.error;
      setCompetitions((compRes.data ?? []) as SearchCompetition[]);
      setTeams((teamsRes.data ?? []) as SearchTeam[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setCompetitions([]);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, search]);

  const refetch = useCallback(async () => {
    await search(query);
  }, [query, search]);

  return { competitions, teams, loading, error, refetch };
}
