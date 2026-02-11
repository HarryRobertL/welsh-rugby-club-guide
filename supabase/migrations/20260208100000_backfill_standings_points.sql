-- One-time backfill: set points from won/drawn where points are 0 but wins/draws exist (pre-fallback data).
UPDATE standings
SET points = 4 * won + 2 * drawn
WHERE points = 0
  AND (won > 0 OR drawn > 0);
