# Ingestion operations

## Environment variables

### App (Expo / client)

- **EXPO_PUBLIC_SUPABASE_URL** — Supabase project URL (public).
- **EXPO_PUBLIC_SUPABASE_ANON_KEY** — Supabase anonymous (anon) key. Used by `lib/supabase.ts` for all app/browser access. Safe to expose in client bundles.

### Ingestion (Node scripts only)

- **EXPO_PUBLIC_SUPABASE_URL** — Same Supabase project URL.
- **SUPABASE_SERVICE_ROLE_KEY** — Supabase service role key. Used only by ingestion via `ingestion/lib/supabaseAdmin.ts`. Bypasses RLS; must never be committed or used in client code.

**Service role key:** Must never be committed to version control or used in the browser. Keep it in `.env.local` (or a secrets manager) and load it only when running ingestion (e.g. `npm run ingest`).

## Running ingestion locally

Load `.env` and `.env.local` (via dotenv in `ingestion/load-env.ts`), then:

```bash
npm run ingest
```

Without cache:

```bash
npm run ingest:no-cache
```

Ensure migrations are applied (e.g. `supabase db push` or apply migrations in the Supabase dashboard) so tables such as `ingest_sources`, `ingest_runs`, `ingest_items`, `mywru_*` exist before running ingestion. After fetch, the parse stage runs automatically: it reads `ingest_items` with `processed_status = 'new'`, runs the MyWRU parser by `entity_type` (standing, fixture, result), and writes `payload.parsed` and sets `processed_status` to `parsed` or `failed`.

## All Wales Sport ingestion

**Migrations required:** For All Wales Sport scrape and persist to work, ensure these migrations are applied: `20260203100000_ingest_entity_type_form_table.sql` and `20260203110000_ingest_entity_type_fixtures_results_standings.sql` (they add `form_table`, `fixtures`, `results`, `standings` to the `ingest_entity_type` enum). Run `supabase db push` or apply them in your usual way before running full ingest or Gate 3.

To run only the All Wales Sport source (discovery, scrape, parse, persist):

```bash
npm run ingest:allwalessport
```

**Single-competition mode (fast iteration):** Set `ALLWALESSPORT_CID` to limit discovery and scrape to one competition, e.g. `ALLWALESSPORT_CID=16481 npm run ingest:allwalessport` for the Premiership.

**Verification gates:** (1) Gate 1: `INGEST_SOURCE=allwalessport INGEST_DRY_RUN=1 npm run ingest` — expect competitions found &gt; 0. (2) Gate 2: add `ALLWALESSPORT_CID=16481` — expect parsed fixtures/results/standings counts in logs. (3) Gate 3: same without `INGEST_DRY_RUN` (after migrations applied) — verify in Supabase: `teams`, `fixtures`, `matches`, `standings`. (4) Gate 4: `npm run test:ingest:allwalessport` — must pass.

This sets `INGEST_SOURCE=allwalessport` and runs the same pipeline as `npm run ingest` but for the All Wales Sport source only.

### Dry run

Set `INGEST_DRY_RUN=1` to run discovery and parsing (and create `ingest_run` / `ingest_item` records) but **skip the persist stage** (no writes to fixtures, matches, standings, teams, etc.):

```bash
INGEST_DRY_RUN=1 npm run ingest:allwalessport
```

Use this to validate discovery and parsing without modifying core tables.

### Parser tests (All Wales Sport)

Minimal Node-based parser tests use saved HTML under `ingestion/fixtures/allwalessport/` (fixture page, standings table). They do not affect the main build. Run:

```bash
npm run test:ingest:allwalessport
```

## Parser tests (MyWRU)

Run MyWRU parser unit tests (fixtures in `ingestion/parsers/mywru/fixtures/`):

```bash
npm run test:ingest
```
