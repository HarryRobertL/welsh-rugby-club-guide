/**
 * Live match event types for admin console.
 * File: types/live-events.ts
 */

export type LiveEventType =
  | 'try'
  | 'conversion'
  | 'penalty_goal'
  | 'yellow_card'
  | 'red_card'
  | 'other';

export type TeamSide = 'home' | 'away';

export type LiveEventPayload = {
  team_side: TeamSide;
  minute?: number;
  player_name?: string;
  card_type?: 'yellow' | 'red';
  substitution?: { off?: string; on?: string };
  [key: string]: unknown;
};

export type MatchEventRow = {
  id: string;
  match_id: string;
  event_type: string;
  minute: number | null;
  payload: LiveEventPayload | null;
  created_at: string;
};

/** Points per event type for auto score update */
export const EVENT_POINTS: Record<string, number> = {
  try: 5,
  conversion: 2,
  penalty_goal: 3,
  drop_goal: 3,
  penalty_try: 7,
};
