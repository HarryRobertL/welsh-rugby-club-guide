# Competition deduplication (historical)

## Purpose

This document describes an earlier approach where the app showed one row per logical league by deduping **MyWRU** and **All Wales Sport** by name. That is **no longer** the active model.

**Current model (as of 2026‑02‑09):**

- **No cross‑source dedupe.** Identity is `(source, source_ref)` only.
- **MyWRU is authoritative** for WRU competitions.
- **All Wales Sport is allowlisted** for non‑WRU competitions only (e.g. BUCS).
- The app list reads from `competitions_deduped`, which now filters AllWalesSport by allowlist rather than merging by logical league name.

**"Default" names:** Competitions with `name = 'Default'` come from **MyWRU** (API/discovery supplies that label for some groups). The app shows them as "Competition {source_ref}" in the Competitions list so users do not see "Default". Ingestion logs a warning when writing a competition with label "Default" so `source_ref` can be traced.

**Same-source duplicates:** Rows from the same source with the same name (e.g. multiple "Division 2 Cup" from allwalessport with different cids) are intentionally collapsed to one row per logical league name. If we need to distinguish by cid later, the view can be extended.

## Verify current selection

Run in Supabase SQL editor to confirm the view returns one row per league and prefers MyWRU for cross-source pairs:

```sql
SELECT id, name, slug, source, source_ref
FROM competitions_deduped
WHERE name IN ('Championship', 'Division 1', 'East Wales')
ORDER BY name;
```

Expect **MyWRU** rows for WRU leagues and **AllWalesSport** rows only when the competition is allowlisted. The view should not merge by name.

## Phase 1: Diagnostic queries

Run these in the Supabase SQL editor (or any Postgres client) after both sources have been ingested.

### List all sourced competitions (for manual review)

```sql
SELECT id, name, slug, source, source_ref, competition_type
FROM competitions
WHERE source IS NOT NULL
ORDER BY lower(trim(name)), source;
```

### Find duplicate pairs by normalised name

Uses the same normalisation as the view: lowercase, trim, strip leading `wru ` so "WRU Premiership" and "Premiership" group together.

```sql
WITH normalised AS (
  SELECT id, name, slug, source,
    regexp_replace(lower(trim(name)), '^wru +', '') AS key
  FROM competitions
  WHERE source IS NOT NULL
),
grouped AS (
  SELECT key, count(*) AS n, array_agg(id) AS ids, array_agg(source) AS sources
  FROM normalised
  GROUP BY key
  HAVING count(*) > 1
)
SELECT g.key, g.n, g.ids, g.sources,
  (SELECT json_agg(n.name || ' (' || n.source || ')') FROM normalised n WHERE n.key = g.key) AS names
FROM grouped g
ORDER BY g.key;
```

### Outcome to document

- **Duplicate pairs:** Note which logical keys have both `mywru` and `allwalessport`; the view will show only the MyWRU row for those.
- **Single-source leagues:** Keys with one row stay as-is (All Wales Sport–only or MyWRU-only).
- **Name variants:** If two names differ but should be the same league, the normalisation (strip leading `wru `) handles common cases; for others, consider adding a mapping table later.

## Implementation (historical)

- **View:** `competitions_deduped` now **filters** AllWalesSport by allowlist and does **not** merge sources (see `20260209120000_competitions_no_cross_source_dedupe.sql`).
- **App:** [useCompetitions.ts](../features/competitions/useCompetitions.ts) still selects from `competitions_deduped`.
