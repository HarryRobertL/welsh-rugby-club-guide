-- Step 1: Remove cross-source dedupe for Welsh competitions.
-- Identity is (source, source_ref). Never match competitions by slug or name.
-- List shows: all mywru, all sixnations, all allwalessport (allowlisted only after Step 2 ingestion filter).
-- Source priority for display order: mywru (1), sixnations (2), allwalessport (3), unsourced (4).

CREATE OR REPLACE VIEW public.competitions_deduped AS
SELECT id, name, slug, competition_type, source, source_ref
FROM public.competitions
WHERE source IS NULL
   OR source = 'mywru'
   OR source = 'sixnations'
   OR source = 'allwalessport';

GRANT SELECT ON public.competitions_deduped TO anon;
GRANT SELECT ON public.competitions_deduped TO authenticated;
