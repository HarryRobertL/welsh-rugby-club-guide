-- Fix RLS recursion in pending_claims policy and enforce privileged user field protection safely.
-- File: supabase/migrations/20260212124000_authz_hardening_recursion_fix.sql

-- Helper: role lookup for current app user (SECURITY DEFINER to avoid policy recursion).
CREATE OR REPLACE FUNCTION public.current_app_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.role::text
  FROM public.users u
  WHERE u.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_app_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_user_role() TO authenticated;

-- Keep users update scope to own row; privileged fields are guarded by trigger below.
DROP POLICY IF EXISTS "Users can update own row" ON public.users;
CREATE POLICY "Users can update own row"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger-based privileged field guard avoids recursive self-selects in RLS policy.
CREATE OR REPLACE FUNCTION public.enforce_user_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id AND COALESCE(public.current_app_user_role(), '') <> 'league_admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.club_id IS DISTINCT FROM OLD.club_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Not allowed to update privileged user fields'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_privileged_fields ON public.users;
CREATE TRIGGER trg_enforce_user_privileged_fields
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_privileged_fields();

-- Non-recursive requester update policy for pending_claims.
DROP POLICY IF EXISTS "Users can update their club claims" ON public.pending_claims;
CREATE POLICY "Users can update their club claims"
  ON public.pending_claims FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );
