-- Club admin: users.club_id (claimed club); RLS for match_lineups and audit_log.
-- Idempotent: drop policies if they exist, then create.
-- File: supabase/migrations/20260202160000_club_admin_lineups.sql

-- Link club_admin to a club (claim club)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_club_id ON public.users(club_id);

-- match_lineups: anyone can read; only club_admin for that team's club can insert/update/delete
ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read match lineups" ON public.match_lineups;
CREATE POLICY "Anyone can read match lineups"
  ON public.match_lineups FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Club admin can insert own club lineups" ON public.match_lineups;
CREATE POLICY "Club admin can insert own club lineups"
  ON public.match_lineups FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'club_admin'
    AND (SELECT club_id FROM public.users WHERE id = auth.uid()) IS NOT NULL
    AND (SELECT club_id FROM public.users WHERE id = auth.uid()) = (SELECT club_id FROM public.teams WHERE id = team_id)
  );

DROP POLICY IF EXISTS "Club admin can update own club lineups" ON public.match_lineups;
CREATE POLICY "Club admin can update own club lineups"
  ON public.match_lineups FOR UPDATE
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'club_admin'
    AND (SELECT club_id FROM public.users WHERE id = auth.uid()) = (SELECT club_id FROM public.teams WHERE id = team_id)
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'club_admin'
    AND (SELECT club_id FROM public.users WHERE id = auth.uid()) = (SELECT club_id FROM public.teams WHERE id = team_id)
  );

DROP POLICY IF EXISTS "Club admin can delete own club lineups" ON public.match_lineups;
CREATE POLICY "Club admin can delete own club lineups"
  ON public.match_lineups FOR DELETE
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'club_admin'
    AND (SELECT club_id FROM public.users WHERE id = auth.uid()) = (SELECT club_id FROM public.teams WHERE id = team_id)
  );

-- audit_log: allow authenticated insert (for lineup_published etc.)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can insert audit log" ON public.audit_log;
CREATE POLICY "Authenticated can insert audit log"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can read audit log" ON public.audit_log;
CREATE POLICY "Authenticated can read audit log"
  ON public.audit_log FOR SELECT
  USING (auth.uid() IS NOT NULL);
