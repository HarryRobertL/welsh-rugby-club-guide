/**
 * Parse MyWRU fixtures JSON into normalized match rows.
 * File: ingestion/parsers/mywru/parseFixtures.ts
 */

import { createHash } from 'crypto';
import type { ParserMeta, NormalizedMatchRow, MatchStatus } from './types';

function safeStr(v: unknown): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

function isBadTeamString(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return true;
  const lowered = trimmed.toLowerCase();
  return (
    lowered === '[object object]' ||
    lowered.includes('object object') ||
    lowered === 'null' ||
    lowered === 'undefined'
  );
}

function safeTeamName(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return safeTeamName(v[0]);
  if (typeof v === 'string') {
    const s = v.trim();
    return isBadTeamString(s) ? '' : s;
  }
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const name =
      o.name ??
      o.organisationName ??
      o.teamName ??
      o.clubName ??
      o.shortName ??
      o.label ??
      o.title;
    if (typeof name === 'string') {
      const s = name.trim();
      if (!isBadTeamString(s)) return s;
    }
  }
  return '';
}

function safeNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

const STATUS_MAP: Record<string, MatchStatus> = {
  scheduled: 'scheduled',
  live: 'live',
  'full_time': 'full_time',
  fulltime: 'full_time',
  postponed: 'postponed',
  cancelled: 'cancelled',
  unknown: 'unknown',
};

function normalizeStatus(v: unknown): MatchStatus {
  const s = safeStr(v).toLowerCase().replace(/\s+/g, '_');
  return STATUS_MAP[s] ?? 'unknown';
}

/** Deterministic ref when no stable id in payload. */
function hashMatchRef(
  competition_group_id: string,
  home: string,
  away: string,
  kickoff_at: string | null
): string {
  const payload = [competition_group_id, home, away, kickoff_at ?? ''].join('|');
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

/** Defensive: extract array of match-like objects. */
function extractMatches(rawJson: unknown): Record<string, unknown>[] {
  if (rawJson == null || typeof rawJson !== 'object') return [];
  const o = rawJson as Record<string, unknown>;
  const list =
    o.fixtures ??
    o.matches ??
    o.results ??
    o.games ??
    o.events ??
    (Array.isArray(o) ? o : (o.data as unknown));
  if (!Array.isArray(list)) return [];
  return list.filter((r): r is Record<string, unknown> => r != null && typeof r === 'object');
}

function toIsoLike(dateVal: unknown): string | null {
  if (dateVal == null) return null;
  if (typeof dateVal === 'string') return dateVal;
  if (typeof dateVal === 'number' && !Number.isNaN(dateVal)) {
    const d = new Date(dateVal);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

export function parseFixtures(
  rawJson: unknown,
  meta: ParserMeta
): NormalizedMatchRow[] {
  const { competition_group_id } = meta;
  const matches = extractMatches(rawJson);
  const out: NormalizedMatchRow[] = [];

  for (const m of matches) {
    const homeName = safeTeamName(
      m.home_team ??
        m.homeTeam ??
        m.home ??
        m.team_a ??
        m.homeTeamName ??
        m.home_team_name ??
        m.teamAName ??
        m.teamA
    );
    const awayName = safeTeamName(
      m.away_team ??
        m.awayTeam ??
        m.away ??
        m.team_b ??
        m.awayTeamName ??
        m.away_team_name ??
        m.teamBName ??
        m.teamB
    );
    if (!homeName && !awayName) continue;

    const kickoff_at = toIsoLike(
      m.kickoff ??
        m.kickoff_at ??
        m.date ??
        m.scheduled_at ??
        m.start ??
        m.kickoffDateTime ??
        m.kickoff_time ??
        m.fixtureDate
    );
    const stableId =
      m.id ?? m.match_id ?? m.fixture_id ?? m.event_id ?? m.external_id;
    const source_match_ref =
      stableId != null && String(stableId).trim()
        ? String(stableId).trim()
        : hashMatchRef(competition_group_id, homeName, awayName, kickoff_at);

    out.push({
      competition_group_id,
      source_match_ref,
      kickoff_at,
      home_team_name: homeName,
      away_team_name: awayName,
      venue_name: safeStr(m.venue ?? m.venue_name ?? m.venueName).trim() || null,
      status: normalizeStatus(m.status ?? m.state ?? m.match_status ?? m.fixtureStatus ?? m.resultStatus),
      score_home: safeNum(m.score_home ?? m.home_score ?? m.homeScore ?? m.scoreHome),
      score_away: safeNum(m.score_away ?? m.away_score ?? m.awayScore ?? m.scoreAway),
      round_label: safeStr(m.round ?? m.round_label ?? m.roundLabel ?? m.matchday).trim() || null,
    });
  }

  return out;
}
