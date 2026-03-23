-- Authorization hardening for users/pending_claims and club-claim review workflow.
-- File: supabase/migrations/20260212110000_authz_hardening_claims_and_roles.sql

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_claims ENABLE ROW LEVEL SECURITY;

-- Users can update only non-privileged fields on their own row.
-- Prevent self-promotion or self-assignment to a club from the client.
DROP POLICY IF EXISTS "Users can update own row" ON public.users;
CREATE POLICY "Users can update own row"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT u.role FROM public.users u WHERE u.id = auth.uid())
    AND club_id IS NOT DISTINCT FROM (SELECT u.club_id FROM public.users u WHERE u.id = auth.uid())
    AND created_at IS NOT DISTINCT FROM (SELECT u.created_at FROM public.users u WHERE u.id = auth.uid())
  );

-- Requesters may only create pending claims and cannot set review/audit fields.
DROP POLICY IF EXISTS "Users can request club claims" ON public.pending_claims;
CREATE POLICY "Users can request club claims"
  ON public.pending_claims FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

-- Requesters can only edit their own pending request metadata and cannot alter status/review fields.
DROP POLICY IF EXISTS "Users can update their club claims" ON public.pending_claims;
CREATE POLICY "Users can update their club claims"
  ON public.pending_claims FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (
    auth.uid() = user_id
    AND id = (SELECT p.id FROM public.pending_claims p WHERE p.id = pending_claims.id)
    AND user_id = (SELECT p.user_id FROM public.pending_claims p WHERE p.id = pending_claims.id)
    AND status = (SELECT p.status FROM public.pending_claims p WHERE p.id = pending_claims.id)
    AND reviewed_by IS NOT DISTINCT FROM (SELECT p.reviewed_by FROM public.pending_claims p WHERE p.id = pending_claims.id)
    AND reviewed_at IS NOT DISTINCT FROM (SELECT p.reviewed_at FROM public.pending_claims p WHERE p.id = pending_claims.id)
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

-- League admins can review pending claims, but only by writing explicit reviewed state.
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
    AND status IN ('approved', 'rejected')
    AND reviewed_by = auth.uid()
    AND reviewed_at IS NOT NULL
  );

-- Single auditable server-side path for claim review and role escalation.
CREATE OR REPLACE FUNCTION public.review_pending_claim(
  claim_id_in UUID,
  decision_in TEXT
)
RETURNS public.pending_claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claim_row public.pending_claims%ROWTYPE;
  normalized_decision TEXT := lower(trim(decision_in));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF (SELECT role FROM public.users WHERE id = auth.uid()) <> 'league_admin' THEN
    RAISE EXCEPTION 'Not authorized to review claims'
      USING ERRCODE = '42501';
  END IF;

  IF normalized_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: %', decision_in
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO claim_row
  FROM public.pending_claims
  WHERE id = claim_id_in
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending claim not found: %', claim_id_in
      USING ERRCODE = 'P0002';
  END IF;

  IF claim_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Pending claim already reviewed: %', claim_id_in
      USING ERRCODE = 'P0001';
  END IF;

  IF normalized_decision = 'approved' THEN
    UPDATE public.users
    SET role = 'club_admin',
        club_id = claim_row.club_id
    WHERE id = claim_row.user_id;
  END IF;

  UPDATE public.pending_claims
  SET status = normalized_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = claim_id_in
  RETURNING *
  INTO claim_row;

  RETURN claim_row;
END;
$$;

REVOKE ALL ON FUNCTION public.review_pending_claim(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_pending_claim(UUID, TEXT) TO authenticated;
