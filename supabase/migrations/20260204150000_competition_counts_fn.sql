-- Competition counts for fixtures/standings by competition via seasons
CREATE OR REPLACE FUNCTION public.competition_counts()
RETURNS TABLE (
  competition_id UUID,
  fixtures_count INT,
  standings_count INT,
  latest_season_id UUID
)
LANGUAGE sql
STABLE
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
