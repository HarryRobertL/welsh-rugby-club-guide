-- Competitions list: one row per logical league; when both MyWRU and AllWalesSport
-- have the same league (same logical_league_key), keep only the MyWRU row.
-- Exposes source and source_ref for app display overrides (getCompetitionDisplayName).

CREATE OR REPLACE VIEW public.competitions_deduped AS
WITH with_key AS (
  SELECT c.id, c.name, c.slug, c.competition_type, c.source, c.source_ref,
    public.logical_league_key(c.name) AS lkey
  FROM public.competitions c
),
ranked AS (
  SELECT id, name, slug, competition_type, source, source_ref,
    row_number() OVER (
      PARTITION BY lkey
      ORDER BY (source = 'mywru') DESC NULLS LAST, name
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

GRANT SELECT ON public.competitions_deduped TO anon;
GRANT SELECT ON public.competitions_deduped TO authenticated;
