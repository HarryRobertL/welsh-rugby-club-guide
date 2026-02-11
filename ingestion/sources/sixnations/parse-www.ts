/**
 * Parse Six Nations www fixture table page (HTML or __NEXT_DATA__).
 * Produces OvalFixtureRow[] and OvalStandingRow[] for use with persistSixNations.
 * File: ingestion/sources/sixnations/parse-www.ts
 */

import * as cheerio from 'cheerio';
import type { OvalFixtureRow, OvalStandingRow } from './persist';

const WWW_BASE = 'https://www.sixnationsrugby.com';

/** OVAL API team ids (match API response: England 1, Scotland 2, Wales 3, Ireland 4, France 5, Italy 6). */
const TEAM_CODE_TO_OVAL: Record<string, { id: number; name: string }> = {
  ENG: { id: 1, name: 'England' },
  SCO: { id: 2, name: 'Scotland' },
  WAL: { id: 3, name: 'Wales' },
  IRE: { id: 4, name: 'Ireland' },
  FRA: { id: 5, name: 'France' },
  ITA: { id: 6, name: 'Italy' },
};

function teamFromCode(code: string): { id: number; name: string } | null {
  const key = (code || '').trim().toUpperCase().slice(0, 3);
  return TEAM_CODE_TO_OVAL[key] ?? null;
}

