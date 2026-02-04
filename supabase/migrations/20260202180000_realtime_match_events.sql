-- Enable Supabase Realtime for match_events and matches so clients can subscribe to live updates.
-- Idempotent: add table to publication only if not already a member (ignore duplicate_object).
-- File: supabase/migrations/20260202180000_realtime_match_events.sql

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
