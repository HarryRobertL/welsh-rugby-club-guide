-- Pack D: Reconcile ingestion and app needs with existing core schema (non-destructive).
-- Adds missing columns, mapping tables, and indexes only. No table creation for core entities, no drops, no renames.
-- File: supabase/migrations/20260202240000_pack_d_reconcile_core_schema.sql
--
-- Canonical upsert targets (use EXISTING core tables only):
--   - public.teams: id, club_id, name, slug, team_type; resolve names via source_team_map(source, source_team_name) -> team_id.
--   - public.fixtures: id, competition_group_id, season_id, source_match_ref, home_team_id, away_team_id, venue_id, scheduled_at, status; unique (competition_group_id, source_match_ref).
--   - public.matches: fixture_id, score_home, score_away (1:1 with fixture).
--   - public.match_events: match_id, fixture_id (denormalized), minute, event_type, payload.
--   - public.standings: competition_group_id, season_id, team_id, position, played, won, drawn, lost, points_for, points_against, points, updated_at.
--   - source_competition_group_map: resolve (source, source_group_id) -> competition_group_id (UUID; may map to season_id or future competition_groups.id).

-- ---------------------------------------------------------------------------
-- 1) Missing columns (only if absent)
-- ---------------------------------------------------------------------------

-- teams.slug (unique) — for URLs and ingestion lookups
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_slug ON public.teams(slug) WHERE slug IS NOT NULL;

-- fixtures: status already exists (fixture_status). Add source_match_ref + competition_group_id for ingestion idempotency.
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS competition_group_id UUID;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS source_match_ref TEXT;
-- Unique per competition_group (partial: only when both set)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fixtures_competition_group_source_match_ref
  ON public.fixtures(competition_group_id, source_match_ref)
  WHERE competition_group_id IS NOT NULL AND source_match_ref IS NOT NULL;

-- standings.updated_at
ALTER TABLE public.standings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
-- standings.competition_group_id — for grouping and index (optional; ingestion may key by season_id)
ALTER TABLE public.standings ADD COLUMN IF NOT EXISTS competition_group_id UUID;

-- match_events.fixture_id — for “events by fixture” and realtime subscriptions by fixture
ALTER TABLE public.match_events ADD COLUMN IF NOT EXISTS fixture_id UUID REFERENCES public.fixtures(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 2) Mapping tables (only if missing)
-- ---------------------------------------------------------------------------

-- source_team_map: external source + team name -> canonical teams.id
CREATE TABLE IF NOT EXISTS public.source_team_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_team_name TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_team_name)
);
CREATE INDEX IF NOT EXISTS idx_source_team_map_source ON public.source_team_map(source);
CREATE INDEX IF NOT EXISTS idx_source_team_map_team_id ON public.source_team_map(team_id);

-- source_competition_group_map: external source + group id -> canonical competition_group_id (UUID; FK optional later)
CREATE TABLE IF NOT EXISTS public.source_competition_group_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_group_id TEXT NOT NULL,
  competition_group_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_group_id)
);
CREATE INDEX IF NOT EXISTS idx_source_competition_group_map_source ON public.source_competition_group_map(source);
CREATE INDEX IF NOT EXISTS idx_source_competition_group_map_competition_group ON public.source_competition_group_map(competition_group_id);

-- ---------------------------------------------------------------------------
-- 3) Indexes for performance
-- ---------------------------------------------------------------------------

-- Fixtures: by competition_group + time (use scheduled_at; kickoff_at not in core)
CREATE INDEX IF NOT EXISTS idx_fixtures_competition_group_scheduled
  ON public.fixtures(competition_group_id, scheduled_at)
  WHERE competition_group_id IS NOT NULL;

-- Standings: by competition_group
CREATE INDEX IF NOT EXISTS idx_standings_competition_group_id
  ON public.standings(competition_group_id)
  WHERE competition_group_id IS NOT NULL;

-- Match events: by fixture (for match centre and realtime)
CREATE INDEX IF NOT EXISTS idx_match_events_fixture_id
  ON public.match_events(fixture_id)
  WHERE fixture_id IS NOT NULL;
