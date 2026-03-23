-- Authorization hardening verification script (manual).
-- File: supabase/snippets/authorization_hardening_checks.sql
--
-- Run in Supabase SQL editor or psql with a privileged role that can SET ROLE.
-- Replace UUID placeholders before running.

BEGIN;

-- Inputs (replace these test IDs):
--   supporter_user_id: normal authenticated user with role='supporter'
--   league_admin_user_id: authenticated user with role='league_admin'
--   target_club_id: club the supporter is requesting
--   claim_id: existing pending claim for supporter_user_id, or leave NULL and create one below
DO $$
DECLARE
  supporter_user_id UUID := 'bb4be041-ea5b-4ddd-b6a4-e0e2fce3b51b';
  second_supporter_user_id UUID := 'd3e3056e-a156-4aea-b3cc-94a0df296154';
  league_admin_user_id UUID := '9d46bbed-a0f2-429a-8c97-bba3a2632c56';
  target_club_id UUID := '01446e18-e838-4a88-91d0-277e3acade25'; -- WRU club id backing Burry Port RFC teams
  created_claim_id UUID;
  rejected_claim_id UUID;
BEGIN
  -- 1) Supporter cannot self-promote to club_admin.
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', supporter_user_id::text, true);

  BEGIN
    UPDATE public.users
    SET role = 'club_admin'
    WHERE id = supporter_user_id;
    RAISE EXCEPTION 'FAIL: supporter was able to self-promote role';
  EXCEPTION
    WHEN OTHERS THEN
      -- expected: blocked by RLS WITH CHECK
      NULL;
  END;

  -- 2) Supporter can submit a claim, but cannot set reviewed/status fields.
  INSERT INTO public.pending_claims (user_id, club_id, requester_email, status)
  VALUES (supporter_user_id, target_club_id, 'supporter@example.com', 'pending')
  ON CONFLICT (user_id)
  DO UPDATE
    SET club_id = EXCLUDED.club_id,
        requester_email = EXCLUDED.requester_email;

  SELECT id
  INTO created_claim_id
  FROM public.pending_claims
  WHERE user_id = supporter_user_id;

  BEGIN
    UPDATE public.pending_claims
    SET status = 'approved'
    WHERE id = created_claim_id;
    RAISE EXCEPTION 'FAIL: supporter was able to mutate claim status';
  EXCEPTION
    WHEN OTHERS THEN
      -- expected: blocked by RLS WITH CHECK
      NULL;
  END;

  -- 3) League admin approve path updates user role + claim status.
  PERFORM set_config('request.jwt.claim.sub', league_admin_user_id::text, true);
  PERFORM public.review_pending_claim(created_claim_id, 'approved');

  IF (SELECT role FROM public.users WHERE id = supporter_user_id) <> 'club_admin' THEN
    RAISE EXCEPTION 'FAIL: approved claim did not promote user to club_admin';
  END IF;

  IF (SELECT status FROM public.pending_claims WHERE id = created_claim_id) <> 'approved' THEN
    RAISE EXCEPTION 'FAIL: approved claim status was not persisted';
  END IF;

  -- 4) League admin reject path sets rejected status and does not promote role.
  PERFORM set_config('request.jwt.claim.sub', second_supporter_user_id::text, true);
  INSERT INTO public.pending_claims (user_id, club_id, requester_email, status)
  VALUES (second_supporter_user_id, target_club_id, 'supporter2@example.com', 'pending')
  ON CONFLICT (user_id)
  DO UPDATE
    SET club_id = EXCLUDED.club_id,
        requester_email = EXCLUDED.requester_email;

  SELECT id
  INTO rejected_claim_id
  FROM public.pending_claims
  WHERE user_id = second_supporter_user_id;

  PERFORM set_config('request.jwt.claim.sub', league_admin_user_id::text, true);
  PERFORM public.review_pending_claim(rejected_claim_id, 'rejected');

  IF (SELECT status FROM public.pending_claims WHERE id = rejected_claim_id) <> 'rejected' THEN
    RAISE EXCEPTION 'FAIL: rejected claim status was not persisted';
  END IF;

  IF (SELECT role FROM public.users WHERE id = second_supporter_user_id) <> 'supporter' THEN
    RAISE EXCEPTION 'FAIL: rejected claim changed supporter role unexpectedly';
  END IF;

  -- 5) Re-review is blocked once already reviewed.
  BEGIN
    PERFORM public.review_pending_claim(created_claim_id, 'rejected');
    RAISE EXCEPTION 'FAIL: reviewed claim was reviewed a second time';
  EXCEPTION
    WHEN OTHERS THEN
      -- expected: function rejects non-pending claims
      NULL;
  END;
END $$;

ROLLBACK;
