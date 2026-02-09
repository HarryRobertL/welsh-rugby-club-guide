-- Add published flag to match_lineups for supporter visibility.
-- File: supabase/migrations/20260209123000_match_lineups_published.sql

ALTER TABLE public.match_lineups
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;

UPDATE public.match_lineups
  SET published = true
  WHERE published IS FALSE;
