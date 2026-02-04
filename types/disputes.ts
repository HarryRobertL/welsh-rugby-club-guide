/**
 * Match dispute types. No moderation logic yet.
 * File: types/disputes.ts
 */

export type DisputeStatus = 'open' | 'resolved';

export type MatchDisputeRow = {
  id: string;
  match_id: string;
  submitted_by: string;
  reason: string;
  status: DisputeStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};
