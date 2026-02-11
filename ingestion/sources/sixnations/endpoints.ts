/**
 * Six Nations OVAL API endpoints. Identity is source + source_ref (compId:seasonId[:stageId]).
 * File: ingestion/sources/sixnations/endpoints.ts
 */

export const OVAL_BASE = 'https://oval.sixnationsrugby.com';

export function standingsUrl(compId: number, seasonId: string): string {
  return `${OVAL_BASE}/rugby/v1/standing/search?compId=${compId}&seasonId=${seasonId}`;
}

/** Fixtures/results: common OVAL pattern; adjust if discovered from network traffic. */
export function fixturesUrl(compId: number, seasonId: string): string {
  return `${OVAL_BASE}/rugby/v1/fixture/search?compId=${compId}&seasonId=${seasonId}`;
}

export function sourceRef(compId: number, seasonId: string, stageId?: string): string {
  return stageId ? `${compId}:${seasonId}:${stageId}` : `${compId}:${seasonId}`;
}
