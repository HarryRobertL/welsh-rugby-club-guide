-- RLS for public.favourites: users can read/insert/delete own rows only.
-- Idempotent: drop policies if they exist, then create.
-- File: supabase/migrations/20260202140000_rls_favourites.sql

ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own favourites" ON public.favourites;
CREATE POLICY "Users can read own favourites"
  ON public.favourites FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own favourites" ON public.favourites;
CREATE POLICY "Users can insert own favourites"
  ON public.favourites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own favourites" ON public.favourites;
CREATE POLICY "Users can delete own favourites"
  ON public.favourites FOR DELETE
  USING (auth.uid() = user_id);
