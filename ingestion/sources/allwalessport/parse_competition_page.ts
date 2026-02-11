/**
 * All Wales Sport competition page parser.
 * Input: Cheerio document of a URL like .../rugby-union.aspx?cid=16481.
 * Output: competitionTitle, tabsFound, fixturesBlocks, resultsBlocks, standingsRows.
 * No database writes.
 * File: ingestion/sources/allwalessport/parse_competition_page.ts
 */

import type { CheerioAPI, Cheerio } from 'cheerio';

/** English month names for date regex */
const MONTHS =
  'January|February|March|April|May|June|July|August|September|October|November|December';
/** Match "6 February 2026" or "31 January 2026" */
const DATE_HEADING_REGEX = new RegExp(`(\\d{1,2})\\s+(${MONTHS})\\s+(\\d{4})`, 'i');

/** Match score: "12 10", "12 to 10", "12-10", "12:10" */
const SCORE_REGEX = /(\d+)\s*(?:to|-|:|\s)\s*(\d+)/;

const TIME_REGEX = /^\d{1,2}:\d{2}$/;

export type FixtureRow = {
  kickoffTime?: string;
  homeTeam: string;
  awayTeam: string;
  venue?: string;
  notes?: string;
};

export type ResultRow = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  venue?: string;
  notes?: string;
};

export type FixtureBlock = {
  dateText: string;
  rows: FixtureRow[];
};

export type ResultBlock = {
  dateText: string;
  rows: ResultRow[];
};

export type StandingsRow = {
  position?: number;
  team_name: string;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  points_for?: number;
  points_against?: number;
  table_points?: number;
  /** When debug, raw cell values */
  _raw?: string[];
};

export type TabsFound = {
  fixtures: boolean;
  results: boolean;
  table: boolean;
};

export type ParsedCompetitionPage = {
  competitionTitle: string;
  tabsFound: TabsFound;
  fixturesBlocks: FixtureBlock[];
  resultsBlocks: ResultBlock[];
  standingsRows: StandingsRow[];
};

export type ParseCompetitionPageOptions = {
  debug?: boolean;
};

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function extractDateFromHeading(text: string): string | null {
  const m = DATE_HEADING_REGEX.exec(text);
  if (!m) return null;
  return `${m[1]} ${m[2]} ${m[3]}`;
}

/** Find first h1 or h2 that is not nav-like and not a date (competition name). */
function findCompetitionTitle($: CheerioAPI): string {
  const candidates: string[] = [];
  $('h1').each((_: number, el: any) => {
    const t = normalizeWhitespace($(el).text());
    if (t) candidates.push(t);
  });
  $('h2').each((_: number, el: any) => {
    const t = normalizeWhitespace($(el).text());
    if (t) candidates.push(t);
  });
  for (const t of candidates) {
    if (/^(Rugby\s|Football|Cricket|Home|Links)/i.test(t)) continue;
    if (extractDateFromHeading(t)) continue;
    return t;
  }
  return 'Competition';
}

function detectTabs($: CheerioAPI): TabsFound {
  const text = $('body').text();
  return {
    fixtures: /Fixtures/i.test(text),
    results: /Results/i.test(text),
    table: /Table/i.test(text) || /\bP\s+W\s+D\s+L\s+Pts\b/i.test(text),
  };
}

/** Collect date headings and following content blocks (tables). */
function collectDateBlocks($: CheerioAPI): { dateText: string; $table: Cheerio<any> }[] {
  const blocks: { dateText: string; $table: Cheerio<any> }[] = [];
  const $root = $('body');
  let currentDate = '';

  $root.find('h2, h3, h4, table').each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
      const dateStr = extractDateFromHeading($(el).text());
      if (dateStr) currentDate = dateStr;
      return;
    }
    if (tag === 'table' && currentDate) {
      blocks.push({ dateText: currentDate, $table: $(el) });
    }
  });

  return blocks;
}

function parseFixtureRow(cells: string[], _debug?: boolean): FixtureRow | null {
  const vIdx = cells.findIndex((c) => normalizeWhitespace(c) === 'v' || c.trim() === 'v');
  if (vIdx < 0) return null;
  const home = cells.slice(0, vIdx);
  const away = cells.slice(vIdx + 1);
  const homeStr = normalizeWhitespace(home.join(' '));
  const awayStr = normalizeWhitespace(away.join(' '));
  if (!homeStr || !awayStr) return null;

  let kickoffTime: string | undefined;
  const first = home[0]?.trim() ?? '';
  if (TIME_REGEX.test(first)) {
    kickoffTime = first;
    return {
      kickoffTime,
      homeTeam: normalizeWhitespace(home.slice(1).join(' ')),
      awayTeam: awayStr,
    };
  }
  return { homeTeam: homeStr, awayTeam: awayStr };
}

