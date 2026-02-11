-- Add source/source_ref for competition identity (AllWalesSport cid).
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_competitions_source_source_ref
  ON public.competitions(source, source_ref)
  WHERE source IS NOT NULL AND source_ref IS NOT NULL;

-- Backfill AllWalesSport by slug pattern when possible.
UPDATE public.competitions
SET source = 'allwalessport',
    source_ref = regexp_replace(slug, '^allwalessport-', '')
WHERE source IS NULL
  AND source_ref IS NULL
  AND slug LIKE 'allwalessport-%';
