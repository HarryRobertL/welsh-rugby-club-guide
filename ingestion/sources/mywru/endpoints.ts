/**
 * MyWRU endpoint registry. Functions return paths only (no base URL).
 * Based on observed Fetch/XHR patterns; paths may need validation against live traffic.
 * File: ingestion/sources/mywru/endpoints.ts
 */

/** Optional filters for fixtures/results. */
export type FixturesFilters = {
  upcoming?: boolean;
  organisationId?: number;
  competitionPoolId?: number;
  page?: number;
};

const BASE = '/fixtures-results';

/** Active competitions list (competition instances). */
export function activeCompetitions(): string {
  return `${BASE}/active-competitions`;
}

/**
 * Path to competition groups for a given competition instance.
 * TODO: Discover exact path from XHR (e.g. /groups, /divisions, or embedded in overview).
 */
export function competitionGroups(competitionInstanceId: number): string {
  return `${BASE}/competition-groups?competitionInstanceId=${competitionInstanceId}`;
}

/**
 * Path to competition overview/details (known from config: .../competition/{id}/overview).
 */
export function competitionDetails(competitionInstanceId: number): string {
  return `${BASE}/competition/${competitionInstanceId}/overview`;
}

/**
 * Path to league table for a competition group.
 * TODO: Discover exact path from XHR (e.g. .../group/{id}/table or .../group/{id}/standings).
 */
export function competitionGroupLeagueTable(competitionGroupId: number): string {
  return `${BASE}/competition-group-league-tables?competitionGroupId=${competitionGroupId}`;
}

/**
 * Path to fixtures for a competition group. Optional date filters appended as query string when present.
 * TODO: Discover exact path and query param names from XHR if different (e.g. fixture-list, dateFrom/dateTo).
 */
export function competitionGroupFixtures(
  competitionGroupId: number,
  filters?: FixturesFilters
): string {
  const params = new URLSearchParams({
    competitionGroupId: String(competitionGroupId),
    upcoming: String(filters?.upcoming ?? true),
  });
  if (filters?.organisationId != null) params.set('organisationId', String(filters.organisationId));
  if (filters?.competitionPoolId != null) params.set('competitionPoolId', String(filters.competitionPoolId));
  if (filters?.page != null) params.set('page', String(filters.page));
  return `${BASE}/competition-fixtures?${params.toString()}`;
}

/**
 * Path to results for a competition group. Optional date filters appended as query string when present.
 * TODO: Discover exact path and query param names from XHR if different.
 */
export function competitionGroupResults(
  competitionGroupId: number,
  filters?: FixturesFilters
): string {
  return competitionGroupFixtures(competitionGroupId, { ...filters, upcoming: false });
}

/** Pool metadata for a competition group. */
export function competitionGroupPools(competitionGroupId: number): string {
  return `${BASE}/competition-group-pools?competitionGroupId=${competitionGroupId}`;
}

/**
 * Knockout/cup fixtures for a competition group and round (from WRU app network: cup competitions use this).
 * Example: competitionGroupId=662, roundId=1 for round 1.
 */
export function competitionKnockoutFixtures(
  competitionGroupId: number,
  roundId: number,
  page = 1
): string {
  const params = new URLSearchParams({
    competitionGroupId: String(competitionGroupId),
    page: String(page),
    roundId: String(roundId),
  });
  return `${BASE}/competition-knockout-fixtures?${params.toString()}`;
}

/** Organisations/teams for a competition group. */
export function competitionGroupOrganisations(competitionGroupId: number): string {
  const params = new URLSearchParams({ competitionGroupId: String(competitionGroupId) });
  return `${BASE}/competition-organisations?${params.toString()}`;
}
