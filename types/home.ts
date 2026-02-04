/**
 * Home screen data types. Fixtures/matches with joined team and venue names.
 * File: types/home.ts — view models for Home tab.
 */

export type FavouriteTeam = {
  id: string;
  entity_id: string; // team id
};

export type UpcomingFixture = {
  id: string;
  scheduled_at: string;
  home_team_name: string;
  away_team_name: string;
  venue_name: string | null;
};

export type LiveMatch = {
  id: string;
  fixture_id: string;
  scheduled_at: string;
  home_team_name: string;
  away_team_name: string;
  venue_name: string | null;
  score_home: number;
  score_away: number;
};
