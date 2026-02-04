import { supabase } from '../lib/supabase';

/**
 * Submit a match dispute. No moderation logic yet; stored for later review.
 * File: services/disputes.ts
 */
export async function submitMatchDispute(
  matchId: string,
  userId: string,
  reason: string
): Promise<{ error: Error | null }> {
  const trimmed = reason.trim();
  if (!trimmed) return { error: new Error('Please provide a reason') };
  const { error } = await (supabase.from('match_disputes') as any).insert({
    match_id: matchId,
    submitted_by: userId,
    reason: trimmed,
    status: 'open',
  });
  return { error: error as Error | null };
}
