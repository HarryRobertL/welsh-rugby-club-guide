-- Deduplicated competitions list: one row per logical league, prefer MyWRU when both sources exist.
-- Used by the app Competitions tab so the same league does not appear twice (MyWRU + All Wales Sport).
-- See docs/DEDUPE_COMPETITIONS.md for diagnostic queries and rationale.

-- Normalise competition name to a logical key for grouping.
-- Strips leading "wru " so "WRU Premiership" and "Premiership" map to the same key;
-- does not strip "cup" / "championship" etc. so "WRU Championship" and "WRU Championship Cup" stay distinct.
CREATE OR REPLACE FUNCTION public.logical_league_key(name_in text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(trim(coalesce(name_in, ''))), '^wru +', '');
$$;

-- View: one row per logical league. When both mywru and allwalessport have a row for the same key,
-- we keep only the mywru row. Competitions with source IS NULL (legacy) are included as-is.
CREATE OR REPLACE VIEW public.competitions_deduped AS
WITH with_key AS (
  SELECT c.id, c.name, c.slug, c.competition_type, c.source,
    public.logical_league_key(c.name) AS lkey
  FROM public.competitions c
),
ranked AS (
  SELECT id, name, slug, competition_type,
    row_number() OVER (
      PARTITION BY lkey
      ORDER BY (source = 'mywru') DESC NULLS LAST, name
    ) AS rn
  FROM with_key
  WHERE source IS NOT NULL
),
deduped_sourced AS (
  SELECT id, name, slug, competition_type
  FROM ranked
  WHERE rn = 1
),
unsourced AS (
  SELECT id, name, slug, competition_type
  FROM public.competitions
  WHERE source IS NULL
)
SELECT * FROM deduped_sourced
UNION ALL
SELECT * FROM unsourced
ORDER BY name;

-- Allow anon and authenticated to read the view (RLS on underlying competitions still applies when view is queried).
GRANT SELECT ON public.competitions_deduped TO anon;
GRANT SELECT ON public.competitions_deduped TO authenticated;
