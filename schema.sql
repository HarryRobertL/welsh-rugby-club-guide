


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."audit_action" AS ENUM (
    'insert',
    'update',
    'delete'
);


ALTER TYPE "public"."audit_action" OWNER TO "postgres";


CREATE TYPE "public"."competition_type" AS ENUM (
    'men',
    'junior',
    'university'
);


ALTER TYPE "public"."competition_type" OWNER TO "postgres";


CREATE TYPE "public"."dispute_status" AS ENUM (
    'open',
    'resolved'
);


ALTER TYPE "public"."dispute_status" OWNER TO "postgres";


CREATE TYPE "public"."favourite_entity_type" AS ENUM (
    'team',
    'competition',
    'player',
    'fixture'
);


ALTER TYPE "public"."favourite_entity_type" OWNER TO "postgres";


CREATE TYPE "public"."fixture_status" AS ENUM (
    'scheduled',
    'live',
    'full_time',
    'postponed',
    'cancelled'
);


ALTER TYPE "public"."fixture_status" OWNER TO "postgres";


CREATE TYPE "public"."ingest_entity_type" AS ENUM (
    'team',
    'fixture',
    'competition',
    'venue',
    'season',
    'standing',
    'result',
    'form_table',
    'fixtures',
    'results',
    'standings'
);


ALTER TYPE "public"."ingest_entity_type" OWNER TO "postgres";


CREATE TYPE "public"."ingest_job_status" AS ENUM (
    'pending',
    'running',
    'completed',
    'failed'
);


ALTER TYPE "public"."ingest_job_status" OWNER TO "postgres";


CREATE TYPE "public"."match_event_type" AS ENUM (
    'try',
    'conversion',
    'penalty_goal',
    'drop_goal',
    'yellow_card',
    'red_card',
    'penalty_try',
    'sin_bin',
    'other'
);


ALTER TYPE "public"."match_event_type" OWNER TO "postgres";


CREATE TYPE "public"."push_platform" AS ENUM (
    'ios',
    'android'
);


ALTER TYPE "public"."push_platform" OWNER TO "postgres";


CREATE TYPE "public"."team_type" AS ENUM (
    'men',
    'junior',
    'university'
);


ALTER TYPE "public"."team_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'supporter',
    'club_admin',
    'referee',
    'league_admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."competition_counts"() RETURNS TABLE("competition_id" "uuid", "fixtures_count" integer, "standings_count" integer, "latest_season_id" "uuid")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    c.id AS competition_id,
    COALESCE(f.fixtures_count, 0) AS fixtures_count,
    COALESCE(st.standings_count, 0) AS standings_count,
    latest.latest_season_id
  FROM public.competitions c
  LEFT JOIN (
    SELECT s.competition_id, COUNT(*) AS fixtures_count
    FROM public.fixtures f
    JOIN public.seasons s ON s.id = f.competition_group_id
    GROUP BY s.competition_id
  ) f ON f.competition_id = c.id
  LEFT JOIN (
    SELECT s.competition_id, COUNT(*) AS standings_count
    FROM public.standings st
    JOIN public.seasons s ON s.id = st.competition_group_id
    GROUP BY s.competition_id
  ) st ON st.competition_id = c.id
  LEFT JOIN LATERAL (
    SELECT s.id AS latest_season_id
    FROM public.seasons s
    WHERE s.competition_id = c.id
    ORDER BY s.created_at DESC
    LIMIT 1
  ) latest ON true;
$$;


ALTER FUNCTION "public"."competition_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_belongs_to_user_club"("match_uuid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'club_admin'
    AND (SELECT club_id FROM public.users WHERE id = auth.uid()) IS NOT NULL
    AND (
      (SELECT club_id FROM public.teams WHERE id = (SELECT home_team_id FROM public.fixtures WHERE id = (SELECT fixture_id FROM public.matches WHERE id = match_uuid))) = (SELECT club_id FROM public.users WHERE id = auth.uid())
      OR
      (SELECT club_id FROM public.teams WHERE id = (SELECT away_team_id FROM public.fixtures WHERE id = (SELECT fixture_id FROM public.matches WHERE id = match_uuid))) = (SELECT club_id FROM public.users WHERE id = auth.uid())
    )
  );
$$;


