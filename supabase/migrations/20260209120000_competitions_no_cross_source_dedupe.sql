-- Enforce canonical competitions list:
-- - MyWRU always included (authoritative for WRU leagues).
-- - Six Nations included.
-- - AllWalesSport included only for explicit allowlisted non-WRU competitions.
-- - Identity is (source, source_ref); never dedupe across sources.
--
-- Also reattach seasons from non-allowlisted AllWalesSport competitions
-- to MyWRU competitions when a logical equivalent exists.

-- 1) Allowlist table for AllWalesSport competition CIDs (source_ref).
CREATE TABLE IF NOT EXISTS public.allwalessport_allowlist (
  source_ref TEXT PRIMARY KEY,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed allowlist from known non-WRU names (from ingestion/config/allwalessport.json).
INSERT INTO public.allwalessport_allowlist (source_ref, name)
SELECT c.source_ref, c.name
FROM public.competitions c
WHERE c.source = 'allwalessport'
  AND c.source_ref IS NOT NULL
  AND c.name IN (
    'BUCS (Men)',
    'BUCS (Women)',
    'Tier 1 Women',
    '6 Nations 2026',
    '6 Nations U20',
    'Autumn Series - Men',
    'B & I Lions',
    'Friendlies - Men',
    'Friendlies - Women',
    'Internationals',
    'Summer Series - Men',
    'Summer Series - Women',
    'Womens 6 Nations',
    'Gallagher Premiership',
    'RFU Championship',
    'Rugby Championship'
  )
ON CONFLICT (source_ref) DO NOTHING;

-- 2) Canonical competitions list: no cross-source dedupe.
CREATE OR REPLACE VIEW public.competitions_deduped AS
SELECT id, name, slug, competition_type, source, source_ref
FROM public.competitions
WHERE source IS NULL
   OR source = 'mywru'
   OR source = 'sixnations'
   OR (
     source = 'allwalessport'
     AND source_ref IN (SELECT source_ref FROM public.allwalessport_allowlist)
   )
ORDER BY name;

GRANT SELECT ON public.competitions_deduped TO anon;
GRANT SELECT ON public.competitions_deduped TO authenticated;

-- 3) Repair: move seasons from non-allowlisted AllWalesSport competitions
--    onto MyWRU competitions when a logical match exists and the target
--    does not already contain the same season name.
WITH aws AS (
  SELECT c.id, public.logical_league_key(c.name) AS lkey
  FROM public.competitions c
  WHERE c.source = 'allwalessport'
    AND c.source_ref NOT IN (SELECT source_ref FROM public.allwalessport_allowlist)
),
my AS (
  SELECT c.id, public.logical_league_key(c.name) AS lkey
  FROM public.competitions c
  WHERE c.source = 'mywru'
),
pairs AS (
  SELECT aws.id AS aws_id, my.id AS mywru_id
  FROM aws
  JOIN my ON my.lkey = aws.lkey
)
UPDATE public.seasons s
SET competition_id = p.mywru_id
FROM pairs p
WHERE s.competition_id = p.aws_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.seasons s2
    WHERE s2.competition_id = p.mywru_id
      AND s2.name = s.name
  );
