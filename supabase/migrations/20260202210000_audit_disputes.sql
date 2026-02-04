-- Audit logging: admin action_type; match_disputes table. No moderation logic yet.
-- File: supabase/migrations/20260202210000_audit_disputes.sql

-- Optional label for admin actions (lineup_published, score_update, match_full_time, event_undo, etc.)
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS action_type TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON public.audit_log(action_type);

-- Match disputes: users can submit; no moderation logic yet
DO $$
BEGIN
  IF to_regtype('public.dispute_status') IS NULL THEN
    CREATE TYPE public.dispute_status AS ENUM ('open', 'resolved');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.match_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status public.dispute_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_match_disputes_match_id ON public.match_disputes(match_id);
CREATE INDEX IF NOT EXISTS idx_match_disputes_submitted_by ON public.match_disputes(submitted_by);
CREATE INDEX IF NOT EXISTS idx_match_disputes_status ON public.match_disputes(status);

ALTER TABLE public.match_disputes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can submit a dispute (insert own)
DROP POLICY IF EXISTS "Authenticated can submit dispute" ON public.match_disputes;
CREATE POLICY "Authenticated can submit dispute"
  ON public.match_disputes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = submitted_by);

-- Users can read their own disputes
DROP POLICY IF EXISTS "Users can read own disputes" ON public.match_disputes;
CREATE POLICY "Users can read own disputes"
  ON public.match_disputes FOR SELECT
  USING (auth.uid() = submitted_by);
