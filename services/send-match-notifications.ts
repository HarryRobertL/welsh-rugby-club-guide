import { supabase } from '../lib/supabase';

export type MatchNotificationEvent = 'lineup_published' | 'score_change' | 'full_time';

export type SendMatchNotificationPayload = {
  event: MatchNotificationEvent;
  fixture_id: string;
  match_id?: string;
  score_home?: number;
  score_away?: number;
  home_team_name?: string;
  away_team_name?: string;
  team_name?: string;
};

/**
 * Invokes the send-match-notifications Edge Function to push to users who favourited this fixture/teams.
 * Respects user notification preferences; Edge Function has TODO for quiet hours.
 * File: services/send-match-notifications.ts
 */
export async function sendMatchNotification(
  payload: SendMatchNotificationPayload
): Promise<{ error: Error | null }> {
  const { error } = await supabase.functions.invoke('send-match-notifications', {
    body: payload,
  });
  return { error: error as Error | null };
}
