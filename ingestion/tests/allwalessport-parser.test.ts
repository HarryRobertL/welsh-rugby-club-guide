/**
 * Minimal parser tests for All Wales Sport: fixtures and standings from saved HTML.
 * Run: npm run test:ingest:allwalessport
 * Uses ts-node; does not affect main build.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';
import { parseCompetitionPage } from '../sources/allwalessport/parse_competition_page';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'allwalessport');

function loadHtml(name: string): string {
  return readFileSync(join(FIXTURES_DIR, `${name}.html`), 'utf8');
}

// --- Test: parse fixtures from saved HTML ---
const fixtureHtml = loadHtml('fixture-page');
const $fixture = cheerio.load(fixtureHtml);
const parsedFixtures = parseCompetitionPage($fixture);

if (parsedFixtures.fixturesBlocks.length < 1) {
  throw new Error('Expected at least one fixtures block; got ' + parsedFixtures.fixturesBlocks.length);
}
const totalFixtureRows = parsedFixtures.fixturesBlocks.reduce((s, b) => s + b.rows.length, 0);
if (totalFixtureRows < 2) {
  throw new Error('Expected at least 2 fixture rows; got ' + totalFixtureRows);
}
const firstBlock = parsedFixtures.fixturesBlocks[0];
if (!firstBlock.rows[0]?.homeTeam || !firstBlock.rows[0]?.awayTeam) {
  throw new Error('First fixture row should have homeTeam and awayTeam');
}
console.log('Fixtures test OK:', {
  blocks: parsedFixtures.fixturesBlocks.length,
  totalRows: totalFixtureRows,
  sample: firstBlock.rows[0],
});

// --- Test: parse standings table from saved HTML ---
const standingsHtml = loadHtml('standings-page');
const $standings = cheerio.load(standingsHtml);
const parsedStandings = parseCompetitionPage($standings);

if (parsedStandings.standingsRows.length < 1) {
  throw new Error('Expected at least one standings row; got ' + parsedStandings.standingsRows.length);
}
const firstStanding = parsedStandings.standingsRows[0];
if (typeof firstStanding.team_name !== 'string' || !firstStanding.team_name) {
  throw new Error('First standing row should have team_name');
}
if (firstStanding.table_points !== undefined && firstStanding.table_points !== 42) {
  throw new Error('Expected first row table_points 42; got ' + firstStanding.table_points);
}
console.log('Standings test OK:', {
  rows: parsedStandings.standingsRows.length,
  sample: { team_name: firstStanding.team_name, position: firstStanding.position, table_points: firstStanding.table_points },
});

console.log('All Wales Sport parser tests passed.');
process.exit(0);
