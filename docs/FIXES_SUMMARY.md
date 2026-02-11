# Critical bugs fixed – summary

## 1. "Competition 662" bug (root cause)

**Cause:** Competition titles were coming from:
- Fallback `Competition ${id}` when `competitions.name` was "Default" or missing (list and debug).
- No competition title on detail screen (only season selector).

**Wrong joins / usage:** The UI was never using season.id as the competition title; the list was using a fallback that turned slug (e.g. `mywru-662`) into "Competition 662". Ingestion was storing `Competition ${groupId}` or "Default" in `competitions.name` when WRU payload had no name.

**Fixes:**
- **`lib/competitionOverrides.ts`**: Added `getCompetitionDisplayName(source, source_ref, rawName, slug)` – never returns "Default" or "Competition &lt;id&gt;"; returns override, then `competitions.name`, else "Unknown competition" (with console.warn).
- **`app/(tabs)/competitions/CompetitionsListScreen.tsx`**: Uses `getCompetitionDisplayName()` for every row; removed fallback that produced "Competition X".
- **`app/(tabs)/competitions/[id].tsx`**: Uses `useCompetition(id)` to load competition, then `getCompetitionDisplayName()` for the page title. Title is always from competition record or "Unknown competition".
- **Ingestion:**  
  - **MyWRU** `ingestion/sources/mywru/persist.ts`: When building group payload or in `ensureCompetition`, if name is missing, "Default", or matches "Competition 123", store "Unknown competition" and log.  
  - **AllWalesSport** `ingestion/sources/allwalessport/persist.ts`: Same in `ensureCompetition` and in the byCid label when building groups.

---

## 2. Standings joined at the right level

**Audit:** Standings are keyed by `season_id` only (no separate `standing_group` table). The app already:
- Selects a season explicitly (season selector on competition detail).
- Queries standings with `.eq('season_id', seasonId)` in `features/competitions/useStandings.ts`.
- Does not join standings to `competitions.id`; standings → season → competition.

**Fixes:**
- **Guard:** In `app/(tabs)/competitions/[id].tsx`, if `rows.length === 0` and `fixtures.length > 0` for the selected season, log an error: "Standings empty but fixtures exist for this season – check standings join to season_id" with competitionId and seasonId.
- **Safe team names:** In `features/competitions/useStandings.ts`, team name is derived from `team:teams(name)`; added `safeTeamName()` so we never render `[object Object]` when the relation shape differs.

---

## 3. "object Object Home v object Object Away"

**Fixes:**
- **`features/competitions/useFixturesBySeason.ts`**: Already normalises home/away to strings and uses `safeStr()`.
- **`app/(tabs)/competitions/[id].tsx`**: Uses `teamLabel(f.home_team_name)` and `teamLabel(f.away_team_name)` (already present).
- **`features/competitions/useStandings.ts`**: Added `safeTeamName()` for `team_name` from the team relation.
- **`app/(tabs)/games/index.tsx`** and **`app/(tabs)/index.tsx`**: Already use `teamLabel()` for fixture rows (from earlier work).

No UI should render `[object Object]`; all fixture and standing team labels go through safe accessors.

---

## 4. WRU league identity (West Central 3 etc.)

**Rule:** WRU names like "West Central 3", "East Central 2", "North West 3" must display as **"WRU Men's National League &lt;Region&gt; &lt;Tier&gt;"**.

**Fixes:**
- **`lib/competitionOverrides.ts`**:  
  - Overrides for `mywru` + raw name: "West Central 1/2/3", "East 1/2/3", "West 1/2/3", "North 1/2/3" → "WRU Men's National League West Central N" etc.  
  - Explicit entries for "West Central 3", "East Central 2", "North West 3".  
- Display uses `getCompetitionDisplayName()` which applies these overrides before falling back to DB name.

---

## 5. "Default" removed from user-facing UI

- **`getCompetitionDisplayName()`**: If raw name is missing or "Default", returns "Unknown competition" (and logs); never "Default" or "Competition X".
- **List and detail:** All competition labels go through `getCompetitionDisplayName()`.
- **Debug screen:** Uses `getCompetitionDisplayName()` for canonical names; section labels say "Default name (raw)" for data observability only, not as a user-facing category.
- **Categories:** Uncategorised competitions map to "Other" (existing taxonomy); no "Default" category is shown.

