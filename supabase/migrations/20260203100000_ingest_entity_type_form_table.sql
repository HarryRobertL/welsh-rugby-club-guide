-- Add form_table to ingest_entity_type for AllWalesSport and similar sources.
-- File: supabase/migrations/20260203100000_ingest_entity_type_form_table.sql

DO $$ BEGIN
  ALTER TYPE ingest_entity_type ADD VALUE 'form_table';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
