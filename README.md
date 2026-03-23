# Welsh Rugby Club Guide (Cymru Rugby)

Cross-platform guide to Welsh rugby competitions, fixtures, and clubs — built with **Expo** and **Supabase**. This repository is the source for [welsh-rugby-club-guide on GitHub](https://github.com/HarryRobertL/welsh-rugby-club-guide).

## Tech stack

| Layer | Choices |
|--------|---------|
| **App** | [Expo SDK 54](https://expo.dev/), [Expo Router](https://docs.expo.dev/router/introduction/), React 19, React Native / React Native Web |
| **Backend** | [Supabase](https://supabase.com/) (Postgres, Auth, Row Level Security, optional Edge Functions) |
| **Data** | TypeScript ingestion scripts (`ts-node`), [Cheerio](https://cheerio.js.org/) HTML parsing |
| **Quality** | ESLint (Expo config), Playwright (web smoke), parser unit tests |
| **Web deploy** | Static export + [Netlify](https://www.netlify.com/) (`netlify.toml`, publish `dist`) |

## Architecture

High-level data and trust boundaries: the **mobile/web client** uses only the **anon** Supabase key; **ingestion** uses the **service role** on a secure machine or CI, never in the shipped app.

```mermaid
flowchart TB
  subgraph clients [Clients]
    Web[Expo Web]
    Native[iOS / Android]
  end
  subgraph edge [Supabase]
    Auth[Auth]
    DB[(Postgres + RLS)]
    Fn[Edge Functions optional]
  end
  subgraph pipeline [Ingestion]
    Run[ts-node ingestion]
    Parse[Cheerio parsers]
  end
  Web --> Auth
  Native --> Auth
  Web --> DB
  Native --> DB
  Run --> Parse
  Parse --> DB
  Fn --> DB
```

## Screenshots

<p align="center">
  <img src="assets/hero-image-wrcg.png" alt="Welsh Rugby Club Guide — hero" width="320" />
  &nbsp;&nbsp;
  <img src="assets/login-page-logo.png" alt="Sign-in branding" width="200" />
</p>

_Add more UI captures under `docs/screenshots/` if you want a fuller gallery._

## Live demo

If the app is deployed (e.g. Netlify after `expo export --platform web`), **add your public URL here**:

**Demo:** `https://YOUR-SITE.netlify.app` _(replace with your deployed URL)_

`netlify.toml` is configured for a single-page app-style redirect to `index.html` under `dist/`.

## Local setup

### Prerequisites

- **Node.js** 20+ (LTS recommended)
- **npm** (ships with Node)
- A **Supabase** project (URL + anon key for the app; service role only for ingestion)

### Steps

1. **Clone**

   ```bash
   git clone https://github.com/HarryRobertL/welsh-rugby-club-guide.git
   cd welsh-rugby-club-guide
   ```

2. **Install**

   ```bash
   npm ci
   ```

3. **Environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set at least:

   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

   For ingestion on your machine, also set `SUPABASE_SERVICE_ROLE_KEY` (never commit it). See `.env.example` for optional variables.

4. **Run the app**

   ```bash
   npm start
   ```

   Then press `i` / `a` / `w` for iOS simulator, Android, or web.

5. **Web on a fixed port** (matches Playwright)

   ```bash
   npx expo start --web --port 8085
   ```

### Database migrations

Apply SQL under `supabase/migrations/` in your Supabase project (SQL editor or [Supabase CLI](https://supabase.com/docs/guides/cli)) so client queries and RLS policies match the app.

## Tests

| Command | Purpose |
|---------|---------|
| `npm run lint` | ESLint across the project |
| `npm run test:ingest` | MyWRU parser unit test |
| `npm run test:ingest:allwalessport` | All Wales Sport parser test (if used) |
| `npm run test:e2e` | Playwright smoke (starts Expo web on port 8085) |

E2E tests that exercise sign-up/sign-in expect **`PLAYWRIGHT_SMOKE_EMAIL`** and **`PLAYWRIGHT_SMOKE_PASSWORD`** in `.env` (see `.env.example`). Use a disposable test account only.

## Ingestion (optional)

Populate or refresh data from configured sources (requires service role and env documented in `.env.example`):

```bash
npm run ingest
```

## Personal contributions

**Author: [Harry Robert L](https://github.com/HarryRobertL)** — _tune this paragraph for CVs or interviews._

This project bundles end-to-end ownership of a small product: **Expo Router** UI (tabs for home, games, competitions, search, favourites, club-facing flows), **Supabase** integration with typed client code, **SQL migrations** for search deduplication and authorization hardening around club claims and roles, **Node ingestion** parsers and persistence, **Playwright** smoke coverage for web, and **Netlify** configuration for static web delivery. Replace this bullet list with your own narrative of what you personally designed, implemented, or led.

## Repository hygiene

- **Secrets:** Use `.env` locally; commit only `.env.example`.
- **Commit messages:** Prefer imperative, scoped messages (e.g. `feat: …`, `fix: …`, `docs: …`) so history stays readable.

## Licence

Private / all rights reserved unless you add an explicit `LICENSE` file.
