-- Competition categories for All Wales Sport nav hierarchy
CREATE TABLE IF NOT EXISTS public.competition_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id UUID REFERENCES public.competition_categories(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_competition_categories_source_slug
  ON public.competition_categories(source, slug);
CREATE INDEX IF NOT EXISTS idx_competition_categories_parent_id
  ON public.competition_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_competition_categories_source
  ON public.competition_categories(source);

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.competition_categories(id) ON DELETE SET NULL;
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
