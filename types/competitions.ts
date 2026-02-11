/**
 * Competitions, seasons, league table and team form types.
 * File: types/competitions.ts — view models for Competitions tab; data from standings.
 */

export type Competition = {
  id: string;
  name: string;
  slug: string;
  competition_type: string;
  source?: string | null;
  source_ref?: string | null;
};

export type Season = {
  id: string;
  competition_id: string;
  name: string;
  start_date: string;
  end_date: string;
};

export type LeagueTableRow = {
  id: string;
  position: number;
  team_id: string;
  team_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points_for: number;
  points_against: number;
  points: number;
  form: string; // e.g. "W W L D W" (last 5)
};

export type FormResult = 'W' | 'D' | 'L';

export type CompetitionCounts = {
  fixtures: number;
  standings: number;
};

export type CompetitionNode = {
  id: string;
  name: string;
  slug: string;
  counts: CompetitionCounts;
  seasonId?: string;
};

export type CategoryNodeChild = {
  name: string;
  slug: string;
  competition?: CompetitionNode;
};

export type CategoryNode = {
  name: string;
  slug: string;
  children: CategoryNodeChild[];
  counts: {
    competitions: number;
    fixtures: number;
    standings: number;
  };
};
