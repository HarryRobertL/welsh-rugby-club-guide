-- Ingestion runs, items per run, and canonical provenance.
-- Depends on: ingest_sources, ingest_entity_type from ingestion_pipeline.
-- Idempotent: safe to re-run (CREATE TABLE/INDEX only if not exists).
-- File: supabase/migrations/20260202220000_ingest_runs_items_provenance.sql

-- One ingestion run per sync (source + status + timestamps)
CREATE TABLE IF NOT EXISTS public.ingest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.ingest_sources(id) ON DELETE CASCADE,
  status ingest_job_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingest_runs_source_id ON public.ingest_runs(source_id);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_status ON public.ingest_runs(status);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_created_at ON public.ingest_runs(created_at);

-- Items processed in a run (one row per external record in that run)
CREATE TABLE IF NOT EXISTS public.ingest_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.ingest_runs(id) ON DELETE CASCADE,
  entity_type ingest_entity_type NOT NULL,
  external_id TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingest_items_run_id ON public.ingest_items(run_id);
CREATE INDEX IF NOT EXISTS idx_ingest_items_entity_type ON public.ingest_items(run_id, entity_type);

-- Provenance: which canonical record came from which source/run/item
CREATE TABLE IF NOT EXISTS public.canonical_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type ingest_entity_type NOT NULL,
  canonical_id UUID NOT NULL,
  source_id UUID NOT NULL REFERENCES public.ingest_sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  run_id UUID REFERENCES public.ingest_runs(id) ON DELETE SET NULL,
  ingest_item_id UUID REFERENCES public.ingest_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, canonical_id)
);

CREATE INDEX IF NOT EXISTS idx_canonical_provenance_source_entity ON public.canonical_provenance(source_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_canonical_provenance_external ON public.canonical_provenance(source_id, entity_type, external_id);
CREATE INDEX IF NOT EXISTS idx_canonical_provenance_run_id ON public.canonical_provenance(run_id);
