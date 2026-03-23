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

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

function normalizeCompetitionName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeCompetitionSlug(slug: string | null | undefined): string {
  return (slug ?? '').trim().toLowerCase();
}

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
      const mywruSlugSet = new Set(
        raw
          .filter((c) => c.source === 'mywru')
          .map((c) => normalizeCompetitionSlug(c.slug))
          .filter(Boolean)
      );
      const mywruNameSet = new Set(
        raw
          .filter((c) => c.source === 'mywru')
          .map((c) => normalizeCompetitionName(c.name))
          .filter(Boolean)
      );

      const filtered = raw.filter(
        (c) => {
          if (HIDDEN_COMPETITION_IDS.has(c.id)) return false;

          if (c.competition_type === 'university') return true;
          if (c.source === 'mywru') return true;

          if (c.source === 'allwalessport') {
            const slugKey = normalizeCompetitionSlug(c.slug);
            const nameKey = normalizeCompetitionName(c.name);
            const duplicatesMyWru =
              (slugKey && mywruSlugSet.has(slugKey)) ||
              (nameKey && mywruNameSet.has(nameKey));

            if (duplicatesMyWru) return false;

            // Heuristic now acts as fallback signal only, not source-selection logic.
            if (isDev && isWruControlledLeagueName(c.name)) {
              console.warn('[competitions] allwalessport WRU-like competition survived deterministic filter', {
                id: c.id,
                name: c.name,
                slug: c.slug,
                source: c.source,
                competition_type: c.competition_type,
              });
            }
          }

          return true;
        }
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
