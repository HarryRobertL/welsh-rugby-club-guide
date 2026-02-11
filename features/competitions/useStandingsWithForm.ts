import { useCallback, useEffect, useState } from 'react';
import { getTeamForm } from './useTeamForm';
import { useStandings } from './useStandings';
import type { LeagueTableRow } from '../../types/competitions';

/**
 * Standings for a season with team form (last 5) filled in. League table sorted by position.
 * File: features/competitions/useStandingsWithForm.ts — standings + form for table view.
 */
export function useStandingsWithForm(seasonId: string | undefined): {
  rows: LeagueTableRow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { rows: baseRows, loading: standingsLoading, error: standingsError, refetch: refetchStandings } = useStandings(seasonId);
  const [rows, setRows] = useState<LeagueTableRow[]>([]);
  const [formLoading, setFormLoading] = useState(false);

  const FORM_FETCH_MAX = 20;

  const loadForms = useCallback(async (standingsRows: LeagueTableRow[]) => {
    if (standingsRows.length === 0) {
      setRows(standingsRows);
      return;
    }
    setFormLoading(true);
    try {
      const slice = standingsRows.slice(0, FORM_FETCH_MAX);
      const forms = await Promise.all(slice.map((r) => getTeamForm(r.team_id)));
      setRows(
        standingsRows.map((r, i) => ({
          ...r,
          form: i < slice.length ? (forms[i] ?? '') : '',
        }))
      );
    } catch {
      setRows(standingsRows);
    } finally {
      setFormLoading(false);
    }
  }, []);

  useEffect(() => {
    if (standingsLoading || standingsError) {
      setRows([]);
      return;
    }
    setRows(baseRows);
    loadForms(baseRows);
  }, [baseRows, standingsLoading, standingsError, loadForms]);

  return {
    rows,
    loading: standingsLoading || formLoading,
    error: standingsError,
    refetch: refetchStandings,
  };
}