ALTER FUNCTION "public"."match_belongs_to_user_club"("match_uuid" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "action" "public"."audit_action" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "actor_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "action_type" "text"
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."canonical_provenance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "public"."ingest_entity_type" NOT NULL,
    "canonical_id" "uuid" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "external_id" "text" NOT NULL,
    "run_id" "uuid",
    "ingest_item_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."canonical_provenance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clubs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "region_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clubs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competition_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "parent_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."competition_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "region_id" "uuid",
    "competition_type" "public"."competition_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "source" "text",
    "source_ref" "text"
);


ALTER TABLE "public"."competitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_mapping" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid" NOT NULL,
    "entity_type" "public"."ingest_entity_type" NOT NULL,
    "external_id" "text" NOT NULL,
    "our_table" "text" NOT NULL,
    "our_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entity_mapping" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favourites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entity_type" "public"."favourite_entity_type" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."favourites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fixtures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "home_team_id" "uuid" NOT NULL,
    "away_team_id" "uuid" NOT NULL,
    "venue_id" "uuid",
    "scheduled_at" timestamp with time zone NOT NULL,
    "status" "public"."fixture_status" DEFAULT 'scheduled'::"public"."fixture_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "competition_group_id" "uuid",
    "source_match_ref" "text",
    CONSTRAINT "fixtures_teams_different" CHECK (("home_team_id" <> "away_team_id"))
);


ALTER TABLE "public"."fixtures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingest_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "entity_type" "public"."ingest_entity_type" NOT NULL,
    "external_id" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_status" "text" DEFAULT 'new'::"text" NOT NULL
);


ALTER TABLE "public"."ingest_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingest_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_type" "text" NOT NULL,
    "status" "public"."ingest_job_status" DEFAULT 'pending'::"public"."ingest_job_status" NOT NULL,
    "scheduled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "result" "jsonb",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ingest_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingest_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid" NOT NULL,
    "status" "public"."ingest_job_status" DEFAULT 'pending'::"public"."ingest_job_status" NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ingest_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingest_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ingest_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_disputes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "submitted_by" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "public"."dispute_status" DEFAULT 'open'::"public"."dispute_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid"
);


ALTER TABLE "public"."match_disputes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "event_type" "public"."match_event_type" NOT NULL,
    "minute" integer,
    "payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fixture_id" "uuid"
);


ALTER TABLE "public"."match_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_lineups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "shirt_number" integer NOT NULL,
    "position" "text",
    "player_name" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."match_lineups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fixture_id" "uuid" NOT NULL,
    "status" "public"."fixture_status" DEFAULT 'scheduled'::"public"."fixture_status" NOT NULL,
    "score_home" integer DEFAULT 0 NOT NULL,
    "score_away" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mywru_competition_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competition_group_id" "text" NOT NULL,
    "competition_instance_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mywru_competition_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mywru_competition_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competition_instance_id" "text" NOT NULL,
    "label" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mywru_competition_instances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mywru_group_endpoints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competition_group_id" "text" NOT NULL,
    "table_path" "text",
    "fixtures_path" "text",
    "results_path" "text",
    "details_path" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mywru_group_endpoints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "platform" "public"."push_platform" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."raw_ingest" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid" NOT NULL,
    "entity_type" "public"."ingest_entity_type" NOT NULL,
    "external_id" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ingested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."raw_ingest" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."regions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."regions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competition_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."seasons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."source_competition_group_map" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "source_group_id" "text" NOT NULL,
    "competition_group_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."source_competition_group_map" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."source_team_map" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "source_team_name" "text" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."source_team_map" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."standings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "played" integer DEFAULT 0 NOT NULL,
    "won" integer DEFAULT 0 NOT NULL,
    "drawn" integer DEFAULT 0 NOT NULL,
    "lost" integer DEFAULT 0 NOT NULL,
    "points_for" integer DEFAULT 0 NOT NULL,
    "points_against" integer DEFAULT 0 NOT NULL,
    "points" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "competition_group_id" "uuid"
);


ALTER TABLE "public"."standings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_mapping" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid" NOT NULL,
    "external_team_id" "text" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_mapping" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "team_type" "public"."team_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "slug" "text"
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "role" "public"."user_role" DEFAULT 'supporter'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "club_id" "uuid",
    "notify_lineup_published" boolean DEFAULT true NOT NULL,
    "notify_score_change" boolean DEFAULT true NOT NULL,
    "notify_full_time" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "club_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."venues" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."canonical_provenance"
    ADD CONSTRAINT "canonical_provenance_entity_type_canonical_id_key" UNIQUE ("entity_type", "canonical_id");



