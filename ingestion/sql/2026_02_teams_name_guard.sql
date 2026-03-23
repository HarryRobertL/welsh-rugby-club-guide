-- Migration: Guard polluted team names in public.teams
-- File: ingestion/sql/2026_02_teams_name_guard.sql
--
-- Applies:
--   A) Cleanup existing polluted names by normalizing to 'TBC'
--   B) Add CHECK constraint to block future polluted writes
--
-- Rollback:
--   See the rollback section at the bottom of this file.

begin;

-- A) Cleanup existing polluted team names.
update public.teams
set name = 'TBC'
where name is null
   or trim(name) = ''
   or lower(name) like '%object object%'
   or lower(name) like '%[object object]%'
   or lower(name) in ('null', 'undefined');

-- B) Add CHECK constraint to prevent future polluted values.
alter table public.teams
  drop constraint if exists teams_name_not_object;

alter table public.teams
  add constraint teams_name_not_object
  check (
    length(trim(name)) > 0
    and lower(name) not like '%object object%'
    and lower(name) not like '%[object object]%'
    and lower(name) not in ('null', 'undefined')
  );

commit;

-- C) Rollback statements.
-- Execute manually if rollback is required.
-- begin;
-- alter table public.teams
--   drop constraint if exists teams_name_not_object;
-- commit;
