-- Add standing/result entity types and processed_status for parse stage.
-- File: supabase/migrations/20260202230000_ingest_items_processed_status.sql

DO $$ BEGIN
  ALTER TYPE ingest_entity_type ADD VALUE 'standing';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE ingest_entity_type ADD VALUE 'result';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.ingest_items
  ADD COLUMN IF NOT EXISTS processed_status TEXT NOT NULL DEFAULT 'new';

CREATE INDEX IF NOT EXISTS idx_ingest_items_processed_status
  ON public.ingest_items(processed_status) WHERE processed_status = 'new';
