import { supabase } from '../lib/supabase';
import { logAdminAction } from './audit';
import type { LineupRow } from '../types/lineup';

/**
 * Publish team sheet: replace match_lineups for (match_id, team_id), then log with before/after to audit_log.
 * Caller must be club_admin for that team's club (RLS enforced).
 * File: services/lineup.ts
 */
export async function publishLineup(
  matchId: string,
  teamId: string,
  rows: LineupRow[],
  actorId: string
): Promise<{ error: Error | null }> {
  const { data: existing } = await supabase
    .from('match_lineups')
    .select('id, shirt_number, position, player_name, sort_order')
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .order('sort_order');
  const oldData = existing ?? [];

  const { error: deleteErr } = await supabase
    .from('match_lineups')
    .delete()
    .eq('match_id', matchId)
    .eq('team_id', teamId);
  if (deleteErr) return { error: deleteErr as Error };

  if (rows.length > 0) {
    const inserts = rows.map((r) => ({
      match_id: matchId,
      team_id: teamId,
      shirt_number: r.shirt_number,
      position: r.position || null,
      player_name: r.player_name || null,
      sort_order: r.sort_order,
    }));
    const { error: insertErr } = await (supabase.from('match_lineups') as any).insert(inserts);
    if (insertErr) return { error: insertErr as Error };
  }

  const { error: auditErr } = await logAdminAction(
    actorId,
    'lineup_published',
    'match_lineups',
    matchId,
    {
      old_data: { team_id: teamId, previous_slots: oldData },
      new_data: {
        match_id: matchId,
        team_id: teamId,
        published_at: new Date().toISOString(),
        slot_count: rows.length,
        slots: rows.map((r) => ({ shirt_number: r.shirt_number, position: r.position, player_name: r.player_name })),
      },
    }
  );
  if (auditErr) return { error: auditErr as Error };

  return { error: null };
}