function parseResultRow(cells: string[], debug?: boolean): ResultRow | null {
  if (cells.length < 4) return null;
  const nums: number[] = [];
  const rest: string[] = [];
  for (const c of cells) {
    const t = c.trim();
    const n = parseInt(t, 10);
    if (t !== '' && !Number.isNaN(n) && String(n) === t) nums.push(n);
    else rest.push(t);
  }
  if (nums.length < 2) {
    const joined = cells.join(' ');
    const scoreMatch = joined.match(SCORE_REGEX);
    if (scoreMatch) {
      const homeScore = parseInt(scoreMatch[1], 10);
      const awayScore = parseInt(scoreMatch[2], 10);
      const parts = joined.split(SCORE_REGEX).map((s) => normalizeWhitespace(s)).filter(Boolean);
      const homeTeam = parts[0] ?? '';
      const awayTeam = parts[parts.length - 1] ?? '';
      if (homeTeam && awayTeam)
        return { homeTeam, awayTeam, homeScore, awayScore };
    }
    return null;
  }
  const homeScore = nums[0];
  const awayScore = nums[1];
  const homeTeam = rest[0] ?? '';
  const awayTeam = rest[rest.length - 1] ?? '';
  if (!homeTeam || !awayTeam) return null;
  return { homeTeam, awayTeam, homeScore, awayScore };
}

function isFixtureTable($: CheerioAPI, $table: Cheerio<any>): boolean {
  let hasV = false;
  $table.find('tr').each((_: number, tr: any) => {
    $(tr).find('td').each((__: number, td: any) => {
      if ($(td).text().trim() === 'v') hasV = true;
    });
  });
  return hasV;
}

function isResultTable($: CheerioAPI, $table: Cheerio<any>): boolean {
  let rowCount = 0;
  let hasTwoNumbers = false;
  $table.find('tr').each((_: number, tr: any) => {
    const cells = $(tr).find('td').map((__: number, td: any) => $(td).text().trim()).get();
    if (cells.length >= 4) {
      const numCount = cells.filter((c: string) => /^\d+$/.test(c)).length;
      if (numCount >= 2) hasTwoNumbers = true;
      rowCount++;
    }
  });
  return rowCount > 0 && hasTwoNumbers;
}

function parseFixturesBlocks($: CheerioAPI, options?: ParseCompetitionPageOptions): FixtureBlock[] {
  const blocks = collectDateBlocks($);
  const out: FixtureBlock[] = [];
  for (const { dateText, $table } of blocks) {
    if (!isFixtureTable($, $table)) continue;
    const rows: FixtureRow[] = [];
    $table.find('tr').each((_: number, tr: any) => {
      const cells = $(tr).find('td').map((__: number, td: any) => $(td).text().trim()).get();
      if (cells.length < 2) return;
      const row = parseFixtureRow(cells, options?.debug);
      if (row) rows.push(row);
    });
    if (rows.length) out.push({ dateText, rows });
  }
  return out;
}

function parseResultsBlocks($: CheerioAPI, options?: ParseCompetitionPageOptions): ResultBlock[] {
  const blocks = collectDateBlocks($);
  const out: ResultBlock[] = [];
  for (const { dateText, $table } of blocks) {
    if (!isResultTable($, $table)) continue;
    const rows: ResultRow[] = [];
    $table.find('tr').each((_: number, tr: any) => {
      const cells = $(tr).find('td').map((__: number, td: any) => $(td).text().trim()).get();
      const row = parseResultRow(cells, options?.debug);
      if (row) rows.push(row);
    });
    if (rows.length) out.push({ dateText, rows });
  }
  return out;
}

