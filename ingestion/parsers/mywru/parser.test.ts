/**
 * Unit tests for MyWRU parsers using fixture JSON.
 * Run: npm run test:ingest
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseStandings } from './parseStandings';
import { parseFixtures } from './parseFixtures';
import { parseResults } from './parseResults';
import type { NormalizedStandingRow, NormalizedMatchRow } from './types';

const FIXTURES_DIR = join(__dirname, 'fixtures');

function loadFixture(name: string): unknown {
  const raw = readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf8');
  return JSON.parse(raw);
}

const meta = { competition_group_id: 'g1', competition_instance_id: 'i1' };

function assertStandingRow(row: NormalizedStandingRow): void {
  if (typeof row.competition_group_id !== 'string') throw new Error('standing.competition_group_id');
  if (typeof row.team_name !== 'string') throw new Error('standing.team_name');
  const nums = ['played', 'won', 'drawn', 'lost', 'points_for', 'points_against', 'table_points', 'position'] as const;
  for (const k of nums) {
    if (row[k] !== null && typeof row[k] !== 'number') throw new Error(`standing.${k}`);
  }
}

function assertMatchRow(row: NormalizedMatchRow): void {
  if (typeof row.competition_group_id !== 'string') throw new Error('match.competition_group_id');
  if (typeof row.source_match_ref !== 'string') throw new Error('match.source_match_ref');
  if (typeof row.home_team_name !== 'string') throw new Error('match.home_team_name');
  if (typeof row.away_team_name !== 'string') throw new Error('match.away_team_name');
  if (typeof row.status !== 'string') throw new Error('match.status');
  const allowed: NormalizedMatchRow['status'][] = ['scheduled', 'live', 'full_time', 'postponed', 'cancelled', 'unknown'];
  if (!allowed.includes(row.status)) throw new Error('match.status invalid');
  if (row.score_home !== null && typeof row.score_home !== 'number') throw new Error('match.score_home');
  if (row.score_away !== null && typeof row.score_away !== 'number') throw new Error('match.score_away');
}

// Standing (single object with .standings)
const standingJson = loadFixture('standing');
const standings = parseStandings(standingJson, meta);
if (standings.length < 1) throw new Error('parseStandings should return at least one row');
standings.forEach(assertStandingRow);
console.log('parseStandings: OK', standings.length, 'rows');
if (standings[0]) console.log('sample standing:', JSON.stringify(standings[0], null, 0));

// Standing (API shape: array of { leagueDetails, standings } pools)
const standingPoolsJson = loadFixture('standing-api-pools');
const standingsFromPools = parseStandings(standingPoolsJson, meta);
if (standingsFromPools.length !== 3) throw new Error(`parseStandings(api-pools) expected 3 rows, got ${standingsFromPools.length}`);
standingsFromPools.forEach(assertStandingRow);
console.log('parseStandings(api-pools): OK', standingsFromPools.length, 'rows');

// Fixtures
const fixtureJson = loadFixture('fixture');
const fixtures = parseFixtures(fixtureJson, meta);
if (fixtures.length < 1) throw new Error('parseFixtures should return at least one row');
fixtures.forEach(assertMatchRow);
console.log('parseFixtures: OK', fixtures.length, 'rows');
if (fixtures[0]) console.log('sample fixture:', JSON.stringify(fixtures[0], null, 0));

// Fixtures (object-shaped team names)
const fixtureObjectJson = loadFixture('fixture-object');
const fixturesFromObjects = parseFixtures(fixtureObjectJson, meta);
if (fixturesFromObjects.length < 2) throw new Error('parseFixtures(object) should return at least two rows');
fixturesFromObjects.forEach((row) => {
  assertMatchRow(row);
  if (row.home_team_name.includes('[object Object]') || row.away_team_name.includes('[object Object]')) {
    throw new Error('parseFixtures(object) should not stringify object team names');
  }
});
console.log('parseFixtures(object): OK', fixturesFromObjects.length, 'rows');

// Results
const resultJson = loadFixture('result');
const results = parseResults(resultJson, meta);
if (results.length < 1) throw new Error('parseResults should return at least one row');
results.forEach(assertMatchRow);
console.log('parseResults: OK', results.length, 'rows');
if (results[0]) console.log('sample result:', JSON.stringify(results[0], null, 0));

console.log('All parser tests passed.');
process.exit(0);
