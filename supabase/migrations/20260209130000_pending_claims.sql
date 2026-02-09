-- Pending club claim requests (approval workflow).
-- File: supabase/migrations/20260209130000_pending_claims.sql

CREATE TABLE IF NOT EXISTS public.pending_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  requester_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_claims_user_id ON public.pending_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_claims_status ON public.pending_claims(status);

ALTER TABLE public.pending_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their pending claims" ON public.pending_claims;
CREATE POLICY "Users can view their pending claims"
  ON public.pending_claims FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can request club claims" ON public.pending_claims;
CREATE POLICY "Users can request club claims"
  ON public.pending_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their club claims" ON public.pending_claims;
CREATE POLICY "Users can update their club claims"
  ON public.pending_claims FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
