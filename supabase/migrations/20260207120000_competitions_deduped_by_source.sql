-- Step 5: Do not merge competitions across sources by name.
-- One row per (source, logical_league_key). AllWalesSport "Division 1" and MyWRU "West Central 3" never merge.
-- View exposes source and source_ref for app display overrides.

CREATE OR REPLACE VIEW public.competitions_deduped AS
WITH with_key AS (
  SELECT c.id, c.name, c.slug, c.competition_type, c.source, c.source_ref,
    public.logical_league_key(c.name) AS lkey
  FROM public.competitions c
),
ranked AS (
  SELECT id, name, slug, competition_type, source, source_ref,
    row_number() OVER (
      PARTITION BY source, lkey
      ORDER BY name
    ) AS rn
  FROM with_key
  WHERE source IS NOT NULL
),
deduped_sourced AS (
  SELECT id, name, slug, competition_type, source, source_ref
  FROM ranked
  WHERE rn = 1
),
unsourced AS (
  SELECT id, name, slug, competition_type, source, source_ref
  FROM public.competitions
  WHERE source IS NULL
)
SELECT * FROM deduped_sourced
UNION ALL
SELECT * FROM unsourced
ORDER BY name;
