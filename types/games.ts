/**
 * Fixtures list and match centre types.
 * File: types/games.ts — view models for Games tab.
 */

export type FixtureStatus = 'scheduled' | 'live' | 'full_time' | 'postponed' | 'cancelled';

export type FixtureListItem = {
  id: string;
  scheduled_at: string;
  status: FixtureStatus;
  home_team_name: string;
  away_team_name: string;
  venue_name: string | null;
  score_home: number | null;
  score_away: number | null;
};

export type MatchCentre = {
  id: string;
  fixture_id: string;
  match_id: string | null;
  scheduled_at: string;
  status: FixtureStatus;
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  away_team_name: string;
  venue_name: string | null;
  venue_address: string | null;
  score_home: number;
  score_away: number;
};