ALTER TABLE ONLY "public"."canonical_provenance"
    ADD CONSTRAINT "canonical_provenance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."competition_categories"
    ADD CONSTRAINT "competition_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitions"
    ADD CONSTRAINT "competitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitions"
    ADD CONSTRAINT "competitions_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."entity_mapping"
    ADD CONSTRAINT "entity_mapping_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_mapping"
    ADD CONSTRAINT "entity_mapping_source_id_entity_type_external_id_key" UNIQUE ("source_id", "entity_type", "external_id");



ALTER TABLE ONLY "public"."favourites"
    ADD CONSTRAINT "favourites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favourites"
    ADD CONSTRAINT "favourites_user_id_entity_type_entity_id_key" UNIQUE ("user_id", "entity_type", "entity_id");



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingest_items"
    ADD CONSTRAINT "ingest_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingest_jobs"
    ADD CONSTRAINT "ingest_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingest_runs"
    ADD CONSTRAINT "ingest_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingest_sources"
    ADD CONSTRAINT "ingest_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingest_sources"
    ADD CONSTRAINT "ingest_sources_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."match_disputes"
    ADD CONSTRAINT "match_disputes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "match_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_lineups"
    ADD CONSTRAINT "match_lineups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_fixture_id_key" UNIQUE ("fixture_id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mywru_competition_groups"
    ADD CONSTRAINT "mywru_competition_groups_competition_group_id_key" UNIQUE ("competition_group_id");



ALTER TABLE ONLY "public"."mywru_competition_groups"
    ADD CONSTRAINT "mywru_competition_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mywru_competition_instances"
    ADD CONSTRAINT "mywru_competition_instances_competition_instance_id_key" UNIQUE ("competition_instance_id");



ALTER TABLE ONLY "public"."mywru_competition_instances"
    ADD CONSTRAINT "mywru_competition_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mywru_group_endpoints"
    ADD CONSTRAINT "mywru_group_endpoints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_token_key" UNIQUE ("user_id", "token");



ALTER TABLE ONLY "public"."raw_ingest"
    ADD CONSTRAINT "raw_ingest_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."raw_ingest"
    ADD CONSTRAINT "raw_ingest_source_id_entity_type_external_id_key" UNIQUE ("source_id", "entity_type", "external_id");



ALTER TABLE ONLY "public"."regions"
    ADD CONSTRAINT "regions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."regions"
    ADD CONSTRAINT "regions_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."source_competition_group_map"
    ADD CONSTRAINT "source_competition_group_map_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."source_competition_group_map"
    ADD CONSTRAINT "source_competition_group_map_source_source_group_id_key" UNIQUE ("source", "source_group_id");



ALTER TABLE ONLY "public"."source_team_map"
    ADD CONSTRAINT "source_team_map_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."source_team_map"
    ADD CONSTRAINT "source_team_map_source_source_team_name_key" UNIQUE ("source", "source_team_name");



ALTER TABLE ONLY "public"."standings"
    ADD CONSTRAINT "standings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."standings"
    ADD CONSTRAINT "standings_season_id_team_id_key" UNIQUE ("season_id", "team_id");



ALTER TABLE ONLY "public"."team_mapping"
    ADD CONSTRAINT "team_mapping_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_mapping"
    ADD CONSTRAINT "team_mapping_source_id_external_team_id_key" UNIQUE ("source_id", "external_team_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_log_action_type" ON "public"."audit_log" USING "btree" ("action_type");



CREATE INDEX "idx_audit_log_actor_id" ON "public"."audit_log" USING "btree" ("actor_id");



CREATE INDEX "idx_audit_log_created_at" ON "public"."audit_log" USING "btree" ("created_at");



CREATE INDEX "idx_audit_log_table_record" ON "public"."audit_log" USING "btree" ("table_name", "record_id");



CREATE INDEX "idx_canonical_provenance_external" ON "public"."canonical_provenance" USING "btree" ("source_id", "entity_type", "external_id");



CREATE INDEX "idx_canonical_provenance_run_id" ON "public"."canonical_provenance" USING "btree" ("run_id");



CREATE INDEX "idx_canonical_provenance_source_entity" ON "public"."canonical_provenance" USING "btree" ("source_id", "entity_type");



CREATE INDEX "idx_clubs_region_id" ON "public"."clubs" USING "btree" ("region_id");



CREATE INDEX "idx_competition_categories_parent_id" ON "public"."competition_categories" USING "btree" ("parent_id");



CREATE INDEX "idx_competition_categories_source" ON "public"."competition_categories" USING "btree" ("source");



CREATE UNIQUE INDEX "idx_competition_categories_source_slug" ON "public"."competition_categories" USING "btree" ("source", "slug");



CREATE INDEX "idx_competitions_competition_type" ON "public"."competitions" USING "btree" ("competition_type");



CREATE INDEX "idx_competitions_region_id" ON "public"."competitions" USING "btree" ("region_id");



CREATE UNIQUE INDEX "idx_competitions_source_source_ref" ON "public"."competitions" USING "btree" ("source", "source_ref") WHERE (("source" IS NOT NULL) AND ("source_ref" IS NOT NULL));



CREATE UNIQUE INDEX "idx_competitions_source_source_ref_unique" ON "public"."competitions" USING "btree" ("source", "source_ref") WHERE (("source" IS NOT NULL) AND ("source_ref" IS NOT NULL));



CREATE INDEX "idx_entity_mapping_source_type" ON "public"."entity_mapping" USING "btree" ("source_id", "entity_type");



CREATE INDEX "idx_favourites_entity" ON "public"."favourites" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_favourites_user_id" ON "public"."favourites" USING "btree" ("user_id");



CREATE INDEX "idx_fixtures_away_team_id" ON "public"."fixtures" USING "btree" ("away_team_id");



CREATE INDEX "idx_fixtures_competition_group_scheduled" ON "public"."fixtures" USING "btree" ("competition_group_id", "scheduled_at") WHERE ("competition_group_id" IS NOT NULL);



CREATE INDEX "idx_fixtures_home_team_id" ON "public"."fixtures" USING "btree" ("home_team_id");



CREATE INDEX "idx_fixtures_scheduled_at" ON "public"."fixtures" USING "btree" ("scheduled_at");



CREATE INDEX "idx_fixtures_season_id" ON "public"."fixtures" USING "btree" ("season_id");



CREATE INDEX "idx_fixtures_status" ON "public"."fixtures" USING "btree" ("status");



CREATE INDEX "idx_fixtures_venue_id" ON "public"."fixtures" USING "btree" ("venue_id");



CREATE INDEX "idx_ingest_items_entity_type" ON "public"."ingest_items" USING "btree" ("run_id", "entity_type");



CREATE INDEX "idx_ingest_items_processed_status" ON "public"."ingest_items" USING "btree" ("processed_status") WHERE ("processed_status" = 'new'::"text");



CREATE INDEX "idx_ingest_items_run_id" ON "public"."ingest_items" USING "btree" ("run_id");



CREATE INDEX "idx_ingest_jobs_status_scheduled" ON "public"."ingest_jobs" USING "btree" ("status", "scheduled_at");



CREATE INDEX "idx_ingest_runs_created_at" ON "public"."ingest_runs" USING "btree" ("created_at");



CREATE INDEX "idx_ingest_runs_source_id" ON "public"."ingest_runs" USING "btree" ("source_id");



CREATE INDEX "idx_ingest_runs_status" ON "public"."ingest_runs" USING "btree" ("status");



CREATE INDEX "idx_match_disputes_match_id" ON "public"."match_disputes" USING "btree" ("match_id");



CREATE INDEX "idx_match_disputes_status" ON "public"."match_disputes" USING "btree" ("status");



CREATE INDEX "idx_match_disputes_submitted_by" ON "public"."match_disputes" USING "btree" ("submitted_by");



CREATE INDEX "idx_match_events_created_at" ON "public"."match_events" USING "btree" ("created_at");



CREATE INDEX "idx_match_events_fixture_id" ON "public"."match_events" USING "btree" ("fixture_id") WHERE ("fixture_id" IS NOT NULL);



CREATE INDEX "idx_match_events_match_id" ON "public"."match_events" USING "btree" ("match_id");



CREATE INDEX "idx_match_lineups_match_id" ON "public"."match_lineups" USING "btree" ("match_id");



CREATE INDEX "idx_match_lineups_team_id" ON "public"."match_lineups" USING "btree" ("team_id");



CREATE INDEX "idx_matches_fixture_id" ON "public"."matches" USING "btree" ("fixture_id");



CREATE INDEX "idx_matches_status" ON "public"."matches" USING "btree" ("status");



CREATE INDEX "idx_mywru_competition_groups_instance" ON "public"."mywru_competition_groups" USING "btree" ("competition_instance_id");



CREATE INDEX "idx_mywru_group_endpoints_group" ON "public"."mywru_group_endpoints" USING "btree" ("competition_group_id");



CREATE INDEX "idx_push_tokens_platform" ON "public"."push_tokens" USING "btree" ("platform");



CREATE INDEX "idx_push_tokens_user_id" ON "public"."push_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_raw_ingest_processed" ON "public"."raw_ingest" USING "btree" ("processed_at") WHERE ("processed_at" IS NULL);



CREATE INDEX "idx_raw_ingest_source_entity" ON "public"."raw_ingest" USING "btree" ("source_id", "entity_type");



CREATE INDEX "idx_seasons_competition_id" ON "public"."seasons" USING "btree" ("competition_id");



CREATE INDEX "idx_seasons_dates" ON "public"."seasons" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_source_competition_group_map_competition_group" ON "public"."source_competition_group_map" USING "btree" ("competition_group_id");



CREATE INDEX "idx_source_competition_group_map_source" ON "public"."source_competition_group_map" USING "btree" ("source");



CREATE INDEX "idx_source_team_map_source" ON "public"."source_team_map" USING "btree" ("source");



CREATE INDEX "idx_source_team_map_team_id" ON "public"."source_team_map" USING "btree" ("team_id");



CREATE INDEX "idx_standings_competition_group_id" ON "public"."standings" USING "btree" ("competition_group_id") WHERE ("competition_group_id" IS NOT NULL);



CREATE INDEX "idx_standings_position" ON "public"."standings" USING "btree" ("season_id", "position");



CREATE INDEX "idx_standings_season_id" ON "public"."standings" USING "btree" ("season_id");



CREATE INDEX "idx_standings_team_id" ON "public"."standings" USING "btree" ("team_id");



CREATE INDEX "idx_team_mapping_source" ON "public"."team_mapping" USING "btree" ("source_id");



CREATE INDEX "idx_team_mapping_team" ON "public"."team_mapping" USING "btree" ("team_id");



CREATE INDEX "idx_teams_club_id" ON "public"."teams" USING "btree" ("club_id");



CREATE UNIQUE INDEX "idx_teams_slug" ON "public"."teams" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_teams_team_type" ON "public"."teams" USING "btree" ("team_type");



CREATE INDEX "idx_users_club_id" ON "public"."users" USING "btree" ("club_id");



CREATE INDEX "idx_venues_club_id" ON "public"."venues" USING "btree" ("club_id");



CREATE UNIQUE INDEX "uq_fixtures_competition_group_source_match_ref" ON "public"."fixtures" USING "btree" ("competition_group_id", "source_match_ref") WHERE (("competition_group_id" IS NOT NULL) AND ("source_match_ref" IS NOT NULL));



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."canonical_provenance"
    ADD CONSTRAINT "canonical_provenance_ingest_item_id_fkey" FOREIGN KEY ("ingest_item_id") REFERENCES "public"."ingest_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."canonical_provenance"
    ADD CONSTRAINT "canonical_provenance_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."ingest_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."canonical_provenance"
    ADD CONSTRAINT "canonical_provenance_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."ingest_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."competition_categories"
    ADD CONSTRAINT "competition_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."competition_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."competitions"
    ADD CONSTRAINT "competitions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."competition_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."competitions"
    ADD CONSTRAINT "competitions_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_mapping"
    ADD CONSTRAINT "entity_mapping_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."ingest_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favourites"
    ADD CONSTRAINT "favourites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ingest_items"
    ADD CONSTRAINT "ingest_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."ingest_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingest_runs"
    ADD CONSTRAINT "ingest_runs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."ingest_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_disputes"
    ADD CONSTRAINT "match_disputes_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_disputes"
    ADD CONSTRAINT "match_disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."match_disputes"
    ADD CONSTRAINT "match_disputes_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "match_events_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "match_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_lineups"
    ADD CONSTRAINT "match_lineups_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_lineups"
    ADD CONSTRAINT "match_lineups_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."raw_ingest"
    ADD CONSTRAINT "raw_ingest_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."ingest_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."source_team_map"
    ADD CONSTRAINT "source_team_map_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."standings"
    ADD CONSTRAINT "standings_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."standings"
    ADD CONSTRAINT "standings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_mapping"
    ADD CONSTRAINT "team_mapping_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."ingest_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_mapping"
    ADD CONSTRAINT "team_mapping_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE SET NULL;



CREATE POLICY "Anyone can read match events" ON "public"."match_events" FOR SELECT USING (true);



CREATE POLICY "Anyone can read match lineups" ON "public"."match_lineups" FOR SELECT USING (true);



CREATE POLICY "Anyone can read matches" ON "public"."matches" FOR SELECT USING (true);



CREATE POLICY "Authenticated can insert audit log" ON "public"."audit_log" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated can read audit log" ON "public"."audit_log" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated can submit dispute" ON "public"."match_disputes" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("auth"."uid"() = "submitted_by")));



