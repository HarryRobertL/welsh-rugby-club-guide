import { supabase } from '../lib/supabase';
import { logAdminAction } from './audit';
import { EVENT_POINTS, type LiveEventPayload, type LiveEventType } from '../types/live-events';

type MatchRow = { id: string; score_home: number; score_away: number };

/**
 * Add live event: insert match_events, then update match score if scoring event.
 * Caller must be club_admin for that match (RLS enforced). Logs admin action with before/after.
 */
export async function addLiveEvent(
  matchId: string,
  eventType: LiveEventType,
  payload: LiveEventPayload,
  actorId: string
): Promise<{ error: Error | null }> {
  const points = EVENT_POINTS[eventType] ?? 0;
  const minute = payload.minute ?? null;

  const { error: insertErr } = await (supabase.from('match_events') as any).insert({
    match_id: matchId,
    event_type: eventType,
    minute,
    payload: payload as Record<string, unknown>,
  });
  if (insertErr) return { error: insertErr as Error };

  if (points > 0 && payload.team_side) {
    const { data: match, error: fetchErr } = await supabase
      .from('matches')
      .select('id, score_home, score_away')
      .eq('id', matchId)
      .single();
    if (fetchErr) return { error: fetchErr as Error };
    const row = match as MatchRow | null;
    if (row) {
      const newScoreHome = payload.team_side === 'home' ? row.score_home + points : row.score_home;
      const newScoreAway = payload.team_side === 'away' ? row.score_away + points : row.score_away;
      const { error: updateErr } = await (supabase.from('matches') as any)
        .update({ score_home: newScoreHome, score_away: newScoreAway })
        .eq('id', matchId);
      if (updateErr) return { error: updateErr as Error };
      await logAdminAction(actorId, 'score_update', 'matches', matchId, {
        old_data: { score_home: row.score_home, score_away: row.score_away },
        new_data: { score_home: newScoreHome, score_away: newScoreAway, event_type: eventType, minute },
      });
    }
  }

  return { error: null };
}

/**
 * Undo last event: fetch last event for match, revert score if scoring event, delete event. Logs with before/after.
 */
export async function undoLastEvent(matchId: string, actorId: string): Promise<{ error: Error | null }> {
  const { data: events, error: fetchErr } = await supabase
    .from('match_events')
    .select('id, event_type, payload')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (fetchErr) return { error: fetchErr as Error };
  const last = events?.[0] as { id: string; event_type: string; payload: LiveEventPayload | null } | undefined;
  if (!last) return { error: null };

  const points = EVENT_POINTS[last.event_type] ?? 0;
  const payload = last.payload as LiveEventPayload | null;
  const teamSide = payload?.team_side;

  let oldScoreHome: number | undefined;
  let oldScoreAway: number | undefined;
  let newScoreHome: number | undefined;
  let newScoreAway: number | undefined;

  if (points > 0 && teamSide) {
    const { data: match, error: matchErr } = await supabase
      .from('matches')
      .select('id, score_home, score_away')
      .eq('id', matchId)
      .single();
    if (matchErr) return { error: matchErr as Error };
    const row = match as MatchRow | null;
    if (row) {
      oldScoreHome = row.score_home;
      oldScoreAway = row.score_away;
      newScoreHome = teamSide === 'home' ? Math.max(0, row.score_home - points) : row.score_home;
      newScoreAway = teamSide === 'away' ? Math.max(0, row.score_away - points) : row.score_away;
      const { error: updateErr } = await (supabase.from('matches') as any)
        .update({ score_home: newScoreHome, score_away: newScoreAway })
        .eq('id', matchId);
      if (updateErr) return { error: updateErr as Error };
    }
  }

  const { error: deleteErr } = await supabase.from('match_events').delete().eq('id', last.id);
  if (deleteErr) return { error: deleteErr as Error };

  if (oldScoreHome != null && newScoreHome != null && oldScoreAway != null && newScoreAway != null) {
    await logAdminAction(actorId, 'event_undo', 'matches', matchId, {
      old_data: { score_home: oldScoreHome, score_away: oldScoreAway, undone_event: last.event_type },
      new_data: { score_home: newScoreHome, score_away: newScoreAway },
    });
  }

  return { error: null };
}

/**
 * Set match and fixture to full_time. Caller must be club_admin for that match (RLS enforced). Logs with before/after.
 */
export async function setMatchFullTime(matchId: string, actorId: string): Promise<{ error: Error | null }> {
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('id, fixture_id, status, score_home, score_away')
    .eq('id', matchId)
    .single();
  if (matchErr || !match) return { error: (matchErr as Error) ?? new Error('Match not found') };
  const row = match as { fixture_id: string; status: string; score_home: number; score_away: number };
  const fixtureId = row.fixture_id;

  const { error: updateMatchErr } = await (supabase.from('matches') as any)
    .update({ status: 'full_time', ended_at: new Date().toISOString() })
    .eq('id', matchId);
  if (updateMatchErr) return { error: updateMatchErr as Error };

  const { error: updateFixtureErr } = await (supabase.from('fixtures') as any)
    .update({ status: 'full_time' })
    .eq('id', fixtureId);
  if (updateFixtureErr) return { error: updateFixtureErr as Error };

  await logAdminAction(actorId, 'match_full_time', 'matches', matchId, {
    old_data: { status: row.status, score_home: row.score_home, score_away: row.score_away },
    new_data: { status: 'full_time', ended_at: new Date().toISOString() },
  });

  return { error: null };
}
