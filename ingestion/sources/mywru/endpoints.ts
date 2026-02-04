/**
 * MyWRU endpoint registry. Functions return paths only (no base URL).
 * Based on observed Fetch/XHR patterns; paths may need validation against live traffic.
 * File: ingestion/sources/mywru/endpoints.ts
 */

/** Optional date filters for fixtures/results. */
export type DateFilters = {
  from?: string; // ISO date or YYYY-MM-DD
  to?: string;
};

const BASE = '/fixtures-results/competition';

/**
 * Path to competition groups for a given competition instance.
 * TODO: Discover exact path from XHR (e.g. /groups, /divisions, or embedded in overview).
 */
export function competitionGroups(competitionInstanceId: number): string {
  return `${BASE}/${competitionInstanceId}/groups`;
}

/**
 * Path to competition overview/details (known from config: .../competition/{id}/overview).
 */
export function competitionDetails(competitionInstanceId: number): string {
  return `${BASE}/${competitionInstanceId}/overview`;
}

/**
 * Path to league table for a competition group.
 * TODO: Discover exact path from XHR (e.g. .../group/{id}/table or .../group/{id}/standings).
 */
export function competitionGroupLeagueTable(competitionGroupId: number): string {
  return `${BASE}/group/${competitionGroupId}/table`;
}

/**
 * Path to fixtures for a competition group. Optional date filters appended as query string when present.
 * TODO: Discover exact path and query param names from XHR if different (e.g. fixture-list, dateFrom/dateTo).
 */
export function competitionGroupFixtures(
  competitionGroupId: number,
  dateFilters?: DateFilters
): string {
  const path = `${BASE}/group/${competitionGroupId}/fixtures`;
  return appendDateFilters(path, dateFilters);
}

/**
 * Path to results for a competition group. Optional date filters appended as query string when present.
 * TODO: Discover exact path and query param names from XHR if different.
 */
export function competitionGroupResults(
  competitionGroupId: number,
  dateFilters?: DateFilters
): string {
  const path = `${BASE}/group/${competitionGroupId}/results`;
  return appendDateFilters(path, dateFilters);
}

function appendDateFilters(path: string, filters?: DateFilters): string {
  if (!filters?.from && !filters?.to) return path;
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
