-- Ingestion pipeline scaffolding: raw ingest tables, normalized mapping tables, background job placeholder.
-- Idempotent: safe to re-run (CREATE TYPE/TABLE/INDEX only if not exists).
-- File: supabase/migrations/20260202200000_ingestion_pipeline.sql

-- Entity types we can ingest from external sources (extend as needed)
DO $$ BEGIN
  CREATE TYPE ingest_entity_type AS ENUM ('team', 'fixture', 'competition', 'venue', 'season');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Job status for background ingestion
DO $$ BEGIN
  CREATE TYPE ingest_job_status AS ENUM ('pending', 'running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sources of external data (e.g. future WRU API, league feed)
CREATE TABLE IF NOT EXISTS ingest_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Raw ingest: one row per record pulled from an external source (payload as-is)
CREATE TABLE IF NOT EXISTS raw_ingest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES ingest_sources(id) ON DELETE CASCADE,
  entity_type ingest_entity_type NOT NULL,
  external_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (source_id, entity_type, external_id)
);

-- Normalized mapping: external team -> our teams table
CREATE TABLE IF NOT EXISTS team_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES ingest_sources(id) ON DELETE CASCADE,
  external_team_id TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_team_id)
);

-- Optional: mapping for other entities (fixture, venue, competition, season) when sources are added
CREATE TABLE IF NOT EXISTS entity_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES ingest_sources(id) ON DELETE CASCADE,
  entity_type ingest_entity_type NOT NULL,
  external_id TEXT NOT NULL,
  our_table TEXT NOT NULL,
  our_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, entity_type, external_id)
);

-- Background job queue: placeholder for cron or worker to poll
CREATE TABLE IF NOT EXISTS ingest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  status ingest_job_status NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_ingest_source_entity ON raw_ingest(source_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_raw_ingest_processed ON raw_ingest(processed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_team_mapping_source ON team_mapping(source_id);
CREATE INDEX IF NOT EXISTS idx_team_mapping_team ON team_mapping(team_id);
CREATE INDEX IF NOT EXISTS idx_entity_mapping_source_type ON entity_mapping(source_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_status_scheduled ON ingest_jobs(status, scheduled_at);
