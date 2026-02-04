-- Add 'fixture' to favourite_entity_type for favourite fixtures.
-- File: supabase/migrations/20260202150000_favourite_entity_fixture.sql

ALTER TYPE favourite_entity_type ADD VALUE IF NOT EXISTS 'fixture';
