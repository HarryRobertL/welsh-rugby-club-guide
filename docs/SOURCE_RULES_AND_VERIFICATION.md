# Source rules, allowlist, Six Nations & verification

## 1. Non‑negotiable source rules

1. **Welsh Rugby Union** competitions and leagues **always** use **MyWRU** data when available.
2. **All Wales Sport** is used **only** for explicit allowlisted non‑WRU competitions (e.g. BUCS). It must **never** compete with WRU for the same logical league.
3. **Six Nations** uses the **Six Nations OVAL** endpoints only; content is stored under source `sixnations`. Do not merge Six Nations into WRU or All Wales Sport.
4. **Identity** everywhere: competition identity is **source + source_ref**. Never match competitions by slug or name.

---

## 2. Competitions list (no cross‑source dedupe)

- The app reads from the view **`competitions_deduped`**, which **no longer** dedupes by logical league name across sources.
- The view includes all competitions where `source` is `mywru`, `sixnations`, or `NULL`.
- **AllWalesSport is filtered by allowlist** (table `allwalessport_allowlist` seeded from the non‑WRU list in `ingestion/config/allwalessport.json`).
- **Ordering** in the app: source priority **mywru → sixnations → allwalessport**, then by name.
- Each competition row is identified by `(source, source_ref)`; seasons, standings, and fixtures are tied to that competition `id`.

---

## 3. All Wales Sport allowlist

- **Env:** `ALLWALESSPORT_ALLOWLIST` — comma‑separated list of **competition CIDs** (numbers) and/or **exact names** (e.g. `BUCS`, `BUCS Super Rugby`).
- **Config:** `ingestion/config/allwalessport.json` can set `competitionCidAllowlist` (numbers) and `competitionNameAllowlist` (strings). These are merged with the env allowlist.
- **Discovery:** Only allowlisted competitions are discovered and scraped. If **no** allowlist is set (and no `startCompetitionCid`), **zero** All Wales Sport competitions are ingested.
- **UI:** Competitions with `source === 'allwalessport'` are tagged **External** in the Competitions list.

**Example**

```bash
# Allow only BUCS (by name) and CID 1055
export ALLWALESSPORT_ALLOWLIST="BUCS,1055"
npm run ingest -- --source=allwalessport
```

---

## 4. Six Nations (OVAL)

- **Source slug:** `sixnations`.
- **Config:** `ingestion/config/sixnations.json` — `baseUrl`, `competitions` (array of `compId`, `name`, `seasonIds`).
- **Identity:** `source_ref` = `compId:seasonId` (e.g. `1055:202600`).
- **Standings:** `GET https://oval.sixnationsrugby.com/rugby/v1/standing/search?compId={compId}&seasonId={seasonId}`. Example (Men's Six Nations 2026): `compId=1055`, `seasonId=202600`.
- **Fixtures/results:** `GET https://oval.sixnationsrugby.com/rugby/v1/fixture/search?compId={compId}&seasonId={seasonId}`. If the OVAL API uses a different path, update `ingestion/sources/sixnations/endpoints.ts` and the fetch in `ingestion/sources/sixnations.ts`.
- **Run:** `INGEST_SOURCE=sixnations npm run ingest`.
- **UI:** Six Nations competitions appear under **International Rugby** (category from name/slug) and show a **Six Nations** badge in the Competitions list.

### 4.1 Six Nations (www scrape – no API key)

- **Source slug:** `sixnations_www`.
- **Purpose:** Fixtures and standings when OVAL API is unavailable (e.g. 403). Scrapes `https://www.sixnationsrugby.com/en/m6n/fixtures/{seasonId}/table`. No API key required.
- **Identity:** Same as OVAL (`source=sixnations`, `source_ref=compId:seasonId`). Uses same persist layer; fixtures and teams are shared.
- **Run:** `INGEST_SOURCE=sixnations_www npm run ingest`.
- **Schedule:** Run weekly (e.g. cron) or after match days to refresh fixtures, results, and standings. When the page is client-rendered and returns no data, a static fallback for 2026 is used so the app still shows fixtures and standings.

---

## 5. Timezone policy

- **Display:** Welsh domestic and international times are shown in **Europe/London** (see `lib/dateTime.ts`: `formatKickoffDate`, `formatKickoffTime`, `toDateKey`).
- **Storage:** Fixtures store `scheduled_at` as ISO 8601 (UTC). Parsers should normalise to UTC when the source is UTC; when the source is local (e.g. “14:30” in UK), treat as Europe/London and store the equivalent UTC.

---

## 6. Verification (Debug and SQL)

### 6.1 Debug screen (in‑app)

- **Account → Debug** shows:
  - **Competitions by source** (count per source).
  - **Per source:** competitions count, seasons count, standings count, fixtures count; and samples of seasons per competition, standings per season, fixtures per season.

Use this to confirm that each source has the expected counts and that no league detail screen is empty when data exists for that source.

---

## 7. Scheduling (recommended)

For production, use **GitHub Actions** to run ingestion on a schedule:

- Daily refresh (UTC 06:00)
- Hourly during weekends (Sat/Sun UTC)

Workflow file: `.github/workflows/ingest.yml`

Required GitHub Secrets:

- `EXPO_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional (if you want to keep OVAL headers/cookies for future attempts):

- `SIXNATIONS_COOKIE`
- `SIXNATIONS_USER_AGENT`
- `SIXNATIONS_REFERER`

### 6.2 SQL (Supabase)

**Competitions per source**

```sql
SELECT source, COUNT(*) AS n
FROM competitions
WHERE source IS NOT NULL
GROUP BY source
ORDER BY source;
```

**Seasons per competition (sample)**

```sql
SELECT c.source, c.source_ref, c.name, COUNT(s.id) AS seasons
FROM competitions c
LEFT JOIN seasons s ON s.competition_id = c.id
WHERE c.source IS NOT NULL
GROUP BY c.id, c.source, c.source_ref, c.name
ORDER BY c.source, c.name
LIMIT 30;
```

**Standings per season (sample)**

```sql
SELECT s.id AS season_id, c.source, COUNT(st.id) AS standings_rows
FROM seasons s
JOIN competitions c ON c.id = s.competition_id
LEFT JOIN standings st ON st.season_id = s.id
WHERE c.source IS NOT NULL
GROUP BY s.id, c.source
ORDER BY c.source
LIMIT 20;
```

**Fixtures per season (sample)**

```sql
SELECT s.id AS season_id, c.source, COUNT(f.id) AS fixtures
FROM seasons s
JOIN competitions c ON c.id = s.competition_id
LEFT JOIN fixtures f ON f.season_id = s.id
WHERE c.source IS NOT NULL
GROUP BY s.id, c.source
ORDER BY c.source
LIMIT 20;
```

### 6.3 Acceptance checks

1. **Competitions list:** No “Default”, no “Competition &lt;id&gt;” titles.
2. **Welsh leagues:** Show WRU competition with seasons, table, and fixtures populated.
3. **BUCS:** Appears only as External and never replaces a WRU league.
4. **Six Nations:** Standings render for configured seasonIds (e.g. 202500, 202600); fixtures/results from OVAL when the endpoint returns data.
5. **Games tab:** Upcoming only by default; toggles Upcoming/Results; league filter (My Leagues, All Leagues, single league); grouped by league then date; no N+1.
6. **No crashes,** no undefined reduce errors, no “object Object” text.
