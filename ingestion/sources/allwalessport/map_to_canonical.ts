/**
 * Map All Wales Sport parsed competition output to canonical payload formats
 * used by the ingestion pipeline.
 * File: ingestion/sources/allwalessport/map_to_canonical.ts
 */

import type { ParsedCompetitionPage } from './parse_competition_page';

const MONTH_NAMES: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/** Normalize whitespace: trim and collapse multiple spaces. */
export function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Parse "6 February 2026" or "31 January 2026" to ISO date YYYY-MM-DD.
 * Returns null if not parseable (do not guess year).
 */
export function parseDateTextToIso(dateText: string): string | null {
  const t = normalizeText(dateText);
  const match = t.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/i);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const monthName = match[2].toLowerCase();
  const year = parseInt(match[3], 10);
  const month = MONTH_NAMES[monthName];
  if (!month || Number.isNaN(day) || Number.isNaN(year)) return null;
  if (day < 1 || day > 31) return null;
  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  return `${year}-${monthStr}-${dayStr}`;
}

/** Canonical fixture item (one per fixture row). */
export type CanonicalFixture = {
  competitionCid: number;
  competitionLabel: string;
  /** ISO date when parseable, else dateText. */
  date: string;
  dateText: string;
  parsedDateIso: string | null;
  kickoffTime?: string;
  homeTeam: string;
  awayTeam: string;
  venue?: string;
  sourceUrl: string;
};

/** Canonical result item (one per result row). */
export type CanonicalResult = {
  competitionCid: number;
  /** ISO date when parseable, else dateText. */
  date: string;
  dateText: string;
  parsedDateIso: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  sourceUrl: string;
};

/** Canonical standing row. */
export type CanonicalStanding = {
  competitionCid: number;
  position: number;
  team_name: string;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  points_for?: number;
  points_against?: number;
  table_points?: number;
  sourceUrl: string;
};

export type CanonicalPayloads = {
  fixtures: CanonicalFixture[];
  results: CanonicalResult[];
  standings: CanonicalStanding[];
};

export type MapToCanonicalInput = {
  parsed: ParsedCompetitionPage;
  competitionCid: number;
  competitionLabel: string;
  sourceUrl: string;
};

export function mapParsedToCanonical(input: MapToCanonicalInput): CanonicalPayloads {
  const { parsed, competitionCid, competitionLabel, sourceUrl } = input;
  const fixtures: CanonicalFixture[] = [];
  const results: CanonicalResult[] = [];
  const standings: CanonicalStanding[] = [];

  for (const block of parsed.fixturesBlocks) {
    const dateText = normalizeText(block.dateText);
    const parsedDateIso = parseDateTextToIso(dateText);
    for (const row of block.rows) {
      fixtures.push({
        competitionCid,
        competitionLabel,
        date: parsedDateIso ?? dateText,
        dateText,
        parsedDateIso,
        kickoffTime: row.kickoffTime ? normalizeText(row.kickoffTime) : undefined,
        homeTeam: normalizeText(row.homeTeam),
        awayTeam: normalizeText(row.awayTeam),
        venue: row.venue ? normalizeText(row.venue) : undefined,
        sourceUrl,
      });
    }
  }

  for (const block of parsed.resultsBlocks) {
    const dateText = normalizeText(block.dateText);
    const parsedDateIso = parseDateTextToIso(dateText);
    for (const row of block.rows) {
      results.push({
        competitionCid,
        date: parsedDateIso ?? dateText,
        dateText,
        parsedDateIso,
        homeTeam: normalizeText(row.homeTeam),
        awayTeam: normalizeText(row.awayTeam),
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        sourceUrl,
      });
    }
  }

  for (const row of parsed.standingsRows) {
    standings.push({
      competitionCid,
      position: row.position ?? 0,
      team_name: normalizeText(row.team_name),
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      points_for: row.points_for,
      points_against: row.points_against,
      table_points: row.table_points,
      sourceUrl,
    });
  }

  return { fixtures, results, standings };
}
