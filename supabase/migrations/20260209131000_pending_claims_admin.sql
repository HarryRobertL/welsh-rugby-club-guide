-- Allow league admins to review pending club claims and update users.
-- File: supabase/migrations/20260209131000_pending_claims_admin.sql

DROP POLICY IF EXISTS "League admins can view pending claims" ON public.pending_claims;
CREATE POLICY "League admins can view pending claims"
  ON public.pending_claims FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'league_admin'
  );

DROP POLICY IF EXISTS "League admins can update pending claims" ON public.pending_claims;
CREATE POLICY "League admins can update pending claims"
  ON public.pending_claims FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'league_admin'
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'league_admin'
  );

DROP POLICY IF EXISTS "League admins can update users" ON public.users;
CREATE POLICY "League admins can update users"
  ON public.users FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'league_admin'
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'league_admin'
  );
