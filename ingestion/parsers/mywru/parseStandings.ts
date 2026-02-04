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

/** Defensive: ensure we have an array of row-like objects. */
function extractRows(rawJson: unknown): Record<string, unknown>[] {
  if (rawJson == null || typeof rawJson !== 'object') return [];
  const o = rawJson as Record<string, unknown>;
  const list =
    o.standings ??
    o.table ??
    o.rows ??
    o.teams ??
    (Array.isArray(o) ? o : (o.data as unknown));
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
      safeStr(r.team_name ?? r.teamName ?? r.name ?? r.team).trim() ||
      safeStr(r.title).trim();
    if (!team_name) continue;

    out.push({
      competition_group_id,
      team_name,
      played: safeNum(r.played ?? r.games_played ?? r.p) ?? null,
      won: safeNum(r.won ?? r.w ?? r.wins) ?? null,
      drawn: safeNum(r.drawn ?? r.d ?? r.draws) ?? null,
      lost: safeNum(r.lost ?? r.l ?? r.losses) ?? null,
      points_for: safeNum(r.points_for ?? r.pf ?? r.pointsFor ?? r.for) ?? null,
      points_against:
        safeNum(r.points_against ?? r.pa ?? r.pointsAgainst ?? r.against) ?? null,
      table_points:
        safeNum(r.table_points ?? r.points ?? r.pts ?? r.total_points) ?? null,
      position: safeNum(r.position ?? r.pos ?? r.rank ?? r.place ?? (i + 1)) ?? null,
    });
  }

  return out;
}