---

## 6. Deterministic categorisation

- **`lib/competitionCategories.ts`**: Categories (International, Professional, Welsh Regions, National Leagues, Regional Leagues, Age Grade, Cups & Plates, Memorial, Services, Universities, Other) and pattern-based mapping already exist.
- **`lib/competitionOverrides.ts`**: Display overrides do not change category; they only change displayed name. Regional leagues (e.g. West Central 3) are in the correct category and display with WRU Men's National League prefix.

---

## 7. Live updates (no fake realtime)

- **`app/(tabs)/competitions/[id].tsx`**:  
  - If any fixture has `status === 'live'`, poll fixtures every **20 seconds** (refetch).  
  - Otherwise poll both standings and fixtures every **90 seconds**.  
  - Pull-to-refresh was already present and still triggers refetch.
- No full app reload; only the competition detail screen polls.

---

## 8. Data observability (debug screen)

- **`app/(tabs)/debug.tsx`**:  
  - **Competitions by source** (count per source).  
  - **Competitions with Default name (raw)** count.  
  - **Seasons per competition** (sample).  
  - **Fixtures per season** (sample).  
  - **Standings per season** (sample).  
  - Unmapped (Default name) list and sample mapping (raw → canonical, category).  
  - Refresh button; no "Competition &lt;id&gt;" or "Default" in canonical names (uses `getCompetitionDisplayName()`).

Access: Account → "Debug (dev) – competitions & mapping" or navigate to `/(tabs)/debug`.

---

## Components touched

| Component / file | Change |
|------------------|--------|
| `lib/competitionOverrides.ts` | `getCompetitionDisplayName()`, WRU Men's National League overrides, never "Competition X" or "Default" |
| `app/(tabs)/competitions/CompetitionsListScreen.tsx` | Use `getCompetitionDisplayName()` only; removed "Competition X" fallback |
| `app/(tabs)/competitions/[id].tsx` | `useCompetition(id)`, title from `getCompetitionDisplayName()`, standings guard, live/90s polling |
| `features/competitions/useCompetition.ts` | **New** – fetch one competition by id |
| `features/competitions/useStandings.ts` | `safeTeamName()` for team relation |
| `app/(tabs)/debug.tsx` | Observability counts (seasons, fixtures, standings), `getCompetitionDisplayName()` |
| `ingestion/sources/mywru/persist.ts` | Store "Unknown competition" when name is Default or "Competition N"; never store "Competition &lt;id&gt;" |
| `ingestion/sources/allwalessport/persist.ts` | Same in label and `ensureCompetition` |

---

## How to verify West Central 3 locally

1. **Apply migration** (view with source/source_ref; dedup by source):
   ```bash
   npx supabase db push
   ```
   Or apply `supabase/migrations/20260207120000_competitions_deduped_by_source.sql` if not yet applied.

2. **Data:** Have at least one competition from MyWRU with name "West Central 3" (or ensure an override exists for that name). Overrides in code already map:
   - `mywru` + "West Central 3" → "WRU Men's National League West Central 3".

3. **In the app:**
   - Open **Competitions** tab.
   - Find the competition that is West Central 3 (e.g. under Welsh National Leagues or Regional Leagues).
   - It should show **"WRU Men's National League West Central 3"**, not "West Central 3" or "Competition 662".
   - Tap it: detail screen title should be the same.
   - No "Default" or "Competition &lt;id&gt;" anywhere.

4. **Debug screen:**
   - Account → Debug (dev).
   - Check "Competitions by source" and "Sample mapping"; canonical names should never be "Competition X" or "Default".

---

## Migration

Run so the app gets `source` and `source_ref` from the view and dedup-by-source behaviour:

```bash
npx supabase db push
```

Or run the migration file:

`supabase/migrations/20260207120000_competitions_deduped_by_source.sql`

This view:
- Partitions by `(source, logical_league_key)` so AllWalesSport and MyWRU do not merge by name.
- Exposes `source` and `source_ref` so the app can apply display overrides.
