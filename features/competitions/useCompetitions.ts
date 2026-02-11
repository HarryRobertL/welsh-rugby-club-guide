import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Competition } from '../../types/competitions';

const SOURCE_PRIORITY: Record<string, number> = {
  mywru: 1,
  sixnations: 2,
  allwalessport: 3,
};

/** Six Nations competition IDs to hide from the list (keep 37afe6e1-978c-4f3d-8dfa-c757a18bc3f5 visible). */
const HIDDEN_COMPETITION_IDS = new Set([
  '271e39f0-75a0-4688-a0fa-1c842409d81d',
  '46ca99b4-b1f0-421b-96c4-0e81ece7343d',
]);

function isWruControlledLeagueName(name: string | null | undefined): boolean {
  const n = (name ?? '').toLowerCase().trim();
  if (!n) return false;
  if (n.includes('bucs')) return false;
  const patterns = [
    'welsh national league',
    'welsh national leagues',
    'welsh regional',
    'wru',
    'cardiff rugby',
    'dragons',
    'ospreys',
    'blues',
    'scarlets',
    'east wales',
    'west wales',
    'north wales',
    'central wales',
    'east central',
    'west central',
    'division ',
    'premiership',
    'championship',
    'regional age grade',
    'age grade',
    'u12',
    'u13',
    'u14',
    'u15',
    'u16',
  ];
  return patterns.some((p) => n.includes(p));
}

/**
 * Fetches competitions list. No cross-source dedupe: WRU leagues use MyWRU data only.
 * Source priority: mywru > sixnations > allwalessport. Order by that then name.
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
        .from('competitions_deduped')
        .select('id, name, slug, competition_type, source, source_ref')
        .order('name', { ascending: true });
      if (err) throw err;
      const raw = (data ?? []) as Competition[];
      const filtered = raw.filter(
        (c) =>
          !HIDDEN_COMPETITION_IDS.has(c.id) &&
          !(c.source === 'allwalessport' && isWruControlledLeagueName(c.name))
      );
      const sorted = [...filtered].sort((a, b) => {
        const pa = SOURCE_PRIORITY[a.source ?? ''] ?? 4;
        const pb = SOURCE_PRIORITY[b.source ?? ''] ?? 4;
        if (pa !== pb) return pa - pb;
        return (a.name ?? '').localeCompare(b.name ?? '');
      });
      setCompetitions(sorted);
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
