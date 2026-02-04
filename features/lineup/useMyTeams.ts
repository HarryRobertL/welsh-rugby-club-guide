import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';

export type TeamOption = {
  id: string;
  name: string;
  club_id: string;
};

/**
 * Teams for the current club_admin (profile.club_id). Empty if not club_admin or no club.
 * File: features/lineup/useMyTeams.ts
 */
export function useMyTeams(): {
  teams: TeamOption[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { profile } = useAuth();
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!profile?.club_id || profile.role !== 'club_admin') {
      setTeams([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('teams')
        .select('id, name, club_id')
        .eq('club_id', profile.club_id)
        .order('name', { ascending: true });
      if (err) throw err;
      setTeams((data ?? []) as TeamOption[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load teams');
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.club_id, profile?.role]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { teams, loading, error, refetch: fetch };
}
