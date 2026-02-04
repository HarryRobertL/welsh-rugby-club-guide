-- MyWRU discovery: competition instances, groups, and group endpoint paths.
-- No RLS yet.
-- File: supabase/migrations/20260202010000_mywru_discovery.sql

-- Competition instances (e.g. WRU Mens Admiral National Leagues)
CREATE TABLE mywru_competition_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_instance_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Competition groups within an instance (e.g. division, pool)
CREATE TABLE mywru_competition_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_group_id TEXT NOT NULL UNIQUE,
  competition_instance_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mywru_competition_groups_instance
  ON mywru_competition_groups (competition_instance_id);

-- Discovered endpoint paths per group (table, fixtures, results, details)
CREATE TABLE mywru_group_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_group_id TEXT NOT NULL,
  table_path TEXT,
  fixtures_path TEXT,
  results_path TEXT,
  details_path TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mywru_group_endpoints_group
  ON mywru_group_endpoints (competition_group_id);
