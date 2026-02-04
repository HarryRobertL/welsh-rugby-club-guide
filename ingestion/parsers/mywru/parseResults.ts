/**
 * Parse MyWRU results JSON into normalized match rows (same shape as fixtures).
 * File: ingestion/parsers/mywru/parseResults.ts
 */

import { parseFixtures } from './parseFixtures';
import type { ParserMeta, NormalizedMatchRow } from './types';

/**
 * Results use the same structure as fixtures; reuse fixture parser.
 * MyWRU may return results with status 'full_time' and scores set.
 */
export function parseResults(
  rawJson: unknown,
  meta: ParserMeta
): NormalizedMatchRow[] {
  return parseFixtures(rawJson, meta);
}
