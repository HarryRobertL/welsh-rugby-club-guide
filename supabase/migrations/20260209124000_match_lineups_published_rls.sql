-- Restrict match_lineups SELECT to published rows, with club_admin access.
-- File: supabase/migrations/20260209124000_match_lineups_published_rls.sql

ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read match lineups" ON public.match_lineups;
DROP POLICY IF EXISTS "Published lineups or club admin can read match lineups" ON public.match_lineups;
CREATE POLICY "Published lineups or club admin can read match lineups"
  ON public.match_lineups FOR SELECT
  USING (
    published = true
    OR (
      auth.uid() IS NOT NULL
      AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'club_admin'
      AND (SELECT club_id FROM public.users WHERE id = auth.uid()) = (SELECT club_id FROM public.teams WHERE id = team_id)
    )
  );