CREATE POLICY "Club admin can delete own club lineups" ON "public"."match_lineups" FOR DELETE USING (((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'club_admin'::"public"."user_role") AND (( SELECT "users"."club_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = ( SELECT "teams"."club_id"
   FROM "public"."teams"
  WHERE ("teams"."id" = "match_lineups"."team_id")))));



CREATE POLICY "Club admin can delete own club match events (undo)" ON "public"."match_events" FOR DELETE USING ("public"."match_belongs_to_user_club"("match_id"));



CREATE POLICY "Club admin can insert events for own club match" ON "public"."match_events" FOR INSERT WITH CHECK ("public"."match_belongs_to_user_club"("match_id"));



CREATE POLICY "Club admin can insert own club lineups" ON "public"."match_lineups" FOR INSERT WITH CHECK (((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'club_admin'::"public"."user_role") AND (( SELECT "users"."club_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) IS NOT NULL) AND (( SELECT "users"."club_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = ( SELECT "teams"."club_id"
   FROM "public"."teams"
  WHERE ("teams"."id" = "match_lineups"."team_id")))));



CREATE POLICY "Club admin can update own club lineups" ON "public"."match_lineups" FOR UPDATE USING (((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'club_admin'::"public"."user_role") AND (( SELECT "users"."club_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = ( SELECT "teams"."club_id"
   FROM "public"."teams"
  WHERE ("teams"."id" = "match_lineups"."team_id"))))) WITH CHECK (((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'club_admin'::"public"."user_role") AND (( SELECT "users"."club_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = ( SELECT "teams"."club_id"
   FROM "public"."teams"
  WHERE ("teams"."id" = "match_lineups"."team_id")))));



CREATE POLICY "Club admin can update own club match (score, status)" ON "public"."matches" FOR UPDATE USING ("public"."match_belongs_to_user_club"("id")) WITH CHECK ("public"."match_belongs_to_user_club"("id"));



CREATE POLICY "Users can delete own favourites" ON "public"."favourites" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own favourites" ON "public"."favourites" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own row (on signup)" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage own push tokens" ON "public"."push_tokens" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own disputes" ON "public"."match_disputes" FOR SELECT USING (("auth"."uid"() = "submitted_by"));



CREATE POLICY "Users can read own favourites" ON "public"."favourites" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own row" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own row" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favourites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_disputes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_lineups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."match_events";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."matches";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."competition_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."competition_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."competition_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_belongs_to_user_club"("match_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."match_belongs_to_user_club"("match_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_belongs_to_user_club"("match_uuid" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."canonical_provenance" TO "anon";
GRANT ALL ON TABLE "public"."canonical_provenance" TO "authenticated";
GRANT ALL ON TABLE "public"."canonical_provenance" TO "service_role";



GRANT ALL ON TABLE "public"."clubs" TO "anon";
GRANT ALL ON TABLE "public"."clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."clubs" TO "service_role";



GRANT ALL ON TABLE "public"."competition_categories" TO "anon";
GRANT ALL ON TABLE "public"."competition_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."competition_categories" TO "service_role";



GRANT ALL ON TABLE "public"."competitions" TO "anon";
GRANT ALL ON TABLE "public"."competitions" TO "authenticated";
GRANT ALL ON TABLE "public"."competitions" TO "service_role";



GRANT ALL ON TABLE "public"."entity_mapping" TO "anon";
GRANT ALL ON TABLE "public"."entity_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_mapping" TO "service_role";



GRANT ALL ON TABLE "public"."favourites" TO "anon";
GRANT ALL ON TABLE "public"."favourites" TO "authenticated";
GRANT ALL ON TABLE "public"."favourites" TO "service_role";



GRANT ALL ON TABLE "public"."fixtures" TO "anon";
GRANT ALL ON TABLE "public"."fixtures" TO "authenticated";
GRANT ALL ON TABLE "public"."fixtures" TO "service_role";



GRANT ALL ON TABLE "public"."ingest_items" TO "anon";
GRANT ALL ON TABLE "public"."ingest_items" TO "authenticated";
GRANT ALL ON TABLE "public"."ingest_items" TO "service_role";



GRANT ALL ON TABLE "public"."ingest_jobs" TO "anon";
GRANT ALL ON TABLE "public"."ingest_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."ingest_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."ingest_runs" TO "anon";
GRANT ALL ON TABLE "public"."ingest_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."ingest_runs" TO "service_role";



GRANT ALL ON TABLE "public"."ingest_sources" TO "anon";
GRANT ALL ON TABLE "public"."ingest_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."ingest_sources" TO "service_role";



GRANT ALL ON TABLE "public"."match_disputes" TO "anon";
GRANT ALL ON TABLE "public"."match_disputes" TO "authenticated";
GRANT ALL ON TABLE "public"."match_disputes" TO "service_role";



GRANT ALL ON TABLE "public"."match_events" TO "anon";
GRANT ALL ON TABLE "public"."match_events" TO "authenticated";
GRANT ALL ON TABLE "public"."match_events" TO "service_role";



GRANT ALL ON TABLE "public"."match_lineups" TO "anon";
GRANT ALL ON TABLE "public"."match_lineups" TO "authenticated";
GRANT ALL ON TABLE "public"."match_lineups" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."mywru_competition_groups" TO "anon";
GRANT ALL ON TABLE "public"."mywru_competition_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."mywru_competition_groups" TO "service_role";



GRANT ALL ON TABLE "public"."mywru_competition_instances" TO "anon";
GRANT ALL ON TABLE "public"."mywru_competition_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."mywru_competition_instances" TO "service_role";



GRANT ALL ON TABLE "public"."mywru_group_endpoints" TO "anon";
GRANT ALL ON TABLE "public"."mywru_group_endpoints" TO "authenticated";
GRANT ALL ON TABLE "public"."mywru_group_endpoints" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."raw_ingest" TO "anon";
GRANT ALL ON TABLE "public"."raw_ingest" TO "authenticated";
GRANT ALL ON TABLE "public"."raw_ingest" TO "service_role";



GRANT ALL ON TABLE "public"."regions" TO "anon";
GRANT ALL ON TABLE "public"."regions" TO "authenticated";
GRANT ALL ON TABLE "public"."regions" TO "service_role";



GRANT ALL ON TABLE "public"."seasons" TO "anon";
GRANT ALL ON TABLE "public"."seasons" TO "authenticated";
GRANT ALL ON TABLE "public"."seasons" TO "service_role";



GRANT ALL ON TABLE "public"."source_competition_group_map" TO "anon";
GRANT ALL ON TABLE "public"."source_competition_group_map" TO "authenticated";
GRANT ALL ON TABLE "public"."source_competition_group_map" TO "service_role";



GRANT ALL ON TABLE "public"."source_team_map" TO "anon";
GRANT ALL ON TABLE "public"."source_team_map" TO "authenticated";
GRANT ALL ON TABLE "public"."source_team_map" TO "service_role";



GRANT ALL ON TABLE "public"."standings" TO "anon";
GRANT ALL ON TABLE "public"."standings" TO "authenticated";
GRANT ALL ON TABLE "public"."standings" TO "service_role";



GRANT ALL ON TABLE "public"."team_mapping" TO "anon";
GRANT ALL ON TABLE "public"."team_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."team_mapping" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."venues" TO "anon";
GRANT ALL ON TABLE "public"."venues" TO "authenticated";
GRANT ALL ON TABLE "public"."venues" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































