/**
 * Normalized shapes and parser meta for MyWRU parsers.
 * File: ingestion/parsers/mywru/types.ts
 */

export type ParserMeta = {
  competition_group_id: string;
  competition_instance_id?: string;
};

export type NormalizedStandingRow = {
  competition_group_id: string;
  team_name: string;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  points_for: number | null;
  points_against: number | null;
  table_points: number | null;
  position: number | null;
};

export type MatchStatus =
  | 'scheduled'
  | 'live'
  | 'full_time'
  | 'postponed'
  | 'cancelled'
  | 'unknown';

export type NormalizedMatchRow = {
  competition_group_id: string;
  source_match_ref: string;
  kickoff_at: string | null;
  home_team_name: string;
  away_team_name: string;
  venue_name: string | null;
  status: MatchStatus;
  score_home: number | null;
  score_away: number | null;
  round_label: string | null;
};
