# Standings persistence – debug and verification

## Logging

After running ingest + persist:

- **MyWRU** (`ingestion/sources/mywru/persist.ts`): logs `[MyWRU persist] standings` with `source_ref`, `competitionId`, `seasonId`, `parsedStandingsCount`; then `[MyWRU persist] standings written` with `writtenStandingsCount` per group.
- **AllWalesSport** (`ingestion/sources/allwalessport/persist.ts`): logs `[AllWalesSport persist] standings` and `[AllWalesSport persist] standings written` with `source_ref`, `competitionId`, `seasonId`, `parsedStandingsCount`, `writtenStandingsCount`.

## DB verification (run after ingest in dev)

```sql
-- Standings count by source (via competitions → seasons → standings)
SELECT c.source, COUNT(*) AS standings_rows
FROM public.standings st
JOIN public.seasons s ON s.id = st.season_id
JOIN public.competitions c ON c.id = s.competition_id
GROUP BY c.source
ORDER BY standings_rows DESC;

-- AllWalesSport only
SELECT COUNT(*) FROM public.standings st
JOIN public.seasons s ON s.id = st.season_id
JOIN public.competitions c ON c.id = s.competition_id
WHERE c.source = 'allwalessport';

-- MyWRU only
SELECT COUNT(*) FROM public.standings st
JOIN public.seasons s ON s.id = st.season_id
JOIN public.competitions c ON c.id = s.competition_id
WHERE c.source = 'mywru';
```

If standings persist reports 0, check:

1. Ingest items have `entity_type = 'standing'` (MyWRU) or `'standings'` (AllWalesSport) and `processed_status = 'parsed'`.
2. Parser outputs a non-empty `standings` array (table tab detected; see `parse_competition_page.ts` for standings table detection).