/** Map header text to canonical key. */
const STANDINGS_HEADER_MAP: Record<string, string> = {
  teams: 'team_name',
  team: 'team_name',
  p: 'played',
  w: 'won',
  d: 'drawn',
  l: 'lost',
  pts: 'table_points',
  points: 'table_points',
  pf: 'points_for',
  pa: 'points_against',
  'pts for': 'points_for',
  'pts against': 'points_against',
  for: 'points_for',
  against: 'points_against',
  f: 'points_for',
  a: 'points_against',
  pos: 'position',
  position: 'position',
  '#': 'position',
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseStandingsTable($: CheerioAPI, options?: ParseCompetitionPageOptions): StandingsRow[] {
  const rows: StandingsRow[] = [];
  const tables = $('table');
  for (let t = 0; t < tables.length; t++) {
    const $table = $(tables[t]);
    const headerCells = $table.find('tr').first().find('th, td').map((__, cell) =>
      normalizeHeader($(cell).text().trim())
    ).get();
    const keyIndices: Record<string, number> = {};
    headerCells.forEach((h, i) => {
      const key = STANDINGS_HEADER_MAP[h] ?? h.replace(/\s+/g, '_');
      if (key !== 'team_name') keyIndices[key] = i;
      if (key === 'team_name' || h === 'teams' || h === 'team') keyIndices.team_name = i;
    });
    const hasTableLikeHeaders =
      keyIndices.team_name !== undefined &&
      (keyIndices.played !== undefined || keyIndices.won !== undefined || keyIndices.table_points !== undefined);
    if (!hasTableLikeHeaders) continue;

    let rowIndex = 0;
    $table.find('tr').slice(1).each((_: number, tr: any) => {
      const cells = $(tr).find('td').map((__: number, td: any) => $(td).text().trim()).get();
      if (cells.length < 2) return;
      const teamName = cells[keyIndices.team_name ?? 0] ?? '';
      if (!teamName || /^-+$/i.test(teamName) || /relegation/i.test(teamName)) return;

      rowIndex += 1;
      const row: StandingsRow = { team_name: teamName };
      const getNum = (key: string): number | undefined => {
        const i = keyIndices[key];
        if (i === undefined) return undefined;
        const v = parseInt(cells[i], 10);
        return Number.isNaN(v) ? undefined : v;
      };
      row.position = getNum('position') ?? getNum('pos') ?? rowIndex;
      row.played = getNum('played') ?? getNum('p');
      row.won = getNum('won') ?? getNum('w');
      row.drawn = getNum('drawn') ?? getNum('d');
      row.lost = getNum('lost') ?? getNum('l');
      row.points_for = getNum('points_for') ?? getNum('pf');
      row.points_against = getNum('points_against') ?? getNum('pa');
      row.table_points = getNum('table_points');
      if (options?.debug) row._raw = cells;
      rows.push(row);
    });
    if (rows.length > 0) break;
  }
  return rows;
}

export function parseCompetitionPage(
  $: CheerioAPI,
  options?: ParseCompetitionPageOptions
): ParsedCompetitionPage {
  const title = findCompetitionTitle($);
  const tabsFound = detectTabs($);
  const fixturesBlocks = parseFixturesBlocks($, options);
  const resultsBlocks = parseResultsBlocks($, options);
  const standingsRows = parseStandingsTable($, options);

  return {
    competitionTitle: title,
    tabsFound,
    fixturesBlocks,
    resultsBlocks,
    standingsRows,
  };
}

/**
 * Fetch and parse a competition page by cid. When DEBUG_ALLWALESSPORT=1, logs counts.
 */
export async function parseCompetitionByCid(cid: number): Promise<ParsedCompetitionPage> {
  const { loadAllWalesSportConfig } = await import('../allwalessport');
  const config = loadAllWalesSportConfig();
  const { createAllWalesSportHttpClient } = await import('./http');
  const client = createAllWalesSportHttpClient({
    baseUrl: config.baseUrl,
    userAgent: config.userAgent,
    requestTimeoutMs: config.requestTimeoutMs,
    rateLimitPerSecond: config.rateLimitPerSecond,
  });
  const url = `${config.baseUrl.replace(/\/$/, '')}/rugby-union.aspx?cid=${cid}`;
  const $ = await client.fetchDocument(url);
  const parsed = parseCompetitionPage($, { debug: process.env.DEBUG_ALLWALESSPORT === '1' });

  if (process.env.DEBUG_ALLWALESSPORT === '1') {
    const fixtureCount = parsed.fixturesBlocks.reduce((s, b) => s + b.rows.length, 0);
    const resultCount = parsed.resultsBlocks.reduce((s, b) => s + b.rows.length, 0);
    console.info('[AllWalesSport] parseCompetitionByCid', {
      cid,
      competitionTitle: parsed.competitionTitle,
      tabsFound: parsed.tabsFound,
      fixturesBlocks: parsed.fixturesBlocks.length,
      fixtureRows: fixtureCount,
      resultsBlocks: parsed.resultsBlocks.length,
      resultRows: resultCount,
      standingsRows: parsed.standingsRows.length,
    });
  }

  return parsed;
}
