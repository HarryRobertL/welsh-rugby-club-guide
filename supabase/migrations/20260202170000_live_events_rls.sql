-- RLS for match_events and matches: club_admin can insert/delete events and update match score/status.
-- Idempotent: drop policies if they exist, then create.
-- File: supabase/migrations/20260202170000_live_events_rls.sql

-- Helper: true if current user is club_admin for this match (fixture's home or away team is user's club)
CREATE OR REPLACE FUNCTION public.match_belongs_to_user_club(match_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'club_admin'
    AND (SELECT club_id FROM public.users WHERE id = auth.uid()) IS NOT NULL
    AND (
      (SELECT club_id FROM public.teams WHERE id = (SELECT home_team_id FROM public.fixtures WHERE id = (SELECT fixture_id FROM public.matches WHERE id = match_uuid))) = (SELECT club_id FROM public.users WHERE id = auth.uid())
      OR
      (SELECT club_id FROM public.teams WHERE id = (SELECT away_team_id FROM public.fixtures WHERE id = (SELECT fixture_id FROM public.matches WHERE id = match_uuid))) = (SELECT club_id FROM public.users WHERE id = auth.uid())
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- match_events: anyone can read; club_admin for that match can insert/delete (for live entry and undo)
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read match events" ON public.match_events;
CREATE POLICY "Anyone can read match events"
  ON public.match_events FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Club admin can insert events for own club match" ON public.match_events;
CREATE POLICY "Club admin can insert events for own club match"
  ON public.match_events FOR INSERT
  WITH CHECK (public.match_belongs_to_user_club(match_id));

DROP POLICY IF EXISTS "Club admin can delete own club match events (undo)" ON public.match_events;
CREATE POLICY "Club admin can delete own club match events (undo)"
  ON public.match_events FOR DELETE
  USING (public.match_belongs_to_user_club(match_id));

-- matches: club_admin for that match can update (score, status)
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read matches" ON public.matches;
CREATE POLICY "Anyone can read matches"
  ON public.matches FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Club admin can update own club match (score, status)" ON public.matches;
CREATE POLICY "Club admin can update own club match (score, status)"
  ON public.matches FOR UPDATE
  USING (public.match_belongs_to_user_club(id))
  WITH CHECK (public.match_belongs_to_user_club(id));
