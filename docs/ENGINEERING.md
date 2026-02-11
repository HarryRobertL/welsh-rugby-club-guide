# Engineering context

**Role:** Senior mobile engineer and backend architect.

**Project:** Production-grade regional MVP for a Welsh grassroots rugby app (see [PRD.md](./PRD.md) for product contract).

---

## Stack

- **Client:** React Native with Expo
- **Language:** TypeScript
- **Backend:** Supabase (Postgres, Auth, Realtime)
- **Notifications:** Push notifications
- **Access:** Role-based access

---

## Priorities

1. **Clean architecture** — Clear layers, bounded contexts, testable boundaries.
2. **Stable schema** — No breaking schema changes (per PRD); migrations only additive/backward-compatible where possible.
3. **Production readiness** — Error handling, logging, audit trails, no placeholder behaviour in critical paths.
4. **Clear TODO markers** — Use consistent `TODO:` (or similar) so work can be discovered and tracked.
5. **No overengineering** — Build for MVP scope; avoid speculative features or unnecessary abstraction.
6. **No mock data beyond seeds** — Use seed data for dev/test; production flows use real Supabase data only.

---

## Scale and constraints

- **Assume national scale later** — Design and schema should not assume “South Wales Valleys only” in a way that blocks national rollout. Region is configuration/data, not hardcoded logic.
- **Do not hardcode region logic** — Region/geography (e.g. South Wales Valleys) must be driven by data or config, not literals in control flow.
- **Do not collapse roles into hacks** — Roles (e.g. supporter, club admin, referee, league admin) are first-class; use proper RBAC and avoid boolean or string hacks that blur role boundaries.

---

## Deployment

- **Web:** Run `npx expo export --platform web`. Deploy the `dist/` folder to any static host (Vercel, Netlify, etc.). Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as build-time env vars (or ensure they are baked into the client by your host).
- **Native (iOS/Android):** Use [EAS Build](https://docs.expo.dev/build/introduction/). Run `eas build --profile preview` (internal) or `eas build --profile production` (store). Ensure the project is linked (`eas init` if needed) and set `EAS_PROJECT_ID` in `.env` so `app.config.js` can expose it for push tokens. See `eas.json` for development / preview / production profiles.
- **Env vars:** Copy `.env.example` to `.env` (and `.env.local` for ingestion secrets). Never commit `.env` or `.env.local`. See [OPS_Ingestion.md](./OPS_Ingestion.md) for ingestion-specific env.

---

## Practice

- **File placement** — When adding or moving files, briefly explain where they live and why (e.g. “`src/features/fixtures/` — fixture list and detail; colocated with Supabase hooks and types”).

---

*This document is the engineering contract for the repo. All code and schema should align with it and with [PRD.md](./PRD.md).*
