import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { FormResult } from '../../types/competitions';

const FORM_LIMIT = 5;

type FixtureRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  scheduled_at: string;
  matches: { score_home: number; score_away: number }[] | null;
};

export async function getTeamForm(teamId: string): Promise<string> {
  const { data: homeData, error: homeErr } = await supabase
    .from('fixtures')
    .select('id, home_team_id, away_team_id, scheduled_at, matches(score_home, score_away)')
    .eq('home_team_id', teamId)
    .eq('status', 'full_time')
    .order('scheduled_at', { ascending: false })
    .limit(FORM_LIMIT);
  if (homeErr) return '';

  const { data: awayData, error: awayErr } = await supabase
    .from('fixtures')
    .select('id, home_team_id, away_team_id, scheduled_at, matches(score_home, score_away)')
    .eq('away_team_id', teamId)
    .eq('status', 'full_time')
    .order('scheduled_at', { ascending: false })
    .limit(FORM_LIMIT);
  if (awayErr) return '';

  const homeRows = (homeData ?? []) as FixtureRow[];
  const awayRows = (awayData ?? []) as FixtureRow[];
  const combined = [...homeRows, ...awayRows]
    .map((row) => ({
      scheduled_at: row.scheduled_at,
      isHome: row.home_team_id === teamId,
      scoreHome: row.matches?.[0]?.score_home ?? 0,
      scoreAway: row.matches?.[0]?.score_away ?? 0,
    }))
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
    .slice(0, FORM_LIMIT);

  const results: FormResult[] = combined.map(({ isHome, scoreHome, scoreAway }) => {
    const our = isHome ? scoreHome : scoreAway;
    const their = isHome ? scoreAway : scoreHome;
    if (our > their) return 'W';
    if (our < their) return 'L';
    return 'D';
  });
  return results.join(' ');
}

/**
 * Fetches team form: last 5 full_time fixtures for the team; returns W/D/L string.
 * File: features/competitions/useTeamForm.ts — form derived from fixtures + matches.
 */
export function useTeamForm(teamId: string | undefined): {
  form: string;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [form, setForm] = useState('');
  const [loading, setLoading] = useState(!!teamId);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!teamId) {
      setForm('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setForm(await getTeamForm(teamId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load form');
      setForm('');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { form, loading, error, refetch: fetch };
}
