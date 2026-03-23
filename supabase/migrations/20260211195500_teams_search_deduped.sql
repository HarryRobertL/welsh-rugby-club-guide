-- Search-only teams de-duplication view.
-- Purpose:
--   - Return one canonical team row per logical club label for UI search.
--   - Keep existing tables and ingestion flows unchanged.
-- Safety:
--   - Read-only view; no data mutation.
--   - Search scope only; fixture/home logic unaffected by this migration.

CREATE OR REPLACE VIEW public.teams_search_deduped AS
WITH fixture_counts AS (
  SELECT team_id, count(*)::int AS fixture_count
  FROM (
    SELECT home_team_id AS team_id FROM public.fixtures
    UNION ALL
    SELECT away_team_id AS team_id FROM public.fixtures
  ) fixture_teams
  GROUP BY team_id
),
base AS (
  SELECT
    t.id,
    t.name,
    t.team_type,
    t.club_id,
    t.created_at,
    coalesce(fc.fixture_count, 0) AS fixture_count,
    trim(
      regexp_replace(
        regexp_replace(
          lower(regexp_replace(t.name, '\m(rfc|rugby football club)\M', '', 'gi')),
          '[^a-z0-9]+',
          ' ',
          'g'
        ),
        '\s+',
        ' ',
        'g'
      )
    ) AS search_key,
    CASE WHEN t.name ~* '\mrfc\M' THEN 0 ELSE 1 END AS rfc_preference
  FROM public.teams t
  LEFT JOIN fixture_counts fc ON fc.team_id = t.id
  WHERE t.name IS NOT NULL
    AND length(trim(t.name)) > 0
    AND lower(trim(t.name)) NOT IN ('tbc', 'null', 'undefined')
),
ranked AS (
  SELECT
    b.*,
    row_number() OVER (
      PARTITION BY b.search_key, b.team_type
      ORDER BY
        b.fixture_count DESC,
        b.rfc_preference ASC,
        b.created_at ASC,
        b.id ASC
    ) AS rn
  FROM base b
  WHERE b.search_key <> ''
)
SELECT
  id,
  name,
  team_type,
  club_id,
  search_key,
  fixture_count
FROM ranked
WHERE rn = 1;

GRANT SELECT ON public.teams_search_deduped TO anon;
GRANT SELECT ON public.teams_search_deduped TO authenticated;