/** Parse year from seasonId e.g. 202600 -> 2026. */
function yearFromSeasonId(seasonId: string): number {
  const y = parseInt(seasonId.slice(0, 4), 10);
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

/** "Thu 5 Feb" + year 2026 -> "2026-02-05". */
function parseDateStr(dateStr: string, year: number): string | null {
  const s = (dateStr || '').trim();
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const match = s.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = months[match[2].toLowerCase()];
  if (!month || day < 1 || day > 31) return null;
  const monthPad = String(month).padStart(2, '0');
  const dayPad = String(day).padStart(2, '0');
  return `${year}-${monthPad}-${dayPad}`;
}

/** "15:10" -> time string; combine with date for ISO. */
function timeToISO(dateYMD: string, timeStr: string): string {
  const t = (timeStr || '').trim().replace(/\s/g, '');
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) {
    return `${dateYMD}T12:00:00.000Z`;
  }
  const [hh, mm] = t.split(':').map((x) => parseInt(x, 10));
  const h = Math.min(23, Math.max(0, hh ?? 12));
  const m = Math.min(59, Math.max(0, mm ?? 0));
  return `${dateYMD}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
}

/**
 * Try to extract fixtures from Next.js __NEXT_DATA__ script.
 * Returns array if found and valid; otherwise null.
 */
function parseNextData(html: string, seasonId: string): {
  fixtures: OvalFixtureRow[];
  standings: OvalStandingRow[];
} | null {
  const match = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json">\s*([\s\S]*?)<\/script>/i);
  if (!match || !match[1]) return null;
  let data: unknown;
  try {
    data = JSON.parse(match[1].trim());
  } catch {
    return null;
  }
  const obj = data as Record<string, unknown>;
  const props = obj.props as Record<string, unknown> | undefined;
  const pageProps = props?.pageProps as Record<string, unknown> | undefined;
  const year = yearFromSeasonId(seasonId);

  const fixtures: OvalFixtureRow[] = [];
  const standings: OvalStandingRow[] = [];
  const push = (homeCode: string, awayCode: string, dateYMD: string, timeStr: string, scoreHome?: number, scoreAway?: number) => {
    const home = teamFromCode(homeCode);
    const away = teamFromCode(awayCode);
    if (!home || !away) return;
    const scheduled_at = timeToISO(dateYMD, timeStr);
    const status = scoreHome != null && scoreAway != null ? 'full_time' : 'scheduled';
    fixtures.push({
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeTeamName: home.name,
      awayTeamName: away.name,
      scheduled_at,
      status,
      scoreHome: scoreHome ?? 0,
      scoreAway: scoreAway ?? 0,
    });
  };

  const events = (pageProps?.fixtures ?? pageProps?.matches ?? pageProps?.events ?? pageProps?.data) as unknown[] | undefined;
  if (Array.isArray(events) && events.length > 0) {
    for (const ev of events) {
      const e = ev as Record<string, unknown>;
      const home = (e.homeTeam ?? e.home) as Record<string, unknown> | string | undefined;
      const away = (e.awayTeam ?? e.away) as Record<string, unknown> | string | undefined;
      const homeCode = typeof home === 'string' ? home : (home?.shortName ?? home?.code ?? home?.abbreviation ?? '') as string;
      const awayCode = typeof away === 'string' ? away : (away?.shortName ?? away?.code ?? away?.abbreviation ?? '') as string;
      const date = (e.date ?? e.scheduledAt ?? e.kickOff ?? e.startDate) as string | undefined;
      const time = (e.time ?? e.kickOffTime) as string | undefined;
      let dateYMD = '';
      if (typeof date === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(date)) dateYMD = date.slice(0, 10);
        else dateYMD = parseDateStr(date, year) ?? `${year}-01-01`;
      } else {
        dateYMD = parseDateStr(String(date ?? ''), year) ?? `${year}-01-01`;
      }
      const scoreH = e.scoreHome ?? e.homeScore ?? e.home_score;
      const scoreA = e.scoreAway ?? e.awayScore ?? e.away_score;
      const sh = typeof scoreH === 'number' ? scoreH : typeof scoreH === 'string' ? parseInt(scoreH, 10) : undefined;
      const sa = typeof scoreA === 'number' ? scoreA : typeof scoreA === 'string' ? parseInt(scoreA, 10) : undefined;
      push(homeCode, awayCode, dateYMD, (time as string) ?? '', sh, sa);
    }
    if (fixtures.length > 0) {
      // continue to attempt standings extraction below
    }
  }

  const table =
    (pageProps?.standings as unknown[]) ??
    (pageProps?.table as unknown[]) ??
    (pageProps?.ranking as unknown[]) ??
    ((pageProps?.data as Record<string, unknown> | undefined)?.standings as unknown[]) ??
    ((pageProps?.data as Record<string, unknown> | undefined)?.table as unknown[]);
  if (Array.isArray(table)) {
    for (const row of table) {
      const r = row as Record<string, unknown>;
      const team = (r.team ?? r.teamName ?? r.name) as Record<string, unknown> | string | undefined;
      const teamName =
        typeof team === 'string'
          ? team
          : (team?.name as string | undefined) ?? (team?.shortName as string | undefined);
      const teamCode =
        (typeof team === 'object' ? (team?.shortName as string | undefined) : undefined) ??
        (r.teamCode as string | undefined) ??
        (r.teamShortName as string | undefined) ??
        '';
      const mapped = teamFromCode(teamCode) ?? null;
      const teamId =
        mapped?.id ??
        teamName ??
        (typeof r.position === 'number' ? r.position : undefined);
      standings.push({
        position: Number(r.position ?? r.rank ?? r.pos) || 0,
        teamId,
        teamName: teamName ?? mapped?.name,
        played: Number(r.played ?? r.p) || 0,
        won: Number(r.won ?? r.w) || 0,
        drawn: Number(r.drawn ?? r.d) || 0,
        lost: Number(r.lost ?? r.l) || 0,
        pointsFor: Number(r.pointsFor ?? r.pf ?? r.for) || 0,
        pointsAgainst: Number(r.pointsAgainst ?? r.pa ?? r.against) || 0,
        points: Number(r.points ?? r.pts) || 0,
      });
    }
  }

  if (fixtures.length > 0 || standings.length > 0) {
    return { fixtures, standings };
  }
  return null;
}

/**
 * Raw HTML pass: find blocks that start with a date line then contain CODE score CODE or CODE time CODE.
 */
function parseRawHtml(html: string, seasonId: string): OvalFixtureRow[] {
  const year = yearFromSeasonId(seasonId);
  const fixtures: OvalFixtureRow[] = [];
  const codePat = /(ENG|SCO|WAL|IRE|FRA|ITA)/gi;
  const datePat = /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/gi;
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  let currentDateYMD: string | null = null;
  const lines = html.split(/\r?\n/).map((l) => l.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const line of lines) {
    datePat.lastIndex = 0;
    const dateM = datePat.exec(line);
    if (dateM) {
      const day = parseInt(dateM[1], 10);
      const month = months[dateM[2].toLowerCase()];
      if (month && day >= 1 && day <= 31) {
        currentDateYMD = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    const codes = [...line.matchAll(codePat)].map((m) => m[1].toUpperCase());
    if (codes.length >= 2 && currentDateYMD) {
      const home = teamFromCode(codes[0]);
      const away = teamFromCode(codes[1]);
      if (!home || !away) continue;
      const scoreM = line.match(/(\d+)\s*[-–]\s*(\d+)/);
      const timeM = line.match(/\b(\d{1,2}:\d{2})\b/);
      const scoreHome = scoreM ? parseInt(scoreM[1], 10) : undefined;
      const scoreAway = scoreM ? parseInt(scoreM[2], 10) : undefined;
      const timeStr = timeM ? timeM[1] : '';
      const scheduled_at = timeToISO(currentDateYMD, timeStr);
      const status = scoreHome != null && scoreAway != null ? 'full_time' : 'scheduled';
      fixtures.push({
        homeTeamId: home.id,
        awayTeamId: away.id,
        homeTeamName: home.name,
        awayTeamName: away.name,
        scheduled_at,
        status,
        scoreHome: scoreHome ?? 0,
        scoreAway: scoreAway ?? 0,
      });
    }
  }
  return dedupeFixtures(fixtures);
}

/**
 * Fallback: scrape with Cheerio (smallest nodes containing two codes + date).
 */
function parseWithCheerio(html: string, seasonId: string): OvalFixtureRow[] {
  const fromRaw = parseRawHtml(html, seasonId);
  if (fromRaw.length > 0) return fromRaw;
  const $ = cheerio.load(html);
  const year = yearFromSeasonId(seasonId);
  const fixtures: OvalFixtureRow[] = [];
  let currentDateYMD: string | null = null;
  $('*').each((_, el) => {
    const text = $(el).text().trim();
    const dateMatch = text.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
    if (dateMatch) {
      const parsed = parseDateStr(dateMatch[0], year);
      if (parsed) currentDateYMD = parsed;
    }
    const foundCodes = [...text.toUpperCase().matchAll(/\b(ENG|SCO|WAL|IRE|FRA|ITA)\b/g)].map((m) => m[1]);
    if (foundCodes.length >= 2 && currentDateYMD) {
      const home = teamFromCode(foundCodes[0]);
      const away = teamFromCode(foundCodes[1]);
      if (!home || !away) return;
      const scoreMatch = text.match(/(\d+)\s*[-–]\s*(\d+)/);
      const timeMatch = text.match(/\b(\d{1,2}:\d{2})\b/);
      const scoreHome = scoreMatch ? parseInt(scoreMatch[1], 10) : undefined;
      const scoreAway = scoreMatch ? parseInt(scoreMatch[2], 10) : undefined;
      const scheduled_at = timeToISO(currentDateYMD, timeMatch ? timeMatch[1] : '');
      const status = scoreHome != null && scoreAway != null ? 'full_time' : 'scheduled';
      fixtures.push({
        homeTeamId: home.id,
        awayTeamId: away.id,
        homeTeamName: home.name,
        awayTeamName: away.name,
        scheduled_at,
        status,
        scoreHome: scoreHome ?? 0,
        scoreAway: scoreAway ?? 0,
      });
    }
  });
  return dedupeFixtures(fixtures);
}

/** Dedupe by home+away+date. */
function dedupeFixtures(rows: OvalFixtureRow[]): OvalFixtureRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.homeTeamId}-${r.awayTeamId}-${(r.scheduled_at ?? '').slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Dedupe standings by teamId. */
function dedupeStandings(rows: OvalStandingRow[]): OvalStandingRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = String(r.teamId ?? r.teamName ?? '');
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Static fallback when page is client-rendered and returns no data. 2026 season. */
function getStaticFallbackFixtures(seasonId: string): OvalFixtureRow[] {
  if (seasonId !== '202600') return [];
  return [
    { homeTeamId: 5, awayTeamId: 4, homeTeamName: 'France', awayTeamName: 'Ireland', scheduled_at: '2026-02-05T21:10:00.000Z', status: 'full_time', scoreHome: 36, scoreAway: 14 },
    { homeTeamId: 6, awayTeamId: 2, homeTeamName: 'Italy', awayTeamName: 'Scotland', scheduled_at: '2026-02-07T15:15:00.000Z', status: 'full_time', scoreHome: 18, scoreAway: 15 },
    { homeTeamId: 1, awayTeamId: 3, homeTeamName: 'England', awayTeamName: 'Wales', scheduled_at: '2026-02-07T16:10:00.000Z', status: 'full_time', scoreHome: 48, scoreAway: 7 },
    { homeTeamId: 4, awayTeamId: 6, homeTeamName: 'Ireland', awayTeamName: 'Italy', scheduled_at: `2026-02-14T15:10:00.000Z`, status: 'scheduled', scoreHome: 0, scoreAway: 0 },
    { homeTeamId: 2, awayTeamId: 1, homeTeamName: 'Scotland', awayTeamName: 'England', scheduled_at: `2026-02-14T17:40:00.000Z`, status: 'scheduled', scoreHome: 0, scoreAway: 0 },
    { homeTeamId: 3, awayTeamId: 5, homeTeamName: 'Wales', awayTeamName: 'France', scheduled_at: `2026-02-15T16:10:00.000Z`, status: 'scheduled', scoreHome: 0, scoreAway: 0 },
    { homeTeamId: 1, awayTeamId: 4, homeTeamName: 'England', awayTeamName: 'Ireland', scheduled_at: `2026-02-21T15:10:00.000Z`, status: 'scheduled', scoreHome: 0, scoreAway: 0 },
    { homeTeamId: 3, awayTeamId: 2, homeTeamName: 'Wales', awayTeamName: 'Scotland', scheduled_at: `2026-02-21T17:40:00.000Z`, status: 'scheduled', scoreHome: 0, scoreAway: 0 },
    { homeTeamId: 5, awayTeamId: 6, homeTeamName: 'France', awayTeamName: 'Italy', scheduled_at: `2026-02-22T16:10:00.000Z`, status: 'scheduled', scoreHome: 0, scoreAway: 0 },
    { homeTeamId: 4, awayTeamId: 3, homeTeamName: 'Ireland', awayTeamName: 'Wales', scheduled_at: `2026-03-06T21:10:00.000Z`, status: 'scheduled', scoreHome: 0, scoreAway: 0 },
    { homeTeamId: 2, awayTeamId: 5, homeTeamName: 'Scotland', awayTeamName: 'France', scheduled_at: `2026-03-07T15:10:00.000Z`, status: 'scheduled', scoreHome: 0, scoreAway: 0 },
    { homeTeamId: 6, awayTeamId: 1, homeTeamName: 'Italy', awayTeamName: 'England', scheduled_at: `2026-03-07T17:40:00.000Z`, status: 'scheduled', scoreHome: 0, scoreAway: 0 },
    { homeTeamId: 4, awayTeamId: 2, homeTeamName: 'Ireland', awayTeamName: 'Scotland', scheduled_at: `2026-03-14T15:10:00.000Z`, status: 'scheduled', scoreHome: 0, scoreAway: 0 },
    { homeTeamId: 3, awayTeamId: 6, homeTeamName: 'Wales', awayTeamName: 'Italy', scheduled_at: `2026-03-14T17:40:00.000Z`, status: 'scheduled', scoreHome: 0, scoreAway: 0 },
    { homeTeamId: 5, awayTeamId: 1, homeTeamName: 'France', awayTeamName: 'England', scheduled_at: `2026-03-14T21:10:00.000Z`, status: 'scheduled', scoreHome: 0, scoreAway: 0 },
  ];
}

/** Static fallback standings for 2026 (from Six Nations table). */
function getStaticFallbackStandings(seasonId: string): OvalStandingRow[] {
  if (seasonId !== '202600') return [];
  return [
    { position: 1, teamId: 1, teamName: 'England', played: 1, won: 1, drawn: 0, lost: 0, pointsFor: 48, pointsAgainst: 7, points: 5 },
    { position: 2, teamId: 5, teamName: 'France', played: 1, won: 1, drawn: 0, lost: 0, pointsFor: 36, pointsAgainst: 14, points: 5 },
    { position: 3, teamId: 6, teamName: 'Italy', played: 1, won: 1, drawn: 0, lost: 0, pointsFor: 18, pointsAgainst: 15, points: 4 },
    { position: 4, teamId: 2, teamName: 'Scotland', played: 1, won: 0, drawn: 0, lost: 1, pointsFor: 15, pointsAgainst: 18, points: 1 },
    { position: 5, teamId: 4, teamName: 'Ireland', played: 1, won: 0, drawn: 0, lost: 1, pointsFor: 14, pointsAgainst: 36, points: 0 },
    { position: 6, teamId: 3, teamName: 'Wales', played: 1, won: 0, drawn: 0, lost: 1, pointsFor: 7, pointsAgainst: 48, points: 0 },
  ];
}

/**
 * Parse Six Nations www table page HTML into OvalFixtureRow[].
 * Tries __NEXT_DATA__ first, then raw HTML regex, then Cheerio fallback.
 * If all return empty and we have a static fallback for the season, use that (e.g. 2026 when page is client-rendered).
 */
export function parseSixNationsWwwPage(html: string, seasonId: string): {
  fixtures: OvalFixtureRow[];
  standings: OvalStandingRow[];
} {
  const fromNext = parseNextData(html, seasonId);
  if (fromNext) {
    return {
      fixtures: dedupeFixtures(fromNext.fixtures),
      standings: dedupeStandings(fromNext.standings),
    };
  }
  const fromCheerio = parseWithCheerio(html, seasonId);
  const fixtures = fromCheerio.length > 0 ? fromCheerio : getStaticFallbackFixtures(seasonId);
  const standings = getStaticFallbackStandings(seasonId);
  return { fixtures, standings };
}

export function sixnationsWwwTableUrl(seasonId: string): string {
  return `${WWW_BASE}/en/m6n/fixtures/${seasonId}/table`;
}
