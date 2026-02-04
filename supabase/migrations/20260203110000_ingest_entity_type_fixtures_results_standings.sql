-- Add fixtures, results, standings to ingest_entity_type for AllWalesSport payloads.
-- File: supabase/migrations/20260203110000_ingest_entity_type_fixtures_results_standings.sql

DO $$ BEGIN
  ALTER TYPE ingest_entity_type ADD VALUE 'fixtures';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE ingest_entity_type ADD VALUE 'results';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE ingest_entity_type ADD VALUE 'standings';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
