-- Harden competition identity for external sources (AllWalesSport cid).
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_ref TEXT;

-- Ensure uniqueness when both source and source_ref are present.
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitions_source_source_ref_unique
  ON public.competitions(source, source_ref)
  WHERE source IS NOT NULL AND source_ref IS NOT NULL;

-- Provide a normal index for faster lookups by (source, source_ref).
CREATE INDEX IF NOT EXISTS idx_competitions_source_source_ref
  ON public.competitions(source, source_ref);
