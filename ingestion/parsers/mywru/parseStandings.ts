/**
 * Parse MyWRU standings/league table JSON into normalized rows.
 * File: ingestion/parsers/mywru/parseStandings.ts
 */

import type { ParserMeta, NormalizedStandingRow } from './types';

function safeNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function safeStr(v: unknown): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

function safeTeamName(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return safeTeamName(v[0]);
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const name =
      o.name ??
      o.organisationName ??
      o.teamName ??
      o.team_label ??
      o.teamLabel ??
      o.clubName ??
      o.shortName ??
      o.label ??
      o.title;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return '';
}

/**
 * API shape: competition-group-league-tables returns an array of pool blocks:
 * [ { leagueDetails: {...}, standings: [{ position, teamName, played, wins, ... }] }, ... ]
 * Flatten to a single array of row-like objects for parsing.
 */
function extractRows(rawJson: unknown): Record<string, unknown>[] {
  if (rawJson == null || typeof rawJson !== 'object') return [];
  const o = rawJson as Record<string, unknown>;

  if (Array.isArray(o)) {
    const rows: Record<string, unknown>[] = [];
    for (const item of o) {
      if (item != null && typeof item === 'object' && Array.isArray((item as Record<string, unknown>).standings)) {
        rows.push(...((item as Record<string, unknown>).standings as Record<string, unknown>[]));
      }
    }
    return rows.filter((r) => r != null && typeof r === 'object');
  }

  const list =
    o.standings ??
    o.table ??
    o.rows ??
    o.teams ??
    (o.data as unknown);
  if (!Array.isArray(list)) return [];
  return list.filter((r): r is Record<string, unknown> => r != null && typeof r === 'object');
}

export function parseStandings(
  rawJson: unknown,
  meta: ParserMeta
): NormalizedStandingRow[] {
  const { competition_group_id } = meta;
  const rows = extractRows(rawJson);
  const out: NormalizedStandingRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const team_name =
      safeTeamName(
        r.team_name ??
          r.teamName ??
          r.name ??
          r.team ??
          r.teamLabel ??
          r.organisationName ??
          r.clubName ??
          r.team_label
      ).trim() || safeTeamName(r.title).trim();
    if (!team_name) continue;

    out.push({
      competition_group_id,
      team_name,
      played: safeNum(r.played ?? r.games_played ?? r.p ?? r.playedGames) ?? null,
      won: safeNum(r.won ?? r.w ?? r.wins) ?? null,
      drawn: safeNum(r.drawn ?? r.d ?? r.draws) ?? null,
      lost: safeNum(r.lost ?? r.l ?? r.losses) ?? null,
      points_for: safeNum(r.points_for ?? r.pf ?? r.pointsFor ?? r.for ?? r.pointsForScored) ?? null,
      points_against:
        safeNum(r.points_against ?? r.pa ?? r.pointsAgainst ?? r.against ?? r.pointsAgainstScored) ?? null,
      table_points:
        safeNum(r.table_points ?? r.points ?? r.pts ?? r.total_points ?? r.leaguePoints) ?? null,
      position: safeNum(r.position ?? r.pos ?? r.rank ?? r.place ?? r.positionNumber ?? (i + 1)) ?? null,
    });
  }

  return out;
}
